/**
 * Sky Monopoly: Persistent Database & Match Storage Engine
 * Interacts with Supabase PostgreSQL (via REST API) with an atomic
 * local file fallback (data/monopoly_rooms.json) for 100% resilience.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://etultufhcdphrjplbren.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dWx0dWZoY2RwaHJqcGxicmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NDM1MzEsImV4cCI6MjEwNzMxOTUzMX0.old1fleZdZwgRz_88SZOVE_1Ysm2gkGtp1kBgpjSvZ0';

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'monopoly_rooms.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {}

class ServerDB {
  constructor() {
    this.url = SUPABASE_URL.replace(/\/$/, '');
    this.key = SUPABASE_KEY;
    this.headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
  }

  // --- Local Backup Helpers ---
  readLocalRooms() {
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
        return JSON.parse(raw) || {};
      }
    } catch (e) {
      console.warn('[ServerDB] Error reading local rooms backup:', e.message);
    }
    return {};
  }

  writeLocalRooms(roomsObj) {
    try {
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(roomsObj, null, 2), 'utf8');
    } catch (e) {
      console.warn('[ServerDB] Error writing local rooms backup:', e.message);
    }
  }

  // --- Supabase REST Operations ---

  /**
   * Saves or creates a room in the database.
   */
  async saveRoom(room) {
    if (!room || !room.id) return false;

    // 1. Write to local backup
    const local = this.readLocalRooms();
    local[room.id] = {
      id: room.id,
      code: room.code,
      flight_number: room.flightNumber,
      name: room.name,
      host_uid: room.hostUid,
      host_name: room.hostName,
      host_avatar: room.hostAvatar,
      is_public: !!room.isPublic,
      status: room.status || 'lobby',
      description: room.description || '',
      tags: room.tags || [],
      game: room.game || 'monopoly',
      auto_fill: !!room.autoFill,
      slots: room.slots || [],
      game_state: room.gameState || null,
      messages: room.messages || [],
      updated_at: new Date().toISOString()
    };
    this.writeLocalRooms(local);

    // 2. Write to Supabase REST
    try {
      const payload = {
        id: room.id,
        code: room.code,
        flight_number: room.flightNumber || `SKY-${room.code.slice(0, 3)}`,
        name: room.name,
        host_uid: room.hostUid,
        host_name: room.hostName,
        host_avatar: room.hostAvatar,
        is_public: room.isPublic !== undefined ? room.isPublic : true,
        status: room.status || 'lobby',
        description: room.description || null,
        tags: room.tags || [],
        game: room.game || 'monopoly',
        auto_fill: !!room.autoFill,
        slots: room.slots || [],
        game_state: room.gameState || null,
        messages: room.messages || []
      };

      const res = await fetch(`${this.url}/rest/v1/monopoly_rooms`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch (err) {
      console.warn('[ServerDB] Supabase saveRoom warning:', err.message);
      return false;
    }
  }

  /**
   * Updates partial room state in database.
   */
  async updateRoom(roomId, updates = {}) {
    if (!roomId) return false;

    // Update local backup
    const local = this.readLocalRooms();
    if (local[roomId]) {
      Object.assign(local[roomId], updates, { updated_at: new Date().toISOString() });
      this.writeLocalRooms(local);
    }

    // Update Supabase
    try {
      const res = await fetch(`${this.url}/rest/v1/monopoly_rooms?id=eq.${encodeURIComponent(roomId)}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({
          ...updates,
          updated_at: new Date().toISOString()
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[ServerDB] Supabase updateRoom warning:', err.message);
      return false;
    }
  }

  /**
   * Deletes a room or marks it finished.
   */
  async deleteRoom(roomId) {
    if (!roomId) return false;

    const local = this.readLocalRooms();
    delete local[roomId];
    this.writeLocalRooms(local);

    try {
      const res = await fetch(`${this.url}/rest/v1/monopoly_rooms?id=eq.${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
        headers: this.headers
      });
      return res.ok;
    } catch (err) {
      console.warn('[ServerDB] Supabase deleteRoom warning:', err.message);
      return false;
    }
  }

  /**
   * Upserts a player slot membership in the database.
   */
  async saveMember(roomId, member) {
    if (!roomId || !member || !member.uid) return false;
    try {
      const payload = {
        room_id: roomId,
        user_uid: member.uid,
        slot_id: member.slotId,
        role: member.role || null,
        name: member.name || 'Passenger',
        avatar: member.avatar || null,
        ready: !!member.ready,
        spectator: !!member.spectator,
        connected: member.connected !== undefined ? member.connected : true,
        disconnected_at: member.disconnectedAt ? new Date(member.disconnectedAt).toISOString() : null,
        last_active: new Date().toISOString()
      };

      const res = await fetch(`${this.url}/rest/v1/monopoly_room_members`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch (err) {
      console.warn('[ServerDB] Supabase saveMember warning:', err.message);
      return false;
    }
  }

  /**
   * Updates player connection status in database.
   */
  async updateMemberConnection(roomId, userUid, connected, disconnectedAt = null) {
    if (!roomId || !userUid) return false;
    try {
      const res = await fetch(
        `${this.url}/rest/v1/monopoly_room_members?room_id=eq.${encodeURIComponent(roomId)}&user_uid=eq.${encodeURIComponent(userUid)}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({
            connected: !!connected,
            disconnected_at: disconnectedAt ? new Date(disconnectedAt).toISOString() : null,
            last_active: new Date().toISOString()
          })
        }
      );
      return res.ok;
    } catch (err) {
      console.warn('[ServerDB] Supabase updateMemberConnection warning:', err.message);
      return false;
    }
  }

  /**
   * Removes member from room membership table.
   */
  async removeMember(roomId, userUid) {
    if (!roomId || !userUid) return false;
    try {
      const res = await fetch(
        `${this.url}/rest/v1/monopoly_room_members?room_id=eq.${encodeURIComponent(roomId)}&user_uid=eq.${encodeURIComponent(userUid)}`,
        {
          method: 'DELETE',
          headers: this.headers
        }
      );
      return res.ok;
    } catch (err) {
      console.warn('[ServerDB] Supabase removeMember warning:', err.message);
      return false;
    }
  }

  /**
   * Loads all active rooms (status !== 'finished') from database or backup.
   */
  async loadActiveRooms() {
    try {
      const res = await fetch(`${this.url}/rest/v1/monopoly_rooms?status=neq.finished&select=*`, {
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        }
      });
      if (res.ok) {
        const rooms = await res.json();
        if (Array.isArray(rooms) && rooms.length > 0) {
          console.log(`[ServerDB] Restored ${rooms.length} active room(s) from Supabase.`);
          return rooms;
        }
      }
    } catch (err) {
      console.warn('[ServerDB] Could not load active rooms from Supabase, falling back to local file:', err.message);
    }

    // Fallback to local file backup
    const local = this.readLocalRooms();
    const active = Object.values(local).filter((r) => r.status !== 'finished');
    if (active.length > 0) {
      console.log(`[ServerDB] Restored ${active.length} active room(s) from local storage.`);
    }
    return active;
  }
}

module.exports = new ServerDB();
