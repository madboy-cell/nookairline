// server/db.js — dual-write persistence (Section 21.F.2) + Railway/Supabase cloud sync.
// RAM is the source of truth at runtime; dirty state flushes every 5s (and on shutdown)
// atomically to server/data/local_db.json (unless ':memory:'), and best-effort upserts to Supabase
// when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured.
import fs from 'node:fs';
import path from 'node:path';

const FLUSH_MS = 5000;
const BATCH_SIZE = 100;
const DEFAULT_SUPABASE_URL = 'https://etultufhcdphrjplbren.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dWx0dWZoY2RwaHJqcGxicmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NDM1MzEsImV4cCI6MjEwNzMxOTUzMX0.old1fleZdZwgRz_88SZOVE_1Ysm2gkGtp1kBgpjSvZ0';

export class Database {
  constructor(file, { log = console } = {}) {
    this.file = file;
    this.log = log;
    this.profiles = new Map();
    this.sessions = new Map();   // token -> { userId, created }
    this.socialLinks = [];       // [{ a, b, status: 'friend'|'couple', streak }]
    this.dirtyProfiles = new Set();
    this.dirtySessions = new Set();
    this.deletedSessions = new Set();
    this.dirtySocial = false;
    this.dirty = false;
    this.supabase = null;
    this.timer = null;
  }

  async init() {
    if (this.file && this.file !== ':memory:') {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        for (const p of raw.profiles || []) this.profiles.set(p.id, p);
        for (const [t, s] of Object.entries(raw.sessions || {})) this.sessions.set(t, s);
        this.socialLinks = raw.socialLinks || [];
      }
    }
    const isTest =
      !this.file ||
      this.file === ':memory:' ||
      process.env.NODE_ENV === 'test' ||
      (Array.isArray(process.argv) && process.argv.some((a) => a.includes('test') || a.includes('tests/')));
    const url = process.env.SUPABASE_URL || (!isTest ? DEFAULT_SUPABASE_URL : '');
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      (!isTest ? DEFAULT_SUPABASE_KEY : '');
    if (url && key && !isTest) {
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

  // Expected primary table: create table profiles (id text primary key, data jsonb, updated_at timestamptz default now());
  async mergeFromSupabase() {
    const { data, error } = await this.supabase.from('profiles').select('id, data');
    if (error) throw error;
    const STAT_KEYS = [
      'bestStreak', 'callMinutes', 'callSessions', 'callDiamonds',
      'blessingsShared', 'giftsExchanged', 'momentsCaptured', 'coopActivities',
    ];
    for (const row of data || []) {
      if (!row?.data) continue;
      const local = this.profiles.get(row.id);
      if (!local) {
        this.profiles.set(row.id, row.data);
        continue;
      }
      const winner =
        (row.data.updated_at_ts || row.data.last_active_ts || 0) >
        (local.updated_at_ts || local.last_active_ts || 0)
          ? row.data
          : local;
      const other = winner === row.data ? local : row.data;
      if (winner.couple_stats || other.couple_stats) {
        winner.couple_stats = { ...(other.couple_stats || {}), ...(winner.couple_stats || {}) };
        for (const k of STAT_KEYS) {
          winner.couple_stats[k] = Math.max(local.couple_stats?.[k] || 0, row.data.couple_stats?.[k] || 0);
        }
      }
      winner.couple_streak = Math.max(local.couple_streak || 0, row.data.couple_streak || 0);
      if (Array.isArray(local.couple_album) || Array.isArray(row.data.couple_album)) {
        const mergedAlbum = [];
        const seenIds = new Set();
        for (const item of [...(winner.couple_album || []), ...(other.couple_album || [])]) {
          if (item?.id && !seenIds.has(item.id)) {
            mergedAlbum.push(item);
            seenIds.add(item.id);
          }
        }
        winner.couple_album = mergedAlbum;
      }
      if (Array.isArray(local.mailbox) || Array.isArray(row.data.mailbox)) {
        const byId = new Map();
        for (const m of [...(winner.mailbox || []), ...(other.mailbox || [])]) {
          if (!m || !m.id) continue;
          const prev = byId.get(m.id);
          if (!prev) byId.set(m.id, { ...m });
          else byId.set(m.id, { ...prev, ...m, claimed: Boolean(prev.claimed || m.claimed) });
        }
        winner.mailbox = [...byId.values()]
          .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
          .slice(0, 50);
      }
      this.profiles.set(row.id, winner);
    }

    // Optional tables: sessions & social_links (best-effort; gentle notice if not migrated yet)
    try {
      const sQuery = this.supabase.from('sessions')?.select?.('token, user_id, created_at');
      if (sQuery) {
        const { data: sData, error: sErr } = await sQuery;
        if (sErr) {
          this.log.info?.('[db] Optional sessions table not active yet:', sErr.message);
        } else {
          for (const row of sData || []) {
            if (row?.token && row?.user_id && !this.sessions.has(row.token)) {
              this.sessions.set(row.token, {
                userId: row.user_id,
                created: Number(row.created_at) || Date.now(),
              });
            }
          }
        }
      }
    } catch (e) {
      this.log.info?.('[db] Skipping optional sessions merge:', e.message);
    }

    try {
      const lQuery = this.supabase.from('social_links')?.select?.('data');
      if (lQuery) {
        const { data: lData, error: lErr } = await lQuery;
        if (lErr) {
          this.log.info?.('[db] Optional social_links table not active yet:', lErr.message);
        } else if (Array.isArray(lData) && lData.length > 0 && this.socialLinks.length === 0) {
          this.socialLinks = lData.map((r) => r?.data).filter(Boolean);
        }
      }
    } catch (e) {
      this.log.info?.('[db] Skipping optional social_links merge:', e.message);
    }
  }

  getProfile(id) { return this.profiles.get(String(id).toLowerCase()); }

  putProfile(p) {
    this.profiles.set(p.id, p);
    this.markProfile(p.id);
  }

  markProfile(id) {
    const p = this.profiles.get(id) || this.profiles.get(String(id || '').toLowerCase());
    if (p) p.updated_at_ts = Date.now();
    this.dirtyProfiles.add(id);
    this.dirty = true;
  }
  markDirty() { this.dirtySocial = true; this.dirty = true; }

  createSession(token, userId) {
    this.sessions.set(token, { userId, created: Date.now() });
    this.dirtySessions.add(token);
    this.deletedSessions.delete(token);
    this.dirty = true;
  }

  getSession(token) { return token ? this.sessions.get(token) : null; }

  deleteSession(token) {
    if (token && this.sessions.delete(token)) {
      this.dirtySessions.delete(token);
      this.deletedSessions.add(token);
      this.dirty = true;
    }
  }

  getStats() {
    return {
      mode: this.supabase ? 'supabase+local' : 'local',
      profiles: this.profiles.size,
      sessions: this.sessions.size,
      dirtyProfiles: this.dirtyProfiles.size,
    };
  }

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
    if (this._flushing) return this._flushPromise;
    if (!this.dirty) return;
    this._flushing = true;
    this._flushPromise = this._doFlush().finally(() => {
      this._flushing = false;
      this._flushPromise = null;
    });
    return this._flushPromise;
  }

  async _doFlush() {
    const ids = [...this.dirtyProfiles];
    const sessUpserts = [...this.dirtySessions];
    const sessDeletes = [...this.deletedSessions];
    this.dirtyProfiles.clear();
    this.dirtySessions.clear();
    this.deletedSessions.clear();
    this.dirtySocial = false;
    this.dirty = false;

    if (this.file && this.file !== ':memory:') {
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.snapshot()));
      fs.renameSync(tmp, this.file);  // atomic on the same filesystem
    }

    let profilesFailed = false;
    if (this.supabase && ids.length) {
      const nowIso = new Date().toISOString();
      const rows = ids
        .map((id) => this.profiles.get(id))
        .filter(Boolean)
        .map((p) => ({ id: p.id, data: p, cp: p.cp || 0, updated_at: nowIso }));

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await this.supabase.from('profiles').upsert(batch);
        if (error) {
          profilesFailed = true;
          this.log.warn?.('[db] Supabase upsert failed, will retry:', error.message);
          batch.forEach((r) => this.dirtyProfiles.add(r.id));
          this.dirty = true;
        }
      }
    }

    if (this.supabase && (sessUpserts.length || sessDeletes.length)) {
      if (profilesFailed) {
        sessUpserts.forEach((t) => this.dirtySessions.add(t));
        sessDeletes.forEach((t) => this.deletedSessions.add(t));
        this.dirty = true;
      } else {
        try {
          const nowIso = new Date().toISOString();
          const sessionRows = sessUpserts
            .map((token) => {
              const s = this.sessions.get(token);
              return s
                ? { token, user_id: s.userId, created_at: s.created, updated_at: nowIso }
                : null;
            })
            .filter(Boolean);

          if (sessionRows.length) {
            const upRes = await this.supabase.from('sessions')?.upsert?.(sessionRows, { onConflict: 'token' });
            if (upRes?.error) {
              this.log.warn?.('[db] Supabase sessions upsert failed, will retry:', upRes.error.message);
              sessUpserts.forEach((t) => this.dirtySessions.add(t));
              this.dirty = true;
            }
          }
          if (sessDeletes.length) {
            const delRes = await this.supabase.from('sessions')?.delete?.()?.in?.('token', sessDeletes);
            if (delRes?.error) {
              this.log.warn?.('[db] Supabase sessions delete failed, will retry:', delRes.error.message);
              sessDeletes.forEach((t) => this.deletedSessions.add(t));
              this.dirty = true;
            }
          }
        } catch (e) {
          this.log.info?.('[db] Optional sessions sync skipped:', e.message);
          sessUpserts.forEach((t) => this.dirtySessions.add(t));
          sessDeletes.forEach((t) => this.deletedSessions.add(t));
          this.dirty = true;
        }
      }
    }
  }

  async close() {
    clearInterval(this.timer);
    if (this._flushPromise) await this._flushPromise;
    this.dirty = true;
    await this.flush();
  }
}
