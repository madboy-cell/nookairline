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

export class Net extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.closedByUser = false;
    this.retry = 0;
    this.rtt = null;
    this.lastMoveSent = 0;
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  on(type, fn) { this.addEventListener(type, (e) => fn(e.detail)); return this; }

  connect() {
    this.closedByUser = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: session.token }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
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
      const delay = this.retry === 0 ? 0 : Math.min(8000, 500 * 2 ** this.retry);
      this.retry++;
      setTimeout(() => { if (!this.closedByUser) this.connect(); }, delay);
    };
    ws.onerror = () => {};
  }

  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  /** 15Hz while moving + one final packet when stopping. */
  sendMove(state, force = false) {
    const now = performance.now();
    if (!force && now - this.lastMoveSent < 66) return;
    this.lastMoveSent = now;
    this.send({ type: 'move_step', ...state });
  }

  onVisibility() {
    if (document.visibilityState !== 'visible' || this.closedByUser) return;
    if (this.ws?.readyState === 1) this.send({ type: 'auth_resume' });
    else if (!this.ws || this.ws.readyState === 3) { this.retry = 0; this.connect(); }
  }

  close() { this.closedByUser = true; this.ws?.close(); }
}
