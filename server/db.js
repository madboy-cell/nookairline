// server/db.js — dual-write persistence (Section 21.F.2).
// RAM is the source of truth at runtime; dirty state flushes every 5s (and on shutdown)
// atomically to server/data/local_db.json, and best-effort upserts to Supabase when
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured.
import fs from 'node:fs';
import path from 'node:path';

const FLUSH_MS = 5000;

export class Database {
  constructor(file, { log = console } = {}) {
    this.file = file;
    this.log = log;
    this.profiles = new Map();
    this.sessions = new Map();   // token -> { userId, created }
    this.socialLinks = [];       // [{ a, b, status: 'friend'|'couple', streak }]
    this.dirtyProfiles = new Set();
    this.dirty = false;
    this.supabase = null;
    this.timer = null;
  }

  async init() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (fs.existsSync(this.file)) {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const p of raw.profiles || []) this.profiles.set(p.id, p);
      for (const [t, s] of Object.entries(raw.sessions || {})) this.sessions.set(t, s);
      this.socialLinks = raw.socialLinks || [];
    }
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        this.supabase = createClient(url, key, { auth: { persistSession: false } });
        await this.mergeFromSupabase();
        this.log.info?.('[db] Supabase dual-write enabled');
      } catch (e) {
        this.log.warn?.('[db] Supabase disabled:', e.message);
        this.supabase = null;
      }
    }
    this.timer = setInterval(() => this.flush().catch((e) => this.log.error?.('[db] flush failed', e)), FLUSH_MS);
    this.timer.unref?.();
  }

  // Expected table: create table profiles (id text primary key, data jsonb, updated_at timestamptz default now());
  async mergeFromSupabase() {
    const { data, error } = await this.supabase.from('profiles').select('id, data');
    if (error) throw error;
    for (const row of data || []) {
      const local = this.profiles.get(row.id);
      if (!local || (row.data?.last_active_ts || 0) > (local.last_active_ts || 0)) this.profiles.set(row.id, row.data);
    }
  }

  getProfile(id) { return this.profiles.get(String(id).toLowerCase()); }

  putProfile(p) {
    this.profiles.set(p.id, p);
    this.markProfile(p.id);
  }

  markProfile(id) { this.dirtyProfiles.add(id); this.dirty = true; }
  markDirty() { this.dirty = true; }

  createSession(token, userId) { this.sessions.set(token, { userId, created: Date.now() }); this.dirty = true; }
  getSession(token) { return token ? this.sessions.get(token) : null; }

  snapshot() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      profiles: [...this.profiles.values()],
      sessions: Object.fromEntries(this.sessions),
      socialLinks: this.socialLinks,
    };
  }

  async flush() {
    if (!this.dirty) return;
    const ids = [...this.dirtyProfiles];
    this.dirtyProfiles.clear();
    this.dirty = false;
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.snapshot()));
    fs.renameSync(tmp, this.file);  // atomic on the same filesystem
    if (this.supabase && ids.length) {
      const rows = ids.map((id) => this.profiles.get(id)).filter(Boolean)
        .map((p) => ({ id: p.id, data: p, updated_at: new Date().toISOString() }));
      const { error } = await this.supabase.from('profiles').upsert(rows);
      if (error) {
        this.log.warn?.('[db] Supabase upsert failed, will retry:', error.message);
        ids.forEach((id) => this.dirtyProfiles.add(id));
        this.dirty = true;
      }
    }
  }

  async close() {
    clearInterval(this.timer);
    this.dirty = true;
    await this.flush();
  }
}
