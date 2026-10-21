// client/js/net.js — REST auth + WebSocket session with reconnect, heartbeat replies and wake resync.
const TOKEN_KEY = 'neora.token';

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
};

async function api(path, body, method = body ? 'POST' : 'GET') {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

export const login = (username, password, lineage, appearance) =>
  api('/api/auth/login', { username, password, lineage, ...(appearance ? { appearance } : {}) });
export const fetchMe = () => api('/api/me');
export const claimA2HS = () => api('/api/a2hs/claim', {});
export const logoutApi = () => api('/api/auth/logout', {});
export const bindEmailApi = (email) => api('/api/auth/bind-email', { email });
export const changePasswordApi = (currentPassword, newPassword) =>
  api('/api/auth/change-password', { currentPassword, newPassword });

export class Net extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.closedByUser = false;
    this.retry = 0;
    this.retryTimer = 0;
    this.rtt = null;
    this.lastMoveSent = 0;
    this.zoneSeq = 1;
    this.resumeInstanceId = null;
    this._onVis = () => this.onVisibility();
    this._onOnline = () => {
      if (this.closedByUser) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!this.ws || this.ws.readyState === 2 || this.ws.readyState === 3) {
        this.retry = 0;
        this.connect();
      } else if (this.ws?.readyState === 1) {
        this.send({ type: 'auth_resume' });
      }
    };
    document.addEventListener('visibilitychange', this._onVis);
    if (typeof window !== 'undefined') window.addEventListener('online', this._onOnline);
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  on(type, fn) { this.addEventListener(type, (e) => fn(e.detail)); return this; }

  connect() {
    this.closedByUser = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = 0;
    if (this.ws) {
      const prev = this.ws;
      this.ws = null;
      try { prev.onopen = null; prev.onmessage = null; prev.onclose = null; prev.onerror = null; prev.close(); } catch {}
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      ws.send(JSON.stringify({ type: 'auth', token: session.token, instanceId: this.resumeInstanceId || undefined }));
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.zoneSeq) this.zoneSeq = m.zoneSeq;
      switch (m.type) {
        case 'ping': ws.send(JSON.stringify({ type: 'pong', t: m.t })); if (m.rtt != null) this.rtt = m.rtt; this.emit('status'); break;
        case 'auth_ok': this.connected = true; this.retry = 0; this.emit('status'); this.emit('auth_ok', m); break;
        case 'auth_fail': this.closedByUser = true; this.emit('auth_fail', m); break;
        case 'kicked': this.closedByUser = true; this.emit('kicked', m); break;
        default: this.emit(m.type, m);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.connected = false;
      this.emit('status');
      if (this.closedByUser) return;
      // Never auto-reconnect from a hidden background tab (prevents a sleeping tab from kicking the active foreground tab)
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const delay = this.retry === 0 ? 150 : Math.min(8000, 500 * 2 ** this.retry);
      this.retry++;
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = 0;
        if (!this.closedByUser && (typeof document === 'undefined' || document.visibilityState !== 'hidden')) {
          this.connect();
        }
      }, delay);
    };
    ws.onerror = () => {};
  }

  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  /** 15Hz while moving + one final packet when stopping. */
  sendMove(state, force = false) {
    const now = performance.now();
    if (!force && now - this.lastMoveSent < 66) return;
    this.lastMoveSent = now;
    this.send({ type: 'move_step', zoneSeq: this.zoneSeq, ...state });
  }

  onVisibility() {
    if (document.visibilityState !== 'visible' || this.closedByUser) return;
    if (this.ws?.readyState === 1) this.send({ type: 'auth_resume' });
    else if (!this.ws || this.ws.readyState === 2 || this.ws.readyState === 3) { this.retry = 0; this.connect(); }
  }

  close() {
    this.closedByUser = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = 0;
    if (this._onVis) document.removeEventListener('visibilitychange', this._onVis);
    const prev = this.ws;
    this.ws = null;
    try { prev?.close(); } catch {}
  }
}
