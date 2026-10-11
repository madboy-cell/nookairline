/**
 * Sky Party: Flight Room Registry & Matchmaking Engine
 * Handles room lifecycle, 6-digit flight code generation, seat occupancy,
 * host migration, and public room listings for the Flight Departure Board.
 */

class RoomRegistry {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
    this.codeToRoomId = new Map(); // 6-digit code -> roomId
    this.clientToRoomId = new Map(); // ws -> roomId
  }

  /**
   * Generates a collision-free 6-digit flight code (100000 - 999999).
   */
  generateRoomCode() {
    let attempts = 0;
    while (attempts < 50000) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      if (!this.codeToRoomId.has(code)) {
        return code;
      }
      attempts++;
    }
    // Fallback: timestamp-based 6-digit suffix
    return String(Date.now()).slice(-6);
  }

  /**
   * Creates a new flight room.
   */
  createRoom({
    hostUid = `user_${Math.random().toString(36).slice(2, 7)}`,
    hostName = 'Flight Captain 🛫',
    hostAvatar = 'assets/bkk_warrior_idle.png',
    hostRole = 'bkk',
    flightName = null,
    isPublic = true,
    slots = null,
    ws = null
  } = {}) {
    const roomId = `flight_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const code = this.generateRoomCode();
    const flightNumber = `SKY-${code.slice(0, 3)}`;
    const name = flightName || `${flightNumber} Express`;

    const defaultSlots = [
      { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true, occupiedBy: hostUid, name: hostName, avatar: hostAvatar },
      { id: 2, role: 'dxb', color: 'cyan', type: 'human', difficulty: null, ready: false, occupiedBy: null, name: 'Open Seat 1B', avatar: '' },
      { id: 3, role: 'bot1', color: 'emerald', type: 'bot', difficulty: 'easy', ready: true, occupiedBy: null, name: 'Trainee Mochi 🐾', avatar: 'assets/bot_mochi.jpg' },
      { id: 4, role: 'bot2', color: 'amber', type: 'bot', difficulty: 'hard', ready: true, occupiedBy: null, name: 'Capt. Whiskers 😼', avatar: 'assets/bot_captain.jpg' }
    ];

    const initialSlots = Array.isArray(slots) && slots.length === 4
      ? slots.map((s, idx) => ({
          ...s,
          id: idx + 1,
          occupiedBy: idx === 0 ? hostUid : (s.occupiedBy || null),
          name: idx === 0 ? hostName : (s.name || `Seat ${idx + 1}`),
          avatar: idx === 0 ? hostAvatar : (s.avatar || '')
        }))
      : defaultSlots;

    const room = {
      id: roomId,
      code,
      name,
      flightNumber,
      hostUid,
      hostName,
      hostAvatar,
      isPublic: !!isPublic,
      status: 'lobby', // 'lobby' | 'in_flight' | 'finished'
      slots: initialSlots,
      clients: new Set(),
      clientData: new Map(), // ws -> { uid, name, avatar, role, slotId }
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (ws) {
      room.clients.add(ws);
      room.clientData.set(ws, {
        uid: hostUid,
        name: hostName,
        avatar: hostAvatar,
        role: initialSlots[0].role,
        slotId: 1
      });
      this.clientToRoomId.set(ws, roomId);
    }

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(code, roomId);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  getRoomByCode(code) {
    const roomId = this.codeToRoomId.get(String(code).trim());
    return roomId ? this.getRoom(roomId) : null;
  }

  getClientRoom(ws) {
    const roomId = this.clientToRoomId.get(ws);
    return roomId ? this.getRoom(roomId) : null;
  }

  /**
   * Joins a room by roomId or 6-digit code.
   */
  joinRoom(roomIdOrCode, playerInfo = {}, ws = null) {
    let room = this.getRoom(roomIdOrCode);
    if (!room) {
      room = this.getRoomByCode(roomIdOrCode);
    }
    if (!room) {
      return { error: 'ROOM_NOT_FOUND', message: 'Flight not found or departed.' };
    }
    if (room.status === 'finished') {
      return { error: 'ROOM_CLOSED', message: 'This flight has already concluded.' };
    }

    const uid = playerInfo.uid || `guest_${Math.random().toString(36).slice(2, 7)}`;
    const name = playerInfo.name || 'Passenger ✈️';
    const avatar = playerInfo.avatar || 'assets/got_queen_idle.png';

    // If client is already in this room, return their assigned slot
    if (ws && room.clients.has(ws)) {
      const data = room.clientData.get(ws);
      const slot = room.slots.find((s) => s.id === data.slotId);
      return { success: true, room, slot, reconnected: true };
    }

    // Find first available open human slot (Slot 2, 3, or 4)
    const availableSlot = room.slots.find((s) => s.type === 'human' && !s.occupiedBy);
    if (!availableSlot) {
      return { error: 'ROOM_FULL', message: 'All boarding seats on this flight are occupied.' };
    }

    // Occupy the slot
    availableSlot.occupiedBy = uid;
    availableSlot.name = name;
    availableSlot.avatar = avatar;
    availableSlot.ready = true;

    if (ws) {
      room.clients.add(ws);
      room.clientData.set(ws, {
        uid,
        name,
        avatar,
        role: availableSlot.role,
        slotId: availableSlot.id
      });
      this.clientToRoomId.set(ws, room.id);
    }

    room.updatedAt = Date.now();
    return { success: true, room, slot: availableSlot };
  }

  /**
   * Handles a client disconnecting or exiting a room.
   */
  leaveRoom(ws) {
    const roomId = this.clientToRoomId.get(ws);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) {
      this.clientToRoomId.delete(ws);
      return null;
    }

    const data = room.clientData.get(ws);
    room.clients.delete(ws);
    room.clientData.delete(ws);
    this.clientToRoomId.delete(ws);

    if (!data) return { roomId, room, wasHost: false, empty: room.clients.size === 0 };

    const wasHost = data.slotId === 1 || data.uid === room.hostUid;
    const freedSlot = room.slots.find((s) => s.id === data.slotId);
    if (freedSlot) {
      freedSlot.occupiedBy = null;
      freedSlot.name = `Open Seat ${freedSlot.id === 1 ? '1A' : freedSlot.id === 2 ? '1B' : freedSlot.id === 3 ? '2A' : '2B'}`;
      freedSlot.avatar = '';
      freedSlot.ready = false;
    }

    // Remaining human players in this flight
    const remainingHumans = Array.from(room.clientData.values());

    if (remainingHumans.length === 0) {
      // Room is completely deserted -> mark finished and schedule cleanup
      room.status = 'finished';
      this.deleteRoom(roomId);
      return { roomId, room: null, wasHost, empty: true, deleted: true };
    }

    let newHost = null;
    if (wasHost && remainingHumans.length > 0) {
      // Migrate host to the next active passenger
      newHost = remainingHumans[0];
      room.hostUid = newHost.uid;
      room.hostName = newHost.name;
      room.hostAvatar = newHost.avatar;

      // Ensure the new host's slot is marked ready
      const hostSlot = room.slots.find((s) => s.id === newHost.slotId);
      if (hostSlot) hostSlot.ready = true;
    }

    room.updatedAt = Date.now();
    return { roomId, room, wasHost, newHost, empty: false };
  }

  /**
   * Updates flight privacy (public vs private code-only).
   */
  setPrivacy(roomId, isPublic, requesterWs = null) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (requesterWs) {
      const data = room.clientData.get(requesterWs);
      if (!data || data.uid !== room.hostUid) {
        return { error: 'NOT_AUTHORIZED', message: 'Only the flight captain can change privacy.' };
      }
    }
    room.isPublic = !!isPublic;
    room.updatedAt = Date.now();
    return { success: true, room };
  }

  /**
   * Host cycles or updates a slot in the room.
   */
  updateSlot(roomId, slotId, update = {}, requesterWs = null) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (requesterWs) {
      const data = room.clientData.get(requesterWs);
      if (!data || data.uid !== room.hostUid) {
        return { error: 'NOT_AUTHORIZED', message: 'Only the flight captain can configure seats.' };
      }
    }

    const slot = room.slots.find((s) => s.id === slotId);
    if (!slot) return null;
    if (slotId === 1) return { success: true, slot }; // Host seat is protected

    // Apply allowed fields
    if (update.type !== undefined) slot.type = update.type;
    if (update.difficulty !== undefined) slot.difficulty = update.difficulty;
    if (update.name !== undefined) slot.name = update.name;
    if (update.avatar !== undefined) slot.avatar = update.avatar;
    if (update.ready !== undefined) slot.ready = update.ready;

    room.updatedAt = Date.now();
    return { success: true, room, slot };
  }

  /**
   * Deletes a room and cleans all indices.
   */
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.codeToRoomId.delete(room.code);
    room.clients.forEach((ws) => this.clientToRoomId.delete(ws));
    this.rooms.delete(roomId);
  }

  /**
   * Returns a sanitized array of active public flights for the Departure Board.
   */
  listPublicRooms() {
    const now = Date.now();
    const result = [];

    this.rooms.forEach((room) => {
      if (!room.isPublic || room.status === 'finished') return;

      const activeHumans = room.slots.filter((s) => s.type === 'human' && s.occupiedBy).length;
      const openSeats = room.slots.filter((s) => s.type === 'human' && !s.occupiedBy).length;
      const totalSeats = room.slots.filter((s) => s.type !== 'closed').length;

      result.push({
        id: room.id,
        code: room.code,
        flightNumber: room.flightNumber,
        name: room.name,
        hostName: room.hostName,
        hostAvatar: room.hostAvatar,
        isPublic: room.isPublic,
        status: room.status,
        slots: room.slots,
        activeHumans,
        openSeats,
        totalSeats,
        createdAt: room.createdAt
      });
    });

    // Sort by status (boarding first, then in_flight), then by createdAt descending
    return result.sort((a, b) => {
      if (a.status === 'lobby' && b.status !== 'lobby') return -1;
      if (b.status === 'lobby' && a.status !== 'lobby') return 1;
      return b.createdAt - a.createdAt;
    });
  }

  /**
   * Cleans rooms with 0 connected clients older than maxAgeMs.
   */
  cleanStaleRooms(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;
    this.rooms.forEach((room, roomId) => {
      const isDead = room.status === 'finished' || (room.clients.size === 0 && now - room.updatedAt > maxAgeMs);
      if (isDead) {
        this.deleteRoom(roomId);
        cleaned++;
      }
    });
    return cleaned;
  }
}

module.exports = RoomRegistry;
