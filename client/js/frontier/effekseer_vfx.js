// client/js/frontier/effekseer_vfx.js — EffekseerForWebGL 1.80.7 Runtime Bridge (MIT) + CC0 Pre-Built Anime Skill Player.
// Shares the active THREE.WebGLRenderer context with fast state-reset (`renderer.resetState()`) and lazy-cached `.efkefc` loading.

let _runtimePromise = null;
let _catalogPromise = null;

export function ensureEffekseerRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (_runtimePromise) return _runtimePromise;

  _runtimePromise = new Promise((resolve, reject) => {
    const bootWasm = () => {
      const efk = window.effekseer;
      if (!efk) {
        reject(new Error('window.effekseer missing after script load'));
        return;
      }
      efk.initRuntime(
        '/vendor/effekseer/effekseer.wasm',
        () => resolve(efk),
        () => reject(new Error('Failed to initialize effekseer.wasm'))
      );
    };

    if (window.effekseer) {
      bootWasm();
      return;
    }

    const s = document.createElement('script');
    s.src = '/vendor/effekseer/effekseer.min.js';
    s.async = true;
    s.onload = bootWasm;
    s.onerror = () => reject(new Error('Failed to load /vendor/effekseer/effekseer.min.js'));
    document.head.appendChild(s);
  });

  return _runtimePromise;
}

export function loadEffekseerCatalog() {
  if (typeof fetch === 'undefined') return Promise.resolve({ effects: [] });
  if (!_catalogPromise) {
    _catalogPromise = fetch('/assets/effekseer/catalog.json')
      .then((r) => (r.ok ? r.json() : { effects: [] }))
      .catch(() => ({ effects: [] }));
  }
  return _catalogPromise;
}

export class EffekseerVfxManager {
  constructor() {
    this.renderer = null;
    this.context = null;
    this.ready = false;
    this._initPromise = null;
    this._effectCache = new Map(); // url -> Promise<EffekseerEffect>
    this._resolvedEffects = new Map(); // url -> EffekseerEffect
    this._pendingTimers = new Set();
    this._activeHandles = [];
    this._elapsedClockMs = 0;
    this._scheduled = []; // { fireAtMs, fn }
  }

  async init(renderer) {
    if (!renderer || typeof window === 'undefined') return false;
    if (this.ready && this.renderer === renderer) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      const efk = await ensureEffekseerRuntime();
      if (!efk) return false;
      this.renderer = renderer;
      const gl = renderer.getContext();
      this.context = efk.createContext();
      this.context.init(gl, {
        instanceMaxCount: 8000,
        squareMaxCount: 16000,
      });
      this.context.setRestorationOfStatesFlag(false);
      this.ready = true;
      return true;
    })();

    return this._initPromise;
  }

  loadEffect(url) {
    if (!this.ready || !this.context || !url) return Promise.resolve(null);
    if (this._effectCache.has(url)) return this._effectCache.get(url);

    const p = new Promise((resolve) => {
      let eff = null;
      eff = this.context.loadEffect(
        url,
        1.0,
        () => {
          this._resolvedEffects.set(url, eff);
          resolve(eff);
        },
        (reason, badPath) => {
          console.warn('[Effekseer] Failed loading resource:', reason, badPath, 'for', url);
          resolve(null);
        },
        (resPath) => {
          // Encode non-ASCII characters safely without double-encoding % sequences
          try {
            return encodeURI(decodeURI(resPath));
          } catch (_) {
            return encodeURI(resPath);
          }
        }
      );
    });
    this._effectCache.set(url, p);
    return p;
  }

  async preloadUrls(urls = []) {
    const uniq = [...new Set(urls.filter(Boolean))];
    await Promise.all(uniq.map((u) => this.loadEffect(u)));
  }

  async preloadUrlsTrickle(priorityUrls = [], backgroundUrls = [], batchSize = 3) {
    if (!this.ready || !this.context) return;
    await this.preloadUrls(priorityUrls);
    if (!this.ready || !this.context) return;
    const step = Math.max(1, batchSize | 0);
    const bg = [...new Set(backgroundUrls.filter((u) => u && !this._effectCache.has(u)))];
    for (let i = 0; i < bg.length; i += step) {
      if (!this.ready || !this.context) return;
      const batch = bg.slice(i, i + step).filter((u) => !this._effectCache.has(u));
      if (batch.length > 0) {
        await Promise.all(batch.map((u) => this.loadEffect(u)));
      }
      if (i + step < bg.length) {
        if (!this.ready || !this.context) return;
        await new Promise((r) => setTimeout(r, 16));
      }
    }
  }

  _playLayerNow(layer, params) {
    if (!this.ready || !this.context || !layer?.effectObj) return null;
    const ox = Number(params.x) || 0;
    const oy = Number(params.y) || 0;
    const oz = Number(params.z) || 0;
    const tx = Number.isFinite(params.targetX) ? params.targetX : ox;
    const tz = Number.isFinite(params.targetZ) ? params.targetZ : oz;
    const fx = Number.isFinite(params.fx) ? params.fx : 0;
    const fz = Number.isFinite(params.fz) ? params.fz : 1;
    const rightX = -fz;
    const rightZ = fx;
    const isProjectile = layer.at === 'projectile';
    const yaw = isProjectile
      ? Math.atan2(tx - ox || fx, tz - oz || fz)
      : Math.atan2(fx, fz);

    let px = ox;
    let pz = oz;
    if (layer.at === 'target') {
      px = tx;
      pz = tz;
    } else if (layer.at === 'midpoint') {
      px = (ox + tx) * 0.5;
      pz = (oz + tz) * 0.5;
    }
    if (layer.forwardOffset) {
      px += fx * layer.forwardOffset;
      pz += fz * layer.forwardOffset;
    }
    if (layer.sideOffset) {
      px += rightX * layer.sideOffset;
      pz += rightZ * layer.sideOffset;
    }
    const defaultYOff = isProjectile ? 0.68 : 0.04;
    const yOff = layer.yOffset !== undefined ? Number(layer.yOffset) : defaultYOff;
    const py = oy + yOff;

    const handle = this.context.play(layer.effectObj, px, py, pz);
    if (!handle) return null;

    if (Number.isFinite(params.seed)) {
      handle.setRandomSeed?.((params.seed + (layer.seedOffset || 0)) | 0);
    }

    const s = layer.scale ?? 0.5;
    const sx = Array.isArray(s) ? s[0] : s;
    const sy = Array.isArray(s) ? s[1] : s;
    const sz = Array.isArray(s) ? s[2] : s;
    handle.setScale(sx, sy, sz);

    const rx = Number(layer.pitchOffset) || 0;
    const ry = layer.lockWorldYaw ? (Number(layer.yawOffset) || 0) : yaw + (Number(layer.yawOffset) || 0);
    const rz = Number(layer.rollOffset) || 0;
    handle.setRotation(rx, ry, rz);

    if (layer.speed && layer.speed !== 1) {
      handle.setSpeed(layer.speed);
    }
    if (Array.isArray(layer.color) && layer.color.length >= 3) {
      handle.setAllColor(
        layer.color[0] | 0,
        layer.color[1] | 0,
        layer.color[2] | 0,
        layer.color[3] !== undefined ? (layer.color[3] | 0) : 255
      );
    }
    if (layer.useTargetLocation) {
      handle.setTargetLocation?.(tx, oy + (layer.targetYOffset ?? 0.5), tz);
    }

    const dxOffset = (layer.forwardOffset ? fx * layer.forwardOffset : 0) + (layer.sideOffset ? rightX * layer.sideOffset : 0);
    const dzOffset = (layer.forwardOffset ? fz * layer.forwardOffset : 0) + (layer.sideOffset ? rightZ * layer.sideOffset : 0);
    const recipeDurMs = Math.max(350, Number(params.durationMs) || 1800);
    const layerDelayMs = Math.max(0, Number(layer.delayMs) || 0);
    const maxLifeMs = Math.max(250, Number(layer.maxLifeMs) || (recipeDurMs - layerDelayMs));
    const stopRootAtMs = Math.max(140, maxLifeMs - 260);
    const entry = {
      handle,
      groupId: params.groupId || 0,
      ageMs: 0,
      stopRootAtMs,
      hardStopAtMs: maxLifeMs,
      rootStopped: false,
      stopIfDead: Boolean(params.stopIfDead),
      followDash: Boolean(layer.followCaster),
      useDistortion: Boolean(layer.useDistortion),
      casterRef: params.casterRef || null,
      dxOffset,
      dzOffset,
      yOffset: yOff,
      isProjectile,
      travelElapsedMs: 0,
      travelMs: Math.max(40, Number(layer.travelMs) || 200),
      startX: px,
      startY: py,
      startZ: pz,
      endX: tx,
      endY: oy + (layer.targetYOffset !== undefined ? Number(layer.targetYOffset) : 0.55),
      endZ: tz,
      targetRef: params.targetRef || null,
      arcHeight: Number(layer.arcHeight) || 0,
      sideArc: Number(layer.sideArc) || 0,
      stopOnArrive: layer.stopOnArrive !== false,
      arrived: false,
      lockWorldYaw: Boolean(layer.lockWorldYaw),
      yawOffset: Number(layer.yawOffset) || 0,
      pitchOffset: rx,
      rollOffset: rz,
    };
    this._activeHandles.push(entry);
    return handle;
  }

  /**
   * Play a multi-layer pre-built Effekseer skill recipe asynchronously in live gameplay.
   */
  async playRecipe(efkSpec, params = {}) {
    if (!this.ready || !efkSpec) return [];
    const layers = Array.isArray(efkSpec.layers) ? efkSpec.layers : [efkSpec];
    const groupId = params.groupId || 0;

    const loaded = await Promise.all(
      layers.map(async (l, idx) => ({
        ...l,
        seedOffset: idx * 37,
        effectObj: await this.loadEffect(l.url),
      }))
    );

    if (groupId && this._cancelledGroups?.has(groupId)) {
      this._cancelledGroups.delete(groupId);
      return [];
    }

    const handles = [];
    for (const l of loaded) {
      if (!l.effectObj) continue;
      const delay = Number(l.delayMs) || 0;
      if (delay <= 0) {
        const h = this._playLayerNow(l, params);
        if (h) handles.push(h);
      } else {
        this._scheduled.push({
          groupId,
          fireAtMs: this._elapsedClockMs + delay,
          fn: () => this._playLayerNow(l, params),
        });
      }
    }
    return handles;
  }

  stopGroup(groupId) {
    if (!groupId) return;
    if (!this._cancelledGroups) this._cancelledGroups = new Set();
    this._cancelledGroups.add(groupId);
    for (let i = this._scheduled.length - 1; i >= 0; i--) {
      if (this._scheduled[i].groupId === groupId) {
        this._scheduled.splice(i, 1);
      }
    }
    for (let i = this._activeHandles.length - 1; i >= 0; i--) {
      const it = this._activeHandles[i];
      if (it.groupId === groupId) {
        try { it.handle?.stopRoot?.(); } catch (_) {}
        try { it.handle?.stop?.(); } catch (_) {}
        try { it.handle?.setShown?.(false); } catch (_) {}
        this._activeHandles.splice(i, 1);
      }
    }
  }

  /**
   * Deterministically seek a pre-built Effekseer recipe (or raw `.efkefc` URL) to `elapsedMs` for Studio scrubbing & screenshots.
   */
  async seekRecipe(efkSpec, params = {}, elapsedMs = 800) {
    if (!this.ready || !this.context || !efkSpec) return;
    this.stopAll();
    const layers = Array.isArray(efkSpec.layers) ? efkSpec.layers : [efkSpec];

    const loaded = await Promise.all(
      layers.map(async (l, idx) => ({
        ...l,
        seedOffset: idx * 37,
        fired: false,
        effectObj: await this.loadEffect(l.url),
      }))
    );

    const totalMs = Math.max(0, Number(elapsedMs) || 0);
    const stepMs = 1000 / 60;
    let curMs = 0;

    // Fire t=0 layers
    for (const l of loaded) {
      if (l.effectObj && (Number(l.delayMs) || 0) <= 0) {
        l.fired = true;
        this._playLayerNow(l, params);
      }
    }

    while (curMs < totalMs) {
      const dtMs = Math.min(stepMs, totalMs - curMs);
      curMs += dtMs;
      for (const l of loaded) {
        if (!l.fired && l.effectObj && curMs >= (Number(l.delayMs) || 0)) {
          l.fired = true;
          this._playLayerNow(l, params);
        }
      }
      this._syncFollowHandles(dtMs);
      this.context.update((dtMs / 1000) * 60.0);
    }
  }

  _syncFollowHandles(dtMs = 0) {
    const stepMs = Math.max(0, Number(dtMs) || 0);
    for (let i = this._activeHandles.length - 1; i >= 0; i--) {
      const it = this._activeHandles[i];
      if (!it.handle || it.handle.exists === false) {
        this._activeHandles.splice(i, 1);
        continue;
      }
      it.ageMs = (it.ageMs || 0) + stepMs;
      if (it.stopIfDead && it.casterRef && Number.isFinite(it.casterRef.hp) && it.casterRef.hp <= 0) {
        try { it.handle.stop?.(); } catch (_) {}
        try { it.handle.setShown?.(false); } catch (_) {}
        this._activeHandles.splice(i, 1);
        continue;
      }
      if (!it.rootStopped && it.stopRootAtMs && it.ageMs >= it.stopRootAtMs) {
        it.rootStopped = true;
        try { it.handle.stopRoot?.(); } catch (_) {}
      }
      if (it.hardStopAtMs && it.ageMs >= it.hardStopAtMs) {
        try { it.handle.stop?.(); } catch (_) {}
        try { it.handle.setShown?.(false); } catch (_) {}
        this._activeHandles.splice(i, 1);
        continue;
      }
      if (it.isProjectile && !it.arrived) {
        it.travelElapsedMs += stepMs;
        if (it.targetRef && Number.isFinite(it.targetRef.x) && Number.isFinite(it.targetRef.z)) {
          it.endX = it.targetRef.x;
          it.endZ = it.targetRef.z;
        }
        const u = Math.min(1, it.travelElapsedMs / it.travelMs);
        const dx = it.endX - it.startX;
        const dz = it.endZ - it.startZ;
        const segLen = Math.hypot(dx, dz) || 1;
        const rvx = -dz / segLen;
        const rvz = dx / segLen;
        const arcSin = Math.sin(u * Math.PI);
        const curX = it.startX + dx * u + rvx * it.sideArc * arcSin;
        const curZ = it.startZ + dz * u + rvz * it.sideArc * arcSin;
        const curY = it.startY + (it.endY - it.startY) * u + it.arcHeight * arcSin;
        it.handle.setLocation(curX, curY, curZ);
        if (!it.lockWorldYaw && segLen > 0.05) {
          it.handle.setRotation(it.pitchOffset, Math.atan2(dx, dz) + it.yawOffset, it.rollOffset);
        }
        if (u >= 1) {
          it.arrived = true;
          if (it.stopOnArrive) {
            try { it.handle.stopRoot?.(); } catch (_) {}
            it.hardStopAtMs = Math.min(it.hardStopAtMs || 99999, it.ageMs + 240);
          }
        }
      } else if (it.followDash && it.casterRef) {
        it.handle.setLocation(
          (it.casterRef.x || 0) + (it.dxOffset || 0),
          (it.casterRef.y || 0) + it.yOffset,
          (it.casterRef.z || 0) + (it.dzOffset || 0)
        );
      }
    }
  }

  update(dt) {
    if (!this.ready || !this.context) return;
    const clampedDt = Math.min(0.06, Math.max(0, Number(dt) || 0));
    const dtMs = clampedDt * 1000;
    this._elapsedClockMs += dtMs;

    if (this._scheduled.length > 0) {
      for (let i = this._scheduled.length - 1; i >= 0; i--) {
        if (this._elapsedClockMs >= this._scheduled[i].fireAtMs) {
          const item = this._scheduled.splice(i, 1)[0];
          item.fn();
        }
      }
    }

    this._syncFollowHandles(dtMs);
    this.context.update(clampedDt * 60.0);
  }

  draw(renderer, camera) {
    if (!this.ready || !this.context || !renderer || !camera) return;
    if (this._activeHandles.length === 0) return;

    camera.updateMatrixWorld?.();
    let needsDistortion = false;
    for (let i = 0; i < this._activeHandles.length; i++) {
      if (this._activeHandles[i].useDistortion) {
        needsDistortion = true;
        break;
      }
    }
    if (needsDistortion) {
      const canvas = renderer.domElement;
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        try {
          this.context.captureBackground(0, 0, canvas.width, canvas.height);
        } catch (_) {
          // Safe fallback if background capture unsupported on software driver
        }
      }
    }
    this.context.setProjectionMatrix(camera.projectionMatrix.elements);
    this.context.setCameraMatrix(camera.matrixWorldInverse.elements);
    this.context.draw();
    renderer.resetState();
  }

  stopAll() {
    this._scheduled.length = 0;
    this._activeHandles.length = 0;
    for (const t of this._pendingTimers) clearTimeout(t);
    this._pendingTimers.clear();
    if (this.ready && this.context) {
      this.context.stopAll();
    }
  }

  dispose(forceRelease = false) {
    this.stopAll();
    if (!forceRelease) return;
    if (this.ready && this.context) {
      for (const eff of this._resolvedEffects.values()) {
        if (eff) {
          try {
            this.context.releaseEffect?.(eff);
          } catch (_) {}
        }
      }
      if (typeof window !== 'undefined' && window.effekseer) {
        try {
          window.effekseer.releaseContext(this.context);
        } catch (_) {}
      }
    }
    this._resolvedEffects.clear();
    this._effectCache.clear();
    this.context = null;
    this.renderer = null;
    this.ready = false;
    this._initPromise = null;
  }
}
