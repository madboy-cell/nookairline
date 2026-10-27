// client/js/frontier/vfx_studio.js — Interactive 3D Effekseer Skill VFX Studio (?dev=1&vfx=1) & Headless Renderer.
// Supports live timeline scrubbing, 281-effect CC0 .efkefc browser, weapon pairing, and 10-player stress benchmark.

import * as THREE from 'three';
import { loadManifest, loadSprite } from '../assets.js';
import { ChibiRig } from '../chibi_rig.js';
import { SKILL_VFX_DEFS, resolveSkillVfxRecipe } from '/shared/skill_vfx_defs.js';
import { ACCESSORIES } from '/shared/catalog_gear_pets.js';
import { SkillVfxEngine } from './skill_vfx_engine.js';
import { EffekseerVfxManager, loadEffekseerCatalog } from './effekseer_vfx.js';

const PITCH = 0.58;

const DEFAULT_WEAPON_FOR_VFX = {
  // Whispering Meadow (5)
  sk_pollen_ring: 'gloves_boss_moss_staff',
  sk_jelly_shield: 'gloves_starter_wand',
  sk_zephyr_vault: 'gloves_boss_moss_longbow',
  sk_tusk_rush: 'gloves_boss_moss_cleaver',
  sk_earthshatter: 'gloves_boss_moss_cleaver',
  // Crystal Hollow (5)
  sk_crystal_fan: 'gloves_boss_weaver_cane',
  sk_echo_drain: 'gloves_boss_weaver_scythe',
  sk_frost_nova: 'gloves_boss_weaver_cane',
  sk_gravity_spin: 'gloves_boss_weaver_scythe',
  sk_prism_beam: 'gloves_boss_weaver_cane',
  // Celestial Sakura Reef (5)
  sk_foxfire_wisps: 'gloves_boss_kitsune_staff',
  sk_mirror_shell: 'gloves_boss_kitsune_staff',
  sk_tailwind_gale: 'gloves_boss_kitsune_bow',
  sk_koi_whirlpool: 'gloves_boss_kitsune_staff',
  sk_sakura_tempest: 'gloves_boss_kitsune_blade',
  // Clockwork Star-Caldera (5)
  sk_solar_meteor: 'gloves_boss_bahamut_staff',
  sk_chain_lightning: 'gloves_boss_bahamut_bow',
  sk_star_brand: 'gloves_boss_bahamut_cleaver',
  sk_time_dilation: 'gloves_boss_bahamut_staff',
  sk_supernova_cleave: 'gloves_boss_bahamut_cleaver',
  // Class Combos & Goddess Ultimate
  combo_melee_1: 'gloves_starter_sword',
  combo_melee_2: 'gloves_boss_kitsune_blade',
  combo_melee_3: 'gloves_boss_bahamut_cleaver',
  combo_ranged_1: 'gloves_starter_shortbow',
  combo_ranged_2: 'gloves_boss_kitsune_bow',
  combo_ranged_3: 'gloves_boss_bahamut_bow',
  combo_magic_1: 'gloves_starter_wand',
  combo_magic_2: 'gloves_boss_kitsune_staff',
  combo_magic_3: 'gloves_boss_bahamut_staff',
  ult_charm_sanctuary: 'gloves_mythic_poseidon_staff',
};

export async function startVfxStudio(params) {
  document.getElementById('gate')?.classList.add('hidden');
  document.getElementById('hud')?.setAttribute('hidden', 'hidden');

  const wrap = document.createElement('div');
  wrap.id = 'vfx-studio';
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:60;background:#18241d;display:flex;flex-direction:column;font:13px "Comfortaa",system-ui,sans-serif;color:#fff8ea;user-select:none;';

  const vfxIds = Object.keys(SKILL_VFX_DEFS);
  const weaponIds = Object.keys(ACCESSORIES).filter(
    (k) => ACCESSORIES[k]?.slot === 'gloves' && (k.includes('starter_') || k.includes('boss_') || k.includes('mythic_'))
  );

  wrap.innerHTML = `
    <div id="vs-bar" style="padding:8px 12px;background:rgba(28,20,16,0.95);border-bottom:2px solid #c9a45c;display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:3;">
      <b style="color:#fde047;">🎆 3D Effekseer VFX Studio</b>
      <select id="vs-skill" style="padding:4px 8px;border-radius:8px;background:#2c1e16;color:#fff8ea;border:1px solid #c9a45c;">
        ${vfxIds.map((id) => `<option value="${id}">${SKILL_VFX_DEFS[id].label} (${id})</option>`).join('')}
      </select>
      <select id="vs-raw-efk" title="Browse all 281 CC0 Pre-Built .efkefc Effects" style="padding:4px 8px;border-radius:8px;background:#1e293b;color:#bae6fd;border:1px solid #38bdf8;max-width:220px;">
        <option value="">📦 Browse 281 Raw .efkefc…</option>
      </select>
      <select id="vs-biome" style="padding:4px 8px;border-radius:8px;background:#2c1e16;color:#fff8ea;border:1px solid #c9a45c;">
        <option value="meadow">🌲 Whispering Meadow</option>
        <option value="hollow">💎 Crystal Hollow</option>
        <option value="reef">🌸 Celestial Sakura Reef</option>
        <option value="caldera">⚙️ Clockwork Star-Caldera</option>
      </select>
      <select id="vs-weapon" style="padding:4px 8px;border-radius:8px;background:#2c1e16;color:#fff8ea;border:1px solid #c9a45c;">
        ${weaponIds.map((id) => `<option value="${id}">⚔️ ${ACCESSORIES[id]?.name || id}</option>`).join('')}
      </select>
      <button id="vs-cast" style="padding:5px 12px;border-radius:999px;background:linear-gradient(180deg,#fde047,#ca8a04);color:#2c1808;font-weight:900;border:none;cursor:pointer;">▶ Cast</button>
      <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;">
        <input id="vs-scrub" type="range" min="0" max="5000" value="0" style="width:140px;" />
        <span id="vs-ms" style="font-family:ui-monospace,monospace;min-width:62px;">0 ms</span>
      </label>
      <button id="vs-bench" style="padding:5px 10px;border-radius:999px;background:#334155;color:#e2e8f0;font-weight:800;border:1px solid #64748b;cursor:pointer;">⚡ 10P Bench</button>
      <span id="vs-stats" style="font-family:ui-monospace,monospace;font-size:11.5px;color:#a7f3d0;"></span>
    </div>
    <div id="vs-stage" style="flex:1;position:relative;overflow:hidden;">
      <div id="vs-top-badge" style="display:none;position:absolute;left:12px;top:12px;padding:5px 11px;border-radius:9px;background:rgba(24,18,14,0.84);border:1.5px solid rgba(250,204,21,0.72);color:#fef08a;font-weight:800;font-size:12px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(0,0,0,0.45);z-index:4;"></div>
      <div id="vs-badge" style="display:none;position:absolute;left:12px;bottom:12px;padding:6px 12px;border-radius:10px;background:rgba(20,16,14,0.85);border:1.5px solid rgba(235,200,120,0.78);color:#fff8ea;font-weight:800;font-size:12.5px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(0,0,0,0.45);z-index:4;"></div>
    </div>
  `;
  document.body.appendChild(wrap);

  const $ = (id) => wrap.querySelector(`#${id}`);
  const stage = $('vs-stage');

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  await loadManifest(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4f6d40);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
  const setCamTarget = (tx = 0, tz = 0.4, dist = 14.8) => {
    camera.position.set(tx, Math.sin(PITCH) * dist + 0.55, tz + Math.cos(PITCH) * dist);
    camera.lookAt(tx, 0.55, tz);
  };
  setCamTarget();

  const resize = () => {
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  // Lights
  const hemi = new THREE.HemisphereLight(0xdcf0ff, 0x5c7544, 0.98);
  hemi.position.set(0, 25, 0);
  scene.add(hemi);
  const dirLight = new THREE.DirectionalLight(0xfff1d0, 0.95);
  dirLight.position.set(10, 24, 14);
  scene.add(dirLight);

  // Ground + Biome Props
  const groundGeo = new THREE.PlaneGeometry(36, 36, 36, 36);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0x7fa35a,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  worldRoot.add(groundMesh);

  const propsGroup = new THREE.Group();
  worldRoot.add(propsGroup);

  async function applyBiome(biome = 'meadow') {
    const BIOME_CFG = {
      meadow: {
        bg: 0x557544,
        hemiSky: 0xdcf0ff,
        hemiGround: 0x5c7544,
        dirColor: 0xfff1d0,
        floorSprite: 'ground_classic',
        floorTint: 0xdce8d2,
        props: [
          { key: 'sf_prop_meadow_tree', x: -6.5, z: -4.8, w: 3.8 },
          { key: 'sf_prop_meadow_tree', x: 6.6, z: -4.6, w: 3.8 },
          { key: 'env_bush_daisies_white', x: -5.2, z: 3.1, w: 1.35 },
          { key: 'env_bush_roses_pink', x: 5.4, z: 3.2, w: 1.35 },
        ],
      },
      hollow: {
        bg: 0x132730,
        hemiSky: 0x6792ab,
        hemiGround: 0x1a2830,
        dirColor: 0xd8f3ff,
        floorSprite: 'terrain_hollow_floor',
        floorTint: 0xd8eef5,
        props: [
          { key: 'sf_prop_hollow_wall', x: -6.2, z: -4.8, w: 3.4 },
          { key: 'sf_prop_hollow_wall', x: 6.4, z: -4.5, w: 3.4 },
          { key: 'sf_node_crystal', x: -5.4, z: 2.8, w: 1.9 },
          { key: 'sf_node_mithril', x: 5.8, z: 2.5, w: 2.0 },
        ],
      },
      reef: {
        bg: 0x3b2838,
        hemiSky: 0xffd8ec,
        hemiGround: 0x365b59,
        dirColor: 0xfff0f7,
        floorSprite: 'terrain_reef_floor',
        floorTint: 0xffeef6,
        props: [
          { key: 'sf_prop_sakura_torii', x: -6.3, z: -4.9, w: 3.6 },
          { key: 'sf_node_sakura_tree', x: 6.5, z: -4.6, w: 3.6 },
          { key: 'sf_node_pearl_clam', x: -5.3, z: 2.9, w: 1.75 },
          { key: 'sf_node_cloud_lotus', x: 5.7, z: 2.8, w: 2.1 },
        ],
      },
      caldera: {
        bg: 0x1b1322,
        hemiSky: 0xfde68a,
        hemiGround: 0x281b32,
        dirColor: 0xffdfa3,
        floorSprite: 'terrain_caldera_floor',
        floorTint: 0xede3f7,
        props: [
          { key: 'sf_prop_astrolabe_pillar', x: -6.2, z: -4.8, w: 3.5 },
          { key: 'sf_prop_astrolabe_pillar', x: 6.4, z: -4.6, w: 3.5 },
          { key: 'sf_node_orichalcum', x: -5.4, z: 2.8, w: 1.95 },
          { key: 'sf_node_astral_prism', x: 5.8, z: 2.6, w: 2.05 },
        ],
      },
    };
    const cfg = BIOME_CFG[biome] || BIOME_CFG.meadow;
    scene.background.setHex(cfg.bg);
    hemi.color.setHex(cfg.hemiSky);
    hemi.groundColor.setHex(cfg.hemiGround);
    dirLight.color.setHex(cfg.dirColor);

    const gSprite = await loadSprite(cfg.floorSprite);
    if (gSprite?.texture) {
      const tex = gSprite.texture.clone();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(9, 9);
      tex.needsUpdate = true;
      groundMat.map = tex;
      groundMat.color.setHex(cfg.floorTint);
      groundMat.needsUpdate = true;
    }

    while (propsGroup.children.length) {
      const ch = propsGroup.children[0];
      propsGroup.remove(ch);
      ch.geometry?.dispose?.();
      ch.material?.dispose?.();
    }

    for (const pd of cfg.props) {
      const sp = await loadSprite(pd.key);
      if (!sp?.texture) continue;
      const aspect = sp.h && sp.w ? sp.h / sp.w : 1;
      const geo = new THREE.PlaneGeometry(pd.w, pd.w * aspect);
      geo.translate(0, pd.w * aspect * 0.48, 0);
      const mat = new THREE.MeshBasicMaterial({ map: sp.texture, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(pd.x, 0.02, pd.z);
      m.rotation.x = -PITCH;
      propsGroup.add(m);
    }
  }

  // Hero ChibiRig + Target Dummy Monster
  const heroRig = new ChibiRig({ lineage: 'girl', name: '', sub: '', wings: null });
  scene.add(heroRig.ROOT);
  await heroRig.ready;
  await heroRig.setOutfit('newbie_outfit');
  await heroRig.setHair('hair_girl_waves', 'silver');
  let equippedWeaponId = 'gloves_boss_moss_staff';
  await heroRig.setAccessories({ gloves: equippedWeaponId, boots: 'boots_traveler' });

  const dummyGroup = new THREE.Group();
  let activeDummyKey = '';
  let activeDummyWidth = 0;
  async function setDummySprite(spriteKey = 'sf_mob_quartz_golemling', baseWidth = 1.65) {
    if (spriteKey === activeDummyKey && Math.abs(baseWidth - activeDummyWidth) < 0.01 && dummyGroup.children.length > 0) {
      return;
    }
    const sp = await loadSprite(spriteKey);
    if (!sp?.texture) return;
    while (dummyGroup.children.length) {
      const ch = dummyGroup.children[0];
      dummyGroup.remove(ch);
      ch.geometry?.dispose?.();
      ch.material?.dispose?.();
    }
    const da = sp.h && sp.w ? sp.h / sp.w : 1;
    const dGeo = new THREE.PlaneGeometry(baseWidth, baseWidth * da);
    dGeo.translate(0, baseWidth * da * 0.48, 0);
    const dMat = new THREE.MeshBasicMaterial({ map: sp.texture, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide });
    const dMesh = new THREE.Mesh(dGeo, dMat);
    dMesh.rotation.x = -PITCH;
    dummyGroup.add(dMesh);
    activeDummyKey = spriteKey;
    activeDummyWidth = baseWidth;
  }
  await setDummySprite('sf_mob_quartz_golemling', 1.65);
  dummyGroup.position.set(3.4, 0, 0.8);
  dummyGroup.visible = false;
  worldRoot.add(dummyGroup);

  // Pure 3D Effekseer Engine
  const vfxEngine = new SkillVfxEngine({ camPitch: PITCH });
  await vfxEngine.attachRenderer(renderer);
  const efkManager = vfxEngine.efk || new EffekseerVfxManager();
  if (!efkManager.ready) {
    await efkManager.init(renderer).catch((err) => console.warn('Effekseer init warning:', err));
  }

  const efkCatalog = await loadEffekseerCatalog();
  const rawSel = $('vs-raw-efk');
  if (rawSel && Array.isArray(efkCatalog.effects)) {
    for (const item of efkCatalog.effects) {
      const opt = document.createElement('option');
      opt.value = item.url;
      opt.textContent = `${item.pack} · ${item.name}`;
      rawSel.appendChild(opt);
    }
  }

  let currentEfkSpec = null;
  let currentEfkParams = null;
  let currentDashChoreo = null;
  let studioElapsedMs = 0;
  let paused = false;
  let lastT = performance.now();

  async function equipWeaponIfNeeded(wepId) {
    if (!wepId || wepId === equippedWeaponId) return;
    equippedWeaponId = wepId;
    $('vs-weapon').value = wepId;
    await heroRig.setAccessories({ gloves: wepId, boots: 'boots_traveler' });
  }

  async function castSelected({ vfxId, biome, weaponId, rawEfkUrl, rawEfkScale = 0.55, seed = 777 } = {}) {
    const id = vfxId || $('vs-skill').value;
    const rec = resolveSkillVfxRecipe(id);
    const bio = biome || rec.biomeHint || $('vs-biome').value || 'meadow';

    $('vs-skill').value = id;
    $('vs-biome').value = bio;
    $('vs-scrub').max = String(rec.durationMs || 4000);

    await applyBiome(bio);
    await equipWeaponIfNeeded(weaponId || DEFAULT_WEAPON_FOR_VFX[id] || 'gloves_boss_moss_staff');

    efkManager.stopAll();
    heroRig.ROOT.position.set(0, 0, 0);
    heroRig.walkWeight = 0;
    studioElapsedMs = 0;

    const isDirectional = Boolean(rec.isDirectional || rec.category === 'class_combo');
    dummyGroup.visible = isDirectional;
    const tx = isDirectional ? 3.5 : 0;
    const tz = isDirectional ? 0.8 : 1.0;
    dummyGroup.position.set(tx, 0, tz);
    setCamTarget(isDirectional ? 1.3 : 0, 0.35, rec.isBeam ? 16.5 : 14.5);

    const facing = isDirectional
      ? { x: tx / Math.hypot(tx, tz), z: tz / Math.hypot(tx, tz) }
      : { x: 0.35, z: 0.94 };

    currentDashChoreo =
      rec.rigChoreo?.dashDist > 0
        ? { dashDist: rec.rigChoreo.dashDist, poseMs: rec.rigChoreo.poseMs || 480, fx: facing.x, fz: facing.z }
        : null;

    if (rec.rigChoreo) {
      heroRig.facing?.set?.(facing.x >= 0, facing.z < -0.35);
      heroRig.triggerAttack?.(rec.rigChoreo.pose || 'slash', {
        dur: (rec.rigChoreo.poseMs || 500) / 1000,
        weaponScaleBoost: rec.rigChoreo.weaponScaleBoost || 1.18,
      });
    }

    currentEfkSpec = rawEfkUrl
      ? { layers: [{ url: rawEfkUrl, scale: rawEfkScale, at: 'caster', yOffset: 0.06 }] }
      : rec.effekseer || null;

    if (currentEfkSpec) {
      currentEfkParams = {
        x: 0,
        y: 0,
        z: 0,
        targetX: tx,
        targetZ: tz,
        fx: facing.x,
        fz: facing.z,
        casterRef: heroRig.ROOT.position,
        seed,
      };
      await efkManager.playRecipe(currentEfkSpec, currentEfkParams);
    } else {
      currentEfkParams = null;
    }

    paused = false;
    return currentEfkSpec;
  }

  $('vs-cast').onclick = () => castSelected({ rawEfkUrl: $('vs-raw-efk')?.value || '' });
  $('vs-skill').onchange = () => {
    if ($('vs-raw-efk')) $('vs-raw-efk').value = '';
    castSelected();
  };
  $('vs-raw-efk').onchange = () => {
    const rawUrl = $('vs-raw-efk').value;
    if (rawUrl) castSelected({ rawEfkUrl: rawUrl });
    else castSelected();
  };
  $('vs-biome').onchange = () => castSelected({ biome: $('vs-biome').value });
  $('vs-weapon').onchange = () => castSelected({ weaponId: $('vs-weapon').value });

  $('vs-scrub').oninput = async () => {
    paused = true;
    const ms = Number($('vs-scrub').value) || 0;
    studioElapsedMs = ms;
    $('vs-ms').textContent = `${ms} ms`;
    if (currentEfkSpec && currentEfkParams) {
      await efkManager.seekRecipe(currentEfkSpec, currentEfkParams, ms);
    }
    renderer.render(scene, camera);
    efkManager.draw(renderer, camera);
  };

  async function runBench10p(frames = 90) {
    paused = true;
    efkManager.stopAll();
    await applyBiome('meadow');
    setCamTarget(0, 0.5, 19.5);

    const benchRecipes = [
      'sk_pollen_ring',
      'sk_prism_beam',
      'sk_sakura_tempest',
      'sk_supernova_cleave',
      'sk_solar_meteor',
      'sk_koi_whirlpool',
      'sk_foxfire_wisps',
      'sk_chain_lightning',
      'sk_frost_nova',
      'ult_charm_sanctuary',
    ];
    for (let i = 0; i < 10; i++) {
      const col = (i % 5) - 2;
      const row = Math.floor(i / 5) - 0.5;
      const x = col * 3.1;
      const z = row * 3.8;
      const rec = resolveSkillVfxRecipe(benchRecipes[i]);
      if (rec?.effekseer) {
        await efkManager.playRecipe(rec.effekseer, {
          x,
          y: 0,
          z,
          targetX: x + 2.5,
          targetZ: z + 1.2,
          fx: 0.85,
          fz: 0.52,
          seed: 1000 + i * 31,
        });
      }
    }

    // Advance 30 frames into peak 3D Effekseer burst (~500ms)
    for (let w = 0; w < 30; w++) {
      efkManager.update(0.016);
    }
    renderer.render(scene, camera);
    efkManager.draw(renderer, camera);

    const times = [];
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      efkManager.update(0.016);
      heroRig.update(0.016, { vx: 0, vz: 0, walkWeight: 0 }, camera);
      renderer.render(scene, camera);
      efkManager.draw(renderer, camera);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const avgFrameMs = +(times.reduce((s, v) => s + v, 0) / times.length).toFixed(2);
    const p95FrameMs = +times[Math.floor(times.length * 0.95)].toFixed(2);
    const info = renderer.info.render;
    const summary = {
      players: 10,
      frames,
      avgFrameMs,
      p95FrameMs,
      drawCalls: info.calls,
      triangles: info.triangles,
    };
    $('vs-stats').textContent = `10P Effekseer Bench: avg ${avgFrameMs}ms (p95 ${p95FrameMs}ms)`;
    paused = false;
    return summary;
  }

  $('vs-bench').onclick = () => runBench10p(90);

  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) * 0.001));
    lastT = now;
    if (!paused) {
      studioElapsedMs += dt * 1000;
      if (currentDashChoreo) {
        const dp = Math.min(1, Math.max(0, studioElapsedMs / currentDashChoreo.poseMs));
        const eased = 1 - Math.pow(1 - dp, 3);
        heroRig.ROOT.position.set(
          currentDashChoreo.fx * currentDashChoreo.dashDist * eased,
          0,
          currentDashChoreo.fz * currentDashChoreo.dashDist * eased
        );
      }
      efkManager.update(dt);
      heroRig.update(dt, { vx: 0, vz: 0, walkWeight: 0 }, camera);
      const ms = Math.round(studioElapsedMs);
      if (ms <= Number($('vs-scrub').max || 5000)) {
        $('vs-scrub').value = String(ms);
        $('vs-ms').textContent = `${ms} ms`;
      }
      renderer.render(scene, camera);
      efkManager.draw(renderer, camera);
    }
  }

  window.__vfxStudio = {
    ready: false,
    renderer,
    scene,
    camera,
    heroRig,
    vfxEngine,
    efkManager,
    setCaptureChrome(captureOn, badgeText = '', topBadgeText = '') {
      $('vs-bar').style.display = captureOn ? 'none' : 'flex';
      const badge = $('vs-badge');
      if (badgeText) {
        badge.style.display = 'block';
        badge.textContent = badgeText;
      } else {
        badge.style.display = 'none';
      }
      const topBadge = $('vs-top-badge');
      if (topBadge) {
        if (topBadgeText) {
          topBadge.style.display = 'block';
          topBadge.textContent = topBadgeText;
        } else {
          topBadge.style.display = 'none';
        }
      }
      resize();
    },
    async renderRawEfk({
      efkSpec,
      biome = 'meadow',
      weaponId = 'gloves_boss_moss_staff',
      elapsedMs = 700,
      badge = '',
      topBadge = '',
      dummySpriteKey = 'sf_mob_quartz_golemling',
      dummyWidth = 1.65,
      dummyPos = null,
      camTarget = null,
    }) {
      paused = true;
      this.setCaptureChrome(true, badge, topBadge);
      await applyBiome(biome);
      await equipWeaponIfNeeded(weaponId);
      await setDummySprite(dummySpriteKey, dummyWidth);
      efkManager.stopAll();
      heroRig.ROOT.position.set(0, 0, 0);
      heroRig.facing.set(true, false);
      heroRig.update(0.016, { vx: 0, vz: 0, walkWeight: 0 }, camera);

      const tx = dummyPos?.x ?? 3.4;
      const tz = dummyPos?.z ?? 0.7;
      dummyGroup.visible = Boolean(dummyPos);
      if (dummyPos) dummyGroup.position.set(tx, dummyPos.y ?? 0, tz);
      setCamTarget(camTarget?.x ?? 0.85, camTarget?.z ?? 0.35, camTarget?.dist ?? 15.0);

      const d = Math.hypot(tx, tz) || 1;
      await efkManager.seekRecipe(
        efkSpec,
        {
          x: 0,
          y: 0,
          z: 0,
          targetX: tx,
          targetZ: tz,
          fx: tx / d,
          fz: tz / d,
          casterRef: heroRig.ROOT.position,
          seed: 4242,
        },
        elapsedMs
      );
      renderer.render(scene, camera);
      efkManager.draw(renderer, camera);
      return { ok: true };
    },
    async renderAt({
      vfxId,
      biome,
      weaponId,
      elapsedMs = 700,
      walkInside = false,
      badge = '',
      topBadge = '',
      dummySpriteKey = '',
      dummyWidth = 1.65,
      dummyPos = null,
      camTarget = null,
    }) {
      paused = true;
      this.setCaptureChrome(true, badge, topBadge);
      if (dummySpriteKey) {
        await setDummySprite(dummySpriteKey, dummyWidth);
      } else {
        await setDummySprite('sf_mob_quartz_golemling', 1.65);
      }
      await castSelected({ vfxId, biome, weaponId, seed: 4242 });
      paused = true;

      if (dummyPos) {
        dummyGroup.visible = true;
        dummyGroup.position.set(dummyPos.x ?? 3.4, dummyPos.y ?? 0, dummyPos.z ?? 0.7);
      }
      if (camTarget) {
        setCamTarget(camTarget.x ?? 0.9, camTarget.z ?? 0.35, camTarget.dist ?? 14.8);
      }

      const rec = resolveSkillVfxRecipe(vfxId);
      const isDir = Boolean(rec.isDirectional || rec.category === 'class_combo');
      const dtx = dummyGroup.position.x || 3.5;
      const dtz = dummyGroup.position.z || 0.8;
      const dLen = Math.hypot(dtx, dtz) || 1;
      const fvx = isDir ? dtx / dLen : 0.35;
      const fvz = isDir ? dtz / dLen : 0.94;

      heroRig.combatAnim = null;
      if (walkInside) {
        heroRig.ROOT.position.set(0.95, 0, 0.55);
        heroRig.facing.set(false, false);
        for (let i = 0; i < 12; i++) {
          heroRig.update(0.04, { vx: -2.2, vz: 1.1, walkWeight: 1 }, camera);
        }
      } else {
        if (rec.rigChoreo?.dashDist > 0) {
          const dashMs = rec.rigChoreo.poseMs || 480;
          const dp = Math.min(1, Math.max(0, elapsedMs / dashMs));
          const eased = 1 - Math.pow(1 - dp, 3);
          heroRig.ROOT.position.set(fvx * rec.rigChoreo.dashDist * eased, 0, fvz * rec.rigChoreo.dashDist * eased);
        } else {
          heroRig.ROOT.position.set(0, 0, 0);
        }
        heroRig.facing.set(true, false);
        const poseDurSec = (rec.rigChoreo?.poseMs || 650) / 1000;
        if (elapsedMs * 0.001 < poseDurSec) {
          heroRig.triggerAttack(rec.rigChoreo?.pose || (isDir ? 'wand_cast' : 'float_chant'), {
            dur: poseDurSec,
            weaponScaleBoost: rec.rigChoreo?.weaponScaleBoost || 1.18,
          });
          const steps = Math.max(1, Math.round((elapsedMs * 0.001) / 0.016));
          const stepDt = (elapsedMs * 0.001) / steps;
          for (let s = 0; s < steps; s++) {
            heroRig.update(stepDt, { vx: 0, vz: 0, walkWeight: 0 }, camera);
          }
        } else {
          heroRig.update(0.016, { vx: 0, vz: 0, walkWeight: 0 }, camera);
        }
      }

      if (currentEfkSpec && currentEfkParams) {
        currentEfkParams.targetX = dummyGroup.position.x || currentEfkParams.targetX;
        currentEfkParams.targetZ = dummyGroup.position.z || currentEfkParams.targetZ;
        currentEfkParams.fx = fvx;
        currentEfkParams.fz = fvz;
        await efkManager.seekRecipe(currentEfkSpec, currentEfkParams, elapsedMs);
      }
      renderer.render(scene, camera);
      efkManager.draw(renderer, camera);
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
    runBench10p,
  };

  const initialSkill = params.get('skill') && SKILL_VFX_DEFS[params.get('skill')] ? params.get('skill') : 'sk_pollen_ring';
  await castSelected({ vfxId: initialSkill });
  window.__vfxStudio.ready = true;
  requestAnimationFrame(frameLoop);
}
