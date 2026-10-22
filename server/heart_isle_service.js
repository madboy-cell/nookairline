// server/heart_isle_service.js — Couples: Heart Isle + couple mailbox (Master Plan v2 §12).
// Persistence: db.getWorldZone / db.putWorldZone (kind 'heart_isle', zone id = heartIsleId(a, b)).
// Pure rules live in shared/couple_rules.js; this module only does I/O, item transfers and wiring.
import {
  HEART_ISLE, defaultHeartIsle, heartIsleId, canSend, dailySendCap, deposit, withdraw, splitCouple,
  restoreHeartIsle, placeDecor, removeDecor, decorFootprint,
} from '../shared/couple_rules.js';
import { heartReserved } from '../shared/village_rules.js';
import { hasItems, takeItems, addItems } from '../shared/production_rules.js';
import { storesOf } from './economy_service.js';

export const HEART_ISLE_KIND = 'heart_isle';
// Heart-Isle-only Monuments (catalog `heartIsleOnly`): placeable here when either partner owns them.
export const HEART_MONUMENTS = Object.freeze({ wnd_ferris: { w: 4, h: 4 } });
export const FERRIS_SPOT = Object.freeze({ x: 14, y: 3 });
const fpOf = (type) => HEART_MONUMENTS[type] || decorFootprint(type);
const overlaps = (decor, x, y, w, h) => (decor || []).find((d) => {
  const f = fpOf(d.type);
  return x < d.x + f.w && x + w > d.x && y < d.y + f.h && y + h > d.y;
}) || null;
const DAY_MS = 86_400_000;
const utcDay = (now) => Math.floor(now / DAY_MS);
const lower = (s) => String(s || '').toLowerCase();

/** `{ id: n }` or `[{ id, count }]` → clean `{ id: n }` (positive integers only), or null if invalid. */
export function normalizeItems(items) {
  const out = {};
  const entries = Array.isArray(items)
    ? items.map((it) => [it?.id || it?.item || it?.type, it?.count ?? it?.n ?? it?.amount ?? 1])
    : Object.entries(items && typeof items === 'object' ? items : {});
  for (const [id, raw] of entries) {
    if (!id || typeof id !== 'string') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return null;
    if (n > 0) out[id] = (out[id] || 0) + n;
  }
  return Object.keys(out).length ? out : null;
}

const cloneStores = (p) => JSON.parse(JSON.stringify(storesOf(p)));
const fitsIn = (p, items) => Object.keys(addItems(cloneStores(p), items).overflow).length === 0;

export function createHeartIsleService({
  db,
  now = Date.now,
  pushProfile = () => {},
  sendTo = () => {},
  onIsleChanged = () => {},
} = {}) {
  const partnerOf = (p) => (p?.partner_id ? db?.getProfile?.(p.partner_id) : null);
  const isBound = (p) => {
    const q = partnerOf(p);
    return !!(q && q.partner_id && lower(q.partner_id) === lower(p.id));
  };

  function load(a, b) {
    const rec = db?.getWorldZone?.(heartIsleId(a, b));
    return rec?.state || null;
  }
  function save(isle) {
    db?.putWorldZone?.(isle.id, HEART_ISLE_KIND, isle);
    return isle;
  }
  function ensure(a, b) {
    const existing = load(a, b);
    if (existing) return existing;
    const isle = defaultHeartIsle(a, b, now());
    adoptMonuments(isle);
    return save(isle);
  }

  const ownsMonument = (isle, type) => isle.owners.some((id) => db?.getProfile?.(id)?.village?.wonders?.[type]);

  /**
   * New isle: move an owned Couple Ferris Wheel onto the Heart Isle (and off a personal island, where
   * validateLayout now rejects it with `heart_isle_only`).
   */
  function adoptMonuments(isle) {
    if (!ownsMonument(isle, 'wnd_ferris')) return;
    isle.layout.decor.push({ id: 'wnd_ferris', type: 'wnd_ferris', x: FERRIS_SPOT.x, y: FERRIS_SPOT.y, placedBy: isle.owners[0] });
    for (const id of isle.owners) {
      const prof = db?.getProfile?.(id);
      const v = prof?.village;
      if (!Array.isArray(v?.buildings) || !v.buildings.some((b) => b.type === 'wnd_ferris')) continue;
      v.buildings = v.buildings.filter((b) => b.type !== 'wnd_ferris');
      db?.markProfile?.(id);
    }
  }

  /** Isle the player may see: the live isle when coupled, else the frozen Memory Isle with the last ex. */
  function isleFor(p) {
    if (isBound(p)) return { isle: ensure(p.id, p.partner_id), coupled: true };
    if (p?.last_partner_id) {
      const isle = load(p.id, p.last_partner_id);
      if (isle) return { isle, coupled: false };
    }
    return { isle: null, coupled: false };
  }

  /** Layout hook: the live isle for a couple instance (created lazily). */
  function isleForCouple(a, b) {
    return ensure(a, b);
  }

  function mailInfo(p, t = now()) {
    const day = utcDay(t);
    const sentToday = p.couple_mail?.day === day ? (p.couple_mail.sent || 0) : 0;
    const cap = dailySendCap(p.couple_since, t);
    return { day, sentToday, cap: cap === Infinity ? null : cap, remaining: cap === Infinity ? null : Math.max(0, cap - sentToday) };
  }

  function wire(isle) {
    if (!isle) return null;
    return {
      id: isle.id, owners: isle.owners, size: HEART_ISLE.size, decor: isle.layout?.decor || [],
      storage: isle.storage?.items || {}, ledger: isle.storage?.ledger || {},
      frozen: !!isle.frozen, frozenAt: isle.frozenAt || 0, createdAt: isle.createdAt || 0,
      allowedDecor: [...HEART_ISLE.decor, 'dec_nookairline_museum', ...Object.keys(HEART_MONUMENTS)],
    };
  }

  function stateOf(p) {
    const { isle, coupled } = isleFor(p);
    return {
      ok: true, coupled, frozen: !!isle?.frozen, isle: wire(isle),
      mail: coupled ? mailInfo(p) : null,
      stores: { warehouse: storesOf(p).warehouse.items, pantry: storesOf(p).pantry.items },
    };
  }

  function changed(isle, p) {
    save(isle);
    onIsleChanged(isle);
    const partner = db?.getProfile?.(isle.owners.find((o) => o !== p.id));
    if (partner) sendTo(partner.id, { type: 'heart_isle_update', isle: wire(isle) });
  }

  function liveIsleOr(p) {
    if (!isBound(p)) {
      const mem = p?.last_partner_id && load(p.id, p.last_partner_id);
      return { error: mem?.frozen ? 'frozen' : 'not_coupled' };
    }
    return { isle: ensure(p.id, p.partner_id) };
  }

  // ---------------------------------------------------------------- actions
  function place(p, m = {}) {
    const { isle, error } = liveIsleOr(p);
    if (!isle) return { ok: false, error };
    const x = Number(m.x), y = Number(m.y);
    // WS envelopes use `type` for the message kind, so the decor key travels as `decor` (alias `decorType`);
    // direct service calls may still pass `{ type: 'heart_arch' }`.
    const type = String(m.decor || m.decorType || (m.type && m.type !== 'hi_place' ? m.type : '') || '');
    const fp = fpOf(type);
    if (Number.isInteger(x) && Number.isInteger(y) && heartReserved(x, y, fp.w, fp.h)) {
      return { ok: false, error: x < 0 || y < 0 || x + fp.w > HEART_ISLE.size || y + fp.h > HEART_ISLE.size ? 'out_of_bounds' : 'reserved' };
    }
    // Monuments are 4×4 (couple_rules only knows decor footprints), so check overlap against true footprints.
    if (Number.isInteger(x) && Number.isInteger(y) && overlaps(isle.layout?.decor, x, y, fp.w, fp.h)) return { ok: false, error: 'overlap' };
    if (HEART_MONUMENTS[type]) {
      if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, error: 'bad_coords' };
      if (!ownsMonument(isle, type)) return { ok: false, error: 'not_owned' };
      if ((isle.layout?.decor || []).some((d) => d.type === type)) return { ok: false, error: 'already_placed' };
      const decor = { id: `${type}_${x}_${y}`, type, x, y, placedBy: p.id };
      (isle.layout ||= { decor: [] }).decor.push(decor);
      changed(isle, p);
      return { ok: true, decor, isle: wire(isle) };
    }
    const r = placeDecor(isle, p.id, { type, x, y });
    if (!r.ok) return r;
    changed(isle, p);
    return { ok: true, decor: r.decor, isle: wire(isle) };
  }

  function remove(p, m = {}) {
    const { isle, error } = liveIsleOr(p);
    if (!isle) return { ok: false, error };
    const ident = m.id ? String(m.id) : (Number.isInteger(m.x) && Number.isInteger(m.y) ? { x: m.x, y: m.y } : null);
    if (!ident) return { ok: false, error: 'not_found' };
    const r = removeDecor(isle, p.id, ident);
    if (!r.ok) return r;
    changed(isle, p);
    return { ok: true, removed: r.removed, isle: wire(isle) };
  }

  function depositItems(p, m = {}) {
    const { isle, error } = liveIsleOr(p);
    if (!isle) return { ok: false, error };
    const items = normalizeItems(m.items);
    if (!items) return { ok: false, error: 'bad_items' };
    if (items.gold) return { ok: false, error: 'not_depositable' };
    if (!hasItems(storesOf(p), items)) return { ok: false, error: 'missing_materials' };
    const r = deposit(isle, p.id, items, (it) => takeItems(storesOf(p), it));
    if (!r.ok) return r;
    changed(isle, p);
    return { ok: true, isle: wire(isle) };
  }

  function withdrawItems(p, m = {}) {
    const { isle, error } = liveIsleOr(p);
    if (!isle) return { ok: false, error };
    const items = normalizeItems(m.items);
    if (!items) return { ok: false, error: 'bad_items' };
    for (const [id, n] of Object.entries(items)) {
      if ((isle.storage?.items?.[id] || 0) < n) return { ok: false, error: 'insufficient_items', item: id };
    }
    if (!fitsIn(p, items)) return { ok: false, error: 'storage_full' };
    const r = withdraw(isle, p.id, items, (it) => { addItems(storesOf(p), it); return true; });
    if (!r.ok) return r;
    changed(isle, p);
    return { ok: true, isle: wire(isle) };
  }

  /** Couple mailbox: sender stores → partner stores, ramped daily cap, no gold / rare items. */
  function coupleSend(p, m = {}) {
    if (!isBound(p)) return { ok: false, error: 'not_coupled' };
    const partner = partnerOf(p);
    const items = normalizeItems(m.items);
    if (!items) return { ok: false, error: 'bad_items' };
    const t = now();
    const info = mailInfo(p, t);
    const chk = canSend({ items, coupleSince: p.couple_since, now: t, sentToday: info.sentToday });
    if (!chk.ok) return { ok: false, error: chk.error, cap: info.cap, remaining: info.remaining };
    if (!hasItems(storesOf(p), items)) return { ok: false, error: 'missing_materials' };
    if (!fitsIn(partner, items)) return { ok: false, error: 'partner_full' };
    takeItems(storesOf(p), items);
    addItems(storesOf(partner), items);
    const units = Object.values(items).reduce((s, n) => s + n, 0);
    p.couple_mail = { day: info.day, sent: info.sentToday + units };
    db?.markProfile?.(p.id);
    db?.markProfile?.(partner.id);
    pushProfile(partner);
    sendTo(partner.id, { type: 'social_notify', kind: 'couple_mail', from: p.id, fromName: p.username || p.id, items });
    return { ok: true, sent: items, mail: mailInfo(p, t) };
  }

  // ---------------------------------------------------------------- lifecycle hooks
  /** Couple bound: restore the old isle (re-couple with the same ex) or create a fresh one. */
  function onBind(a, b) {
    const existing = load(a.id, b.id);
    const isle = existing ? restoreHeartIsle(existing, now()) : defaultHeartIsle(a.id, b.id, now());
    save(isle);
    onIsleChanged(isle);
    return isle;
  }

  /** Couple broke up: split shared storage by ledger, refund into stores, freeze as Memory Isle. */
  function onBreak(a, b) {
    const t = now();
    const isle = load(a.id, b.id) || defaultHeartIsle(a.id, b.id, t);
    const { shares } = splitCouple(isle, t);
    const refunds = {};
    for (const prof of [a, b]) {
      if (!prof) continue;
      const share = shares[prof.id] || {};
      refunds[prof.id] = share;
      if (!Object.keys(share).length) continue;
      const { overflow } = addItems(storesOf(prof), share);
      if (Object.keys(overflow).length) {
        prof.frontier.campCrate ||= { items: {}, expiresAt: 0 };
        prof.frontier.campCrate.items ||= {};
        for (const [id, n] of Object.entries(overflow)) prof.frontier.campCrate.items[id] = (prof.frontier.campCrate.items[id] || 0) + n;
      }
      db?.markProfile?.(prof.id);
    }
    save(isle);
    onIsleChanged(isle);
    return { isle, shares: refunds };
  }

  /** WS dispatcher for `hi_*` and `couple_send`. Returns an action result (or null if unknown). */
  function handle(p, m = {}) {
    switch (m.type) {
      case 'hi_state': return stateOf(p);
      case 'hi_place': return place(p, m);
      case 'hi_remove': return remove(p, m);
      case 'hi_deposit': return depositItems(p, m);
      case 'hi_withdraw': return withdrawItems(p, m);
      case 'couple_send': return coupleSend(p, m);
      default: return null;
    }
  }

  return {
    load, save, ensure, isleFor, isleForCouple, stateOf, wire, mailInfo,
    place, remove, deposit: depositItems, withdraw: withdrawItems, coupleSend, onBind, onBreak, handle,
  };
}
