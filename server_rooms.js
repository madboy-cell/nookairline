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
    name = null,
    description = 'Relaxed game, make friends! All are welcome ♡',
    tags = ['Casual', 'Make Friends', 'Voice Chat'],
    game = 'monopoly',
    isPublic = true,
    slots = null,
    autoFill = false,
    ws = null
  } = {}) {
    const roomId = `flight_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const code = this.generateRoomCode();
    const flightNumber = `SKY-${code.slice(0, 3)}`;
    const resolvedName = flightName || name || `${flightNumber} Express`;

    const defaultSlots = [
      { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true, occupiedBy: hostUid, name: hostName, avatar: hostAvatar },
      { id: 2, role: 'dxb', color: 'cyan', type: 'human', difficulty: null, ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
      { id: 3, role: 'bot1', color: 'emerald', type: 'bot', difficulty: 'easy', ready: true, occupiedBy: null, name: 'Trainee Mochi 🐾', avatar: 'assets/bot_mochi.jpg' },
      { id: 4, role: 'bot2', color: 'amber', type: 'bot', difficulty: 'hard', ready: true, occupiedBy: null, name: 'Capt. Whiskers 😼', avatar: 'assets/bot_captain.jpg' }
    ];

    const initialSlots = Array.isArray(slots) && slots.length === 4
      ? slots.map((s, idx) => ({
          ...s,
          id: idx + 1,
          occupiedBy: idx === 0 ? hostUid : (s.occupiedBy || null),
          name: idx === 0 ? hostName : (s.name || `Open Slot`),
          avatar: idx === 0 ? hostAvatar : (s.avatar || ''),
          ready: idx === 0 ? true : (s.ready !== undefined ? s.ready : (s.type === 'bot'))
        }))
      : defaultSlots;

    const room = {
      id: roomId,
      code,
      name: resolvedName,
      flightNumber,
      hostUid,
      hostName,
      hostAvatar,
      description: description || 'Relaxed game, make friends! All are welcome ♡',
      tags: Array.isArray(tags) ? tags : ['Casual', 'Make Friends', 'Voice Chat'],
      game: game || 'monopoly',
      autoFill: !!autoFill,
      isPublic: !!isPublic,
      status: 'lobby', // 'lobby' | 'in_flight' | 'finished'
      slots: initialSlots,
      clients: new Set(),
      clientData: new Map(), // ws -> { uid, name, avatar, role, slotId }
      messages: [
        {
          id: `msg_init_1`,
          uid: hostUid,
          name: hostName.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim() || 'Nook',
          avatar: hostAvatar || 'assets/ui/neora_ref/avatar_nook.png',
          text: "Welcome! Let's play together! 🎲",
          time: '8:12 PM',
          timestamp: Date.now() - 60000
        },
        {
          id: `msg_init_2`,
          uid: 'partner_luna',
          name: 'Luna',
          avatar: 'assets/ui/neora_ref/avatar_luna.png',
          text: 'Hi! 😊',
          time: '8:13 PM',
          timestamp: Date.now() - 40000
        },
        {
          id: `msg_init_3`,
          uid: 'partner_kai',
          name: 'Kai',
          avatar: 'assets/ui/neora_ref/avatar_kai.png',
          text: 'Ready!',
          time: '8:13 PM',
          timestamp: Date.now() - 25000
        },
        {
          id: `msg_init_4`,
          uid: 'partner_luna',
          name: 'Luna',
          avatar: 'assets/ui/neora_ref/avatar_luna.png',
          text: 'Waiting for one more~',
          time: '8:14 PM',
          timestamp: Date.now() - 10000
        }
      ],
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

    // If joining a sample/community room by ID, instantiate it into real active room
    if (!room && typeof roomIdOrCode === 'string' && roomIdOrCode.startsWith('sample_')) {
      const sampleDefs = {
        sample_chill_game: {
          name: 'Monopoly · Chill Game',
          tags: ['Casual', 'Make Friends', 'Voice Chat'],
          description: 'Relaxed game, make friends! All are welcome ♡',
          slots: [
            { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'host_nook', name: 'Nook ✈️', avatar: 'assets/ui/neora_ref/avatar_nook.png' },
            { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'user_luna', name: '⭐ Luna ⭐', avatar: 'assets/ui/neora_ref/avatar_luna.png' },
            { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: true, occupiedBy: 'user_kai', name: 'Kai ✈️', avatar: 'assets/ui/neora_ref/avatar_kai.png' },
            { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' }
          ]
        },
        sample_newbie: {
          name: 'Monopoly · Newbie Friendly',
          tags: ['Beginner', 'Relaxed'],
          description: 'New to Sky Monopoly? Beginners welcomed and guided!',
          slots: [
            { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'momo', name: 'Momo 🌸', avatar: 'assets/ui/neora_ref/avatar_momo.png' },
            { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'zephyr', name: 'Zephyr ⚡', avatar: 'assets/ui/neora_ref/avatar_zephyr.png' },
            { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
            { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' }
          ]
        },
        sample_fun: {
          name: 'Monopoly · Just for Fun',
          tags: ['Casual', 'Voice Chat'],
          description: 'No pressure game, casual chatting and music vibes.',
          slots: [
            { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'cherry', name: 'Cherry 🍒', avatar: 'assets/ui/neora_ref/avatar_cherry.png' },
            { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
            { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
            { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' }
          ]
        }
      };
      const def = sampleDefs[roomIdOrCode];
      if (def) {
        room = this.createRoom({
          flightName: def.name,
          tags: def.tags,
          description: def.description,
          slots: def.slots,
          isPublic: true
        });
      }
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

    // Spectator support: if requested or flight is already underway, admit as spectator observer
    if (playerInfo.spectator || room.status === 'in_flight') {
      if (ws) {
        room.clients.add(ws);
        room.clientData.set(ws, {
          uid,
          name,
          avatar,
          role: 'spectator',
          slotId: null,
          spectator: true
        });
        this.clientToRoomId.set(ws, room.id);
      }
      return { success: true, room, slot: null, spectator: true };
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
    if (update.type !== undefined) {
      slot.type = update.type;
      if (update.type === 'bot') {
        slot.occupiedBy = null;
        slot.ready = true;
      } else if (update.type === 'closed') {
        slot.occupiedBy = null;
        slot.ready = false;
      } else if (update.type === 'human' && !update.occupiedBy) {
        slot.occupiedBy = null;
        slot.ready = false;
      }
    }
    if (update.difficulty !== undefined) slot.difficulty = update.difficulty;
    if (update.name !== undefined) slot.name = update.name;
    if (update.avatar !== undefined) slot.avatar = update.avatar;
    if (update.ready !== undefined) slot.ready = update.ready;
    if (update.occupiedBy !== undefined) slot.occupiedBy = update.occupiedBy;

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
   * Appends an in-room chat message.
   */
  addMessage(roomId, { uid, name, avatar, text }) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uid: uid || 'guest',
      name: name || 'Passenger',
      avatar: avatar || 'assets/bkk_warrior_idle.png',
      text: String(text || '').trim(),
      time: timeStr,
      timestamp: Date.now()
    };
    if (!Array.isArray(room.messages)) room.messages = [];
    room.messages.push(msg);
    if (room.messages.length > 50) room.messages.shift();
    return msg;
  }

  /**
   * Toggles slot ready state.
   */
  toggleSlotReady(roomId, slotId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const slot = room.slots.find((s) => s.id === slotId);
    if (!slot) return null;
    slot.ready = !slot.ready;
    room.updatedAt = Date.now();
    return { success: true, room, slot };
  }

  /**
   * Host toggles Auto Fill for unoccupied slots.
   */
  toggleAutoFill(roomId, autoFill) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    room.autoFill = !!autoFill;
    if (room.autoFill) {
      room.slots.forEach((s) => {
        if (s.id > 1 && s.type === 'human' && !s.occupiedBy) {
          s.type = 'bot';
          s.difficulty = 'easy';
          s.name = s.id === 3 ? 'Trainee Mochi 🐾' : s.id === 4 ? 'Capt. Whiskers 😼' : 'Zephyr 🐾';
          s.avatar = s.id === 3 ? 'assets/bot_mochi.jpg' : s.id === 4 ? 'assets/bot_captain.jpg' : 'assets/ui/neora_bot_avatar.jpg';
          s.ready = true;
          s.isAutoFilled = true;
        }
      });
    } else {
      room.slots.forEach((s) => {
        if (s.id > 1 && s.isAutoFilled) {
          s.type = 'human';
          s.difficulty = null;
          s.name = 'Open Slot';
          s.avatar = '';
          s.ready = false;
          s.occupiedBy = null;
          s.isAutoFilled = false;
        }
      });
    }
    room.updatedAt = Date.now();
    return { success: true, room };
  }

  /**
   * Finds the best available public room with open seats for quick join.
   */
  findQuickJoinRoom() {
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.status === 'lobby') {
        const hasOpen = room.slots.some((s) => s.type === 'human' && !s.occupiedBy);
        if (hasOpen) return room;
      }
    }
    return null;
  }

  /**
   * Returns a sanitized array of active public flights for healthz and internal metrics.
   */
  listPublicRooms() {
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
        description: room.description || 'Relaxed game, make friends! All are welcome ♡',
        tags: room.tags || ['Casual', 'Make Friends', 'Voice Chat'],
        game: room.game || 'monopoly',
        autoFill: !!room.autoFill,
        activeHumans,
        openSeats,
        totalSeats,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
      });
    });

    return result.sort((a, b) => {
      if (a.status === 'lobby' && b.status !== 'lobby') return -1;
      if (b.status === 'lobby' && a.status !== 'lobby') return 1;
      return b.createdAt - a.createdAt;
    });
  }

  /**
   * Returns public rooms combined with community reference rooms for rich lobby browser display.
   */
  listDisplayRooms() {
    const now = Date.now();
    const result = this.listPublicRooms();

    // Provide default vibrant reference rooms if real public rooms count is small,
    // so the lobby always looks full and matches the reference design!
    const sampleRooms = [
      {
        id: 'sample_chill_game',
        code: '472910',
        flightNumber: 'SKY-472',
        name: 'Monopoly · Chill Game',
        hostName: 'Nook ✈️',
        hostAvatar: 'assets/ui/neora_ref/avatar_nook.png',
        isPublic: true,
        status: 'lobby',
        description: 'Relaxed game, make friends! All are welcome ♡',
        tags: ['Casual', 'Make Friends', 'Voice Chat'],
        game: 'monopoly',
        slots: [
          { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'host_nook', name: 'Nook', avatar: 'assets/ui/neora_ref/avatar_nook.png' },
          { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'user_luna', name: 'Luna', avatar: 'assets/ui/neora_ref/avatar_luna.png' },
          { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: true, occupiedBy: 'user_kai', name: 'Kai', avatar: 'assets/ui/neora_ref/avatar_kai.png' },
          { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' }
        ],
        activeHumans: 3,
        openSeats: 1,
        totalSeats: 4,
        createdAt: now - 120000,
        isSample: true
      },
      {
        id: 'sample_newbie',
        code: '839201',
        flightNumber: 'SKY-839',
        name: 'Monopoly · Newbie Friendly',
        hostName: 'Momo 🌸',
        hostAvatar: 'assets/ui/neora_ref/avatar_momo.png',
        isPublic: true,
        status: 'lobby',
        description: 'New to Sky Monopoly? Beginners welcomed and guided!',
        tags: ['Beginner', 'Relaxed'],
        game: 'monopoly',
        slots: [
          { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'momo', name: 'Momo', avatar: 'assets/ui/neora_ref/avatar_momo.png' },
          { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'zephyr', name: 'Zephyr', avatar: 'assets/ui/neora_ref/avatar_zephyr.png' },
          { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
          { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' }
        ],
        activeHumans: 2,
        openSeats: 2,
        totalSeats: 4,
        createdAt: now - 360000,
        isSample: true
      },
      {
        id: 'sample_pro_only',
        code: '902144',
        flightNumber: 'SKY-902',
        name: 'Monopoly · Pro Only',
        hostName: 'Jay ⚡',
        hostAvatar: 'assets/ui/neora_ref/avatar_jay.png',
        isPublic: true,
        status: 'in_flight',
        description: 'High roller tournament rules. Speed dice enabled.',
        tags: ['Competitive', 'Ranked'],
        game: 'monopoly',
        slots: [
          { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'jay', name: 'Jay', avatar: 'assets/ui/neora_ref/avatar_jay.png' },
          { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'mint', name: 'Mint', avatar: 'assets/ui/neora_ref/avatar_mint.png' },
          { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: true, occupiedBy: 'kuro', name: 'Kuro', avatar: 'assets/ui/neora_ref/avatar_kuro.png' },
          { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: true, occupiedBy: 'nari', name: 'Nari', avatar: 'assets/ui/neora_ref/avatar_nari.png' }
        ],
        activeHumans: 4,
        openSeats: 0,
        totalSeats: 4,
        createdAt: now - 600000,
        isSample: true
      },
      {
        id: 'sample_fun',
        code: '615204',
        flightNumber: 'SKY-615',
        name: 'Monopoly · Just for Fun',
        hostName: 'Cherry 🍒',
        hostAvatar: 'assets/ui/neora_ref/avatar_cherry.png',
        isPublic: true,
        status: 'lobby',
        description: 'No pressure game, casual chatting and music vibes.',
        tags: ['Casual', 'Voice Chat'],
        game: 'monopoly',
        slots: [
          { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'cherry', name: 'Cherry', avatar: 'assets/ui/neora_ref/avatar_cherry.png' },
          { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
          { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
          { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' }
        ],
        activeHumans: 1,
        openSeats: 3,
        totalSeats: 4,
        createdAt: now - 180000,
        isSample: true
      },
      {
        id: 'sample_afk',
        code: '334190',
        flightNumber: 'SKY-334',
        name: 'Monopoly · AFK Welcome',
        hostName: 'Zen 🍵',
        hostAvatar: 'assets/ui/neora_ref/avatar_zen.png',
        isPublic: true,
        status: 'finished',
        description: 'Casual game, bots play your turns if you step away.',
        tags: ['Casual', 'Chill'],
        game: 'monopoly',
        slots: [
          { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'zen', name: 'Zen', avatar: 'assets/ui/neora_ref/avatar_zen.png' },
          { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'rin', name: 'Rin', avatar: 'assets/ui/neora_ref/avatar_rin.png' },
          { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: true, occupiedBy: 'milo', name: 'Milo', avatar: 'assets/ui/neora_ref/avatar_milo.png' },
          { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: true, occupiedBy: 'sora', name: 'Sora', avatar: 'assets/ui/neora_ref/avatar_sora.png' }
        ],
        activeHumans: 4,
        openSeats: 0,
        totalSeats: 4,
        createdAt: now - 900000,
        isSample: true
      }
    ];

    const combined = [...result];
    sampleRooms.forEach((sr) => {
      if (!combined.some((r) => r.name === sr.name)) {
        combined.push(sr);
      }
    });

    return combined.sort((a, b) => {
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
