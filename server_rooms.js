/**
 * Sky Party: Flight Room Registry & Matchmaking Engine
 * Handles room lifecycle, 6-digit flight code generation, seat occupancy,
 * host migration, persistent database storage, and robust reconnection grace periods.
 */

const db = require('./server_db.js');

const DISCONNECT_LOBBY_GRACE_MS = 120 * 1000; // 2 minutes in lobby
const DISCONNECT_MATCH_GRACE_MS = 300 * 1000; // 5 minutes in match

class RoomRegistry {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
    this.codeToRoomId = new Map(); // 6-digit code -> roomId
    this.clientToRoomId = new Map(); // ws -> roomId
    this.disconnectedClients = new Map(); // uid -> { roomId, slotId, disconnectedAt, timer, role, name, avatar }
    this.disconnectTimers = new Map(); // uid -> Timeout
    this.db = db;
    this.startStaleRoomReaper();
  }

  /**
   * Identifies automated test rooms and mock hosts to prevent production pollution.
   */
  isTestRoom(room) {
    if (!room) return false;
    const uid = String(room.hostUid || room.host_uid || '');
    const name = String(room.hostName || room.host_name || '');
    const roomName = String(room.name || room.flightName || '');
    return uid.startsWith('test_') ||
      uid.startsWith('leave_') ||
      uid.startsWith('dup_') ||
      uid.startsWith('user_host_g') ||
      uid.startsWith('user_test') ||
      uid.startsWith('takeover_') ||
      uid.startsWith('host_') ||
      uid === 'u_host' ||
      uid === 'player_alpha' ||
      uid.startsWith('user_eep') ||
      uid.startsWith('user_6ei') ||
      name.startsWith('Host F') ||
      name.startsWith('Captain Takeover') ||
      name.startsWith('Pilot Bob') ||
      name.startsWith('Captain Widget') ||
      name.startsWith('VIP Captain') ||
      roomName.includes('Test Flight') ||
      roomName.includes('Master Flight') ||
      roomName.includes('Widget Express') ||
      roomName.includes('Secret Penthouse') ||
      (uid.startsWith('f') && uid.includes('_host'));
  }

  /**
   * Restores active rooms from database or persistent file backup.
   */
  async initFromDatabase() {
    try {
      const activeRooms = await db.loadActiveRooms();
      if (Array.isArray(activeRooms)) {
        const now = Date.now();
        for (const raw of activeRooms) {
          if (!raw.id || !raw.code) continue;
          if (raw.status === 'finished') continue;

          const createdTime = raw.created_at ? new Date(raw.created_at).getTime() : now;
          const updatedTime = raw.updated_at ? new Date(raw.updated_at).getTime() : createdTime;
          const isLobbyStale = raw.status === 'lobby' && (now - updatedTime) > 2 * 60 * 1000;
          const isFlightStale = raw.status === 'in_flight' && (now - updatedTime) > 3 * 60 * 1000;
          const isStale = (now - updatedTime) > 10 * 60 * 1000 || isLobbyStale || isFlightStale;
          const isTestHost = this.isTestRoom(raw);

          if (isStale || isTestHost) {
            this.db.updateRoom(raw.id, { status: 'finished' }).catch(() => {});
            continue;
          }

          // Rebuild room object in memory
          const room = {
            id: raw.id,
            code: String(raw.code),
            name: raw.name || `SKY-${raw.code.slice(0, 3)} Express`,
            flightNumber: raw.flight_number || raw.flightNumber || `SKY-${raw.code.slice(0, 3)}`,
            hostUid: raw.host_uid || raw.hostUid,
            hostName: raw.host_name || raw.hostName || 'Captain',
            hostAvatar: raw.host_avatar || raw.hostAvatar || 'assets/bkk_warrior_idle.png',
            description: raw.description || 'Relaxed game, make friends! All are welcome ♡',
            tags: Array.isArray(raw.tags) ? raw.tags : ['Casual', 'Make Friends', 'Voice Chat'],
            game: raw.game || 'monopoly',
            autoFill: !!(raw.auto_fill || raw.autoFill),
            isPublic: raw.is_public !== undefined ? !!raw.is_public : (raw.isPublic !== undefined ? !!raw.isPublic : true),
            status: raw.status || 'lobby',
            slots: Array.isArray(raw.slots) ? raw.slots : [],
            gameState: raw.game_state || raw.gameState || null,
            messages: Array.isArray(raw.messages) ? raw.messages : [],
            clients: new Set(),
            clientData: new Map(),
            createdAt: raw.created_at ? new Date(raw.created_at).getTime() : Date.now(),
            updatedAt: raw.updated_at ? new Date(raw.updated_at).getTime() : Date.now()
          };

          // Ensure all slots are marked disconnected initially (since server just started)
          room.slots.forEach((s) => {
            if (s.occupiedBy) {
              s.connected = false;
              s.disconnectedAt = Date.now();
            }
          });

          this.rooms.set(room.id, room);
          this.codeToRoomId.set(room.code, room.id);
        }
      }
    } catch (err) {
      console.warn('[RoomRegistry] initFromDatabase error:', err.message);
    }
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

    // Automatically close any previous lingering lobby room created by this host to prevent duplicate orphans
    this.closeExistingHostLobbyRoom(hostUid);

    const defaultSlots = [
      { id: 1, role: 'bkk', color: 'ruby', type: 'human', controller: 'HUMAN', difficulty: null, ready: true, occupiedBy: hostUid, name: hostName, avatar: hostAvatar, connected: true },
      { id: 2, role: 'dxb', color: 'cyan', type: 'human', controller: 'HUMAN', difficulty: null, ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
      { id: 3, role: 'bot1', color: 'emerald', type: 'bot', controller: 'BOT_PERMANENT', difficulty: 'easy', ready: true, occupiedBy: null, name: 'Trainee Mochi 🐾', avatar: 'assets/bot_mochi.jpg', connected: true },
      { id: 4, role: 'bot2', color: 'amber', type: 'bot', controller: 'BOT_PERMANENT', difficulty: 'hard', ready: true, occupiedBy: null, name: 'Capt. Whiskers 😼', avatar: 'assets/bot_captain.jpg', connected: true }
    ];

    const initialSlots = Array.isArray(slots) && slots.length === 4
      ? slots.map((s, idx) => {
          const type = s.type || 'human';
          const isHost = idx === 0;
          const isBot = type === 'bot';
          const isClosed = type === 'closed';

          const defaultBotName = (idx === 2)
            ? (s.difficulty === 'insane' ? 'Astral Sovereign 🌌' : s.difficulty === 'hard' ? 'Major Whiskers 🐯' : 'Cadet Mochi 🐣')
            : (idx === 3)
              ? (s.difficulty === 'insane' ? 'Chrono Sovereign ⏳' : s.difficulty === 'hard' ? 'Admiral Claw 🦁' : 'Pilot Pip 🐱')
              : (s.difficulty === 'insane' ? 'Apex Sovereign ⚡' : s.difficulty === 'hard' ? 'Capt. Whiskers 😼' : 'Trainee Mochi 🐾');

          return {
            ...s,
            id: idx + 1,
            type,
            controller: isBot ? 'BOT_PERMANENT' : (isClosed ? 'NONE' : 'HUMAN'),
            occupiedBy: isBot || isClosed ? null : (isHost ? hostUid : (s.occupiedBy || null)),
            name: isBot ? (s.name || defaultBotName) : (isClosed ? 'Closed Seat' : (isHost ? hostName : (s.name || 'Open Slot'))),
            avatar: isBot ? (s.avatar || 'assets/ui/neora_ref/avatar_bot_blue.png') : (isClosed ? '' : (isHost ? hostAvatar : (s.avatar || ''))),
            ready: isBot ? true : (isHost ? true : false),
            connected: isBot || isHost
          };
        })
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
      spectators: new Set(),
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
        }
      ],
      gameState: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (ws) {
      const prevRoomId = this.clientToRoomId.get(ws);
      if (prevRoomId && prevRoomId !== roomId) {
        const prevRoom = this.rooms.get(prevRoomId);
        if (prevRoom) {
          prevRoom.clients.delete(ws);
          prevRoom.clientData.delete(ws);
        }
      }
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

    // Persist to database asynchronously
    this.db.saveRoom(room).catch(() => {});
    this.db.saveMember(roomId, {
      uid: hostUid,
      slotId: 1,
      role: initialSlots[0].role,
      name: hostName,
      avatar: hostAvatar,
      ready: true,
      connected: true
    }).catch(() => {});

    return room;
  }

  /**
   * Closes any previous lobby room created by this host to prevent duplicate orphans.
   */
  closeExistingHostLobbyRoom(hostUid) {
    if (!hostUid) return;
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.status === 'lobby' && room.hostUid === hostUid) {
        console.log(`[RoomRegistry] Closing previous orphan lobby room ${roomId} for host ${hostUid}`);
        room.status = 'finished';
        this.deleteRoom(roomId);
      }
    }
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
   * Finds an active room where user occupies a seat.
   */
  findActiveRoomForUser(uid) {
    if (!uid) return null;
    for (const room of this.rooms.values()) {
      if (room.status === 'finished') continue;
      const slot = room.slots.find((s) => s.occupiedBy === uid);
      if (slot) {
        return {
          room,
          slot,
          inFlight: room.status === 'in_flight',
          gameState: room.gameState
        };
      }
    }
    return null;
  }

  /**
   * Generates a clean, authoritative Monopoly game state for a room's active slots.
   */
  createDefaultGameState(slots, startingMiles = 1200) {
    const activeSlots = (slots || []).filter((s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy));
    const turnOrder = activeSlots.map((s) => s.role || (s.id === 1 ? 'bkk' : s.id === 2 ? 'dxb' : s.id === 3 ? 'bot1' : 'bot2'));
    const players = {};
    activeSlots.forEach((s, idx) => {
      const role = s.role || (idx === 0 ? 'bkk' : idx === 1 ? 'dxb' : idx === 2 ? 'bot1' : 'bot2');
      const isBot = s.type === 'bot' || s.controller === 'BOT_TEMPORARY' || s.controller === 'BOT_PERMANENT';
      const isEasy = (s.difficulty || 'easy') === 'easy';
      const isInsane = (s.difficulty || 'easy') === 'insane';
      let botCostume = null;
      if (isBot && isInsane) {
        const mythics = [
          's1_naga_m', 's1_kinnaree_f', 's2_inari_m', 's2_inari_f', 's2_celestial_m', 's2_celestial_f',
          's3_djinn_m', 's3_djinn_f', 's3_phoenix_m', 's3_phoenix_f', 's4_royale_m', 's4_royale_f',
          's4_roulette_m', 's4_roulette_f', 's5_emperor_m', 's5_siren_f', 's5_leviathan_m', 's5_jellyfish_f',
          's6_supernova_m', 's6_supernova_f', 's6_aegis_m', 's6_aegis_f', 's7_sundrop_m', 's7_sundrop_f',
          's7_cinderella_m', 's7_cinderella_f', 's7_belle_m', 's7_belle_f', 's8_glacier_m', 's8_glacier_f',
          's9_olympus_m', 's9_olympus_f', 's10_frost_m', 's10_scarab_f', 's11_anubis_m', 's11_cleo_f'
        ];
        botCostume = mythics[Math.floor(Math.random() * mythics.length)];
      }
      players[role] = {
        id: role,
        pos: 0,
        miles: startingMiles,
        clashTokens: 2,
        vibePasses: 2,
        inventory: [],
        foxfireTails: 3,
        ashPot: 0,
        carpetCharges: 0,
        ult: 0,
        name: s.name || (isBot ? (idx === 2 ? (isEasy ? 'Cadet Mochi 🐣' : isInsane ? 'Astral Sovereign 🌌' : 'Major Whiskers 🐯') : (idx === 3 ? (isEasy ? 'Pilot Pip 🐱' : isInsane ? 'Chrono Sovereign ⏳' : 'Admiral Claw 🦁') : (isEasy ? 'Trainee Mochi 🐾' : isInsane ? 'Apex Sovereign ⚡' : 'Capt. Whiskers 😼'))) : `Player ${role.toUpperCase()}`),
        sprite: s.avatar || (isBot ? (isEasy ? 'assets/bot_mochi.jpg' : 'assets/bot_captain.jpg') : 'assets/bkk_warrior_idle.png'),
        badge: isBot ? (isInsane ? 'SOV' : `BOT${idx > 1 ? idx - 1 : ''}`) : `P${idx + 1}`,
        color: isInsane ? '#a855f7' : (s.id === 1 ? '#ef4444' : (s.id === 2 ? '#06b6d4' : (s.id === 3 ? '#10b981' : '#f59e0b'))),
        isBot,
        botLevel: isBot ? (s.difficulty || 'easy') : null,
        costume: botCostume,
        activeCostume: botCostume
      };
    });

    return {
      version: 2,
      active: true,
      mode: activeSlots.length > 2 ? '4p' : (activeSlots.some((s) => s.type === 'bot') ? 'bot' : 'couple'),
      round: 1,
      turnOrder,
      currentTurn: turnOrder[0] || 'bkk',
      isRolling: false,
      turnResolver: null,
      players,
      properties: {},
      pendingDecision: null,
      activeChallenge: null,
      activeDuel: null,
      magnet: null,
      cardDeck: [],
      playedCardIds: [],
      gameOver: null
    };
  }

  /**
   * Joins a room by roomId or 6-digit code.
   * Handles duplicate sessions, re-admissions, and spectators.
   */
  joinRoom(roomIdOrCode, playerInfo = {}, ws = null) {
    let room = this.getRoom(roomIdOrCode);
    if (!room) {
      room = this.getRoomByCode(roomIdOrCode);
    }

    // Reference room support for testing
    if (!room && typeof roomIdOrCode === 'string' && roomIdOrCode.startsWith('sample_')) {
      const sampleDefs = {
        sample_chill_game: {
          name: 'Monopoly · Chill Game',
          tags: ['Casual', 'Make Friends', 'Voice Chat'],
          description: 'Relaxed game, make friends! All are welcome ♡',
          slots: [
            { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'host_nook', name: 'Nook ✈️', avatar: 'assets/ui/neora_ref/avatar_nook.png', connected: true },
            { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'user_luna', name: '⭐ Luna ⭐', avatar: 'assets/ui/neora_ref/avatar_luna.png', connected: true },
            { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: true, occupiedBy: 'user_kai', name: 'Kai ✈️', avatar: 'assets/ui/neora_ref/avatar_kai.png', connected: true },
            { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false }
          ]
        },
        sample_newbie: {
          name: 'Monopoly · Newbie Friendly',
          tags: ['Beginner', 'Relaxed'],
          description: 'New to Sky Monopoly? Beginners welcomed and guided!',
          slots: [
            { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'momo', name: 'Momo 🌸', avatar: 'assets/ui/neora_ref/avatar_momo.png', connected: true },
            { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: true, occupiedBy: 'zephyr', name: 'Zephyr ⚡', avatar: 'assets/ui/neora_ref/avatar_zephyr.png', connected: true },
            { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
            { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false }
          ]
        },
        sample_fun: {
          name: 'Monopoly · Just for Fun',
          tags: ['Casual', 'Voice Chat'],
          description: 'No pressure game, casual chatting and music vibes.',
          slots: [
            { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'cherry', name: 'Cherry 🍒', avatar: 'assets/ui/neora_ref/avatar_cherry.png', connected: true },
            { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
            { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
            { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false }
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

    // 1. RECONNECTION CHECK: Is this user already occupying a seat in this room?
    const existingSlot = room.slots.find((s) => s.occupiedBy === uid);
    if (existingSlot) {
      // Clear any disconnect grace timer
      if (this.disconnectTimers.has(uid)) {
        clearTimeout(this.disconnectTimers.get(uid));
        this.disconnectTimers.delete(uid);
      }
      this.disconnectedClients.delete(uid);

      existingSlot.connected = true;
      existingSlot.disconnectedAt = null;
      if (playerInfo.name) existingSlot.name = playerInfo.name;
      if (playerInfo.avatar) existingSlot.avatar = playerInfo.avatar;

      if (ws) {
        // Displace previous socket if duplicate connection
        for (const [cWs, cData] of room.clientData.entries()) {
          if (cData.uid === uid && cWs !== ws) {
            room.clients.delete(cWs);
            room.clientData.delete(cWs);
            this.clientToRoomId.delete(cWs);
          }
        }
        room.clients.add(ws);
        room.clientData.set(ws, {
          uid,
          name: existingSlot.name,
          avatar: existingSlot.avatar,
          role: existingSlot.role,
          slotId: existingSlot.id
        });
        this.clientToRoomId.set(ws, room.id);
      }

      existingSlot.connected = true;
      existingSlot.controller = 'HUMAN';
      existingSlot.disconnectedAt = null;
      existingSlot.takeoverAt = null;
      if (this.botTakeoverManager) {
        this.botTakeoverManager.onPlayerReconnected(room, existingSlot, uid);
      }

      this.db.updateMemberConnection(room.id, uid, true, null).catch(() => {});
      this.db.updateRoom(room.id, { slots: room.slots }).catch(() => {});

      return {
        success: true,
        room,
        slot: existingSlot,
        reconnected: true,
        inFlight: room.status === 'in_flight',
        gameState: room.gameState
      };
    }

    // 2. Already connected socket in this room
    if (ws && room.clients.has(ws)) {
      const data = room.clientData.get(ws);
      const slot = room.slots.find((s) => s.id === data.slotId);
      return { success: true, room, slot, reconnected: true };
    }

    // 3. Spectator support: if requested or flight is already underway and user has no slot
    if (playerInfo.spectator || room.status === 'in_flight') {
      if (ws) {
        if (!room.spectators) room.spectators = new Set();
        room.spectators.add(ws);
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
      return { success: true, room, slot: null, spectator: true, gameState: room.gameState };
    }

    // 4. Find first available open human slot (Slot 2, 3, or 4)
    const availableSlot = room.slots.find((s) => s.type === 'human' && !s.occupiedBy);
    if (!availableSlot) {
      return { error: 'ROOM_FULL', message: 'All boarding seats on this flight are occupied.' };
    }

    // Occupy the slot
    availableSlot.occupiedBy = uid;
    availableSlot.name = name;
    availableSlot.avatar = avatar;
    availableSlot.ready = true;
    availableSlot.connected = true;
    availableSlot.controller = 'HUMAN';
    availableSlot.disconnectedAt = null;

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

    // Persist to database
    this.db.updateRoom(room.id, { slots: room.slots }).catch(() => {});
    this.db.saveMember(room.id, {
      uid,
      slotId: availableSlot.id,
      role: availableSlot.role,
      name,
      avatar,
      ready: true,
      connected: true
    }).catch(() => {});

    return { success: true, room, slot: availableSlot };
  }

  /**
   * Re-associates a client with their existing seat and authoritative state.
   */
  rejoinRoom(roomId, playerInfo = {}, ws = null) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { error: 'ROOM_NOT_FOUND', message: 'Flight not found or has concluded.' };
    }
    if (room.status === 'finished') {
      return { error: 'ROOM_CLOSED', message: 'This flight has already concluded.' };
    }

    const uid = playerInfo.uid;
    if (!uid) {
      return { error: 'INVALID_UID', message: 'User identifier required.' };
    }

    const existingSlot = room.slots.find((s) => s.occupiedBy === uid);
    if (!existingSlot) {
      return { error: 'SLOT_NOT_FOUND', message: 'No reserved seat found on this flight.' };
    }

    // Cancel any active disconnect timer
    if (this.disconnectTimers.has(uid)) {
      clearTimeout(this.disconnectTimers.get(uid));
      this.disconnectTimers.delete(uid);
    }
    this.disconnectedClients.delete(uid);

    const wasBotTakeover = existingSlot.controller === 'BOT_TEMPORARY';
    existingSlot.connected = true;
    existingSlot.disconnectedAt = null;
    existingSlot.takeoverAt = null;
    if (playerInfo.name) existingSlot.name = playerInfo.name;
    if (playerInfo.avatar) existingSlot.avatar = playerInfo.avatar;

    if (this.botTakeoverManager) {
      this.botTakeoverManager.onPlayerReconnected(room, existingSlot, uid);
    } else {
      existingSlot.controller = 'HUMAN';
    }

    if (ws) {
      // Displace any old socket for this user
      for (const [cWs, cData] of room.clientData.entries()) {
        if (cData.uid === uid && cWs !== ws) {
          room.clients.delete(cWs);
          room.clientData.delete(cWs);
          this.clientToRoomId.delete(cWs);
        }
      }
      room.clients.add(ws);
      room.clientData.set(ws, {
        uid,
        name: existingSlot.name,
        avatar: existingSlot.avatar,
        role: existingSlot.role,
        slotId: existingSlot.id
      });
      this.clientToRoomId.set(ws, room.id);
    }

    room.updatedAt = Date.now();

    this.db.updateMemberConnection(room.id, uid, true, null).catch(() => {});
    this.db.updateRoom(room.id, { slots: room.slots }).catch(() => {});

    return {
      success: true,
      room,
      slot: existingSlot,
      reconnected: true,
      inFlight: room.status === 'in_flight',
      gameState: room.gameState
    };
  }

  /**
   * Handles unexpected client network drops or browser refreshes.
   * Keeps the player's seat intact throughout the grace period.
   */
  handleDisconnect(ws) {
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
    if (room.spectators) room.spectators.delete(ws);
    this.clientToRoomId.delete(ws);

    if (data && data.spectator) {
      return { roomId, room, spectator: true, empty: room.clients.size === 0 };
    }

    if (!data || !data.uid) {
      return { roomId, room, empty: room.clients.size === 0 };
    }

    const uid = data.uid;
    const slot = room.slots.find((s) => s.id === data.slotId);
    if (slot && slot.occupiedBy === uid) {
      slot.connected = false;
      slot.disconnectedAt = Date.now();
    }

    // Persist disconnected state in DB
    this.db.updateMemberConnection(roomId, uid, false, Date.now()).catch(() => {});
    this.db.updateRoom(roomId, { slots: room.slots }).catch(() => {});

    // Trigger bot takeover manager
    if (this.botTakeoverManager && slot) {
      this.botTakeoverManager.onPlayerDisconnected(room, slot, uid);
    }

    // Set grace period timer
    const graceMs = room.status === 'in_flight' ? DISCONNECT_MATCH_GRACE_MS : DISCONNECT_LOBBY_GRACE_MS;

    if (this.disconnectTimers.has(uid)) {
      clearTimeout(this.disconnectTimers.get(uid));
    }

    const timer = setTimeout(() => {
      this.onGracePeriodExpired(roomId, uid, data.slotId);
    }, graceMs);

    this.disconnectTimers.set(uid, timer);
    this.disconnectedClients.set(uid, {
      roomId,
      slotId: data.slotId,
      disconnectedAt: Date.now(),
      name: data.name,
      avatar: data.avatar,
      role: data.role
    });

    room.updatedAt = Date.now();
    return { roomId, room, disconnectedUser: uid, slot, empty: room.clients.size === 0 };
  }

  /**
   * Fires when a player fails to reconnect before the grace period ends.
   */
  onGracePeriodExpired(roomId, uid, slotId) {
    this.disconnectTimers.delete(uid);
    this.disconnectedClients.delete(uid);

    const room = this.rooms.get(roomId);
    if (!room) return;

    const slot = room.slots.find((s) => s.id === slotId && s.occupiedBy === uid);
    if (slot) {
      console.log(`[RoomRegistry] Grace period expired for user ${uid} in room ${roomId}. Freeing seat.`);
      slot.occupiedBy = null;
      slot.name = `Open Slot`;
      slot.avatar = '';
      slot.ready = false;
      slot.connected = false;
      slot.disconnectedAt = null;

      this.db.removeMember(roomId, uid).catch(() => {});
      this.db.updateRoom(roomId, { slots: room.slots }).catch(() => {});
    }

    // If room is in lobby and no human players are left, clean up
    const remainingOccupants = room.slots.filter((s) => s.type === 'human' && s.occupiedBy);
    if (remainingOccupants.length === 0 && room.clients.size === 0) {
      console.log(`[RoomRegistry] Room ${roomId} deserted after disconnect grace. Closing room.`);
      room.status = 'finished';
      this.deleteRoom(roomId);
    }
  }

  /**
   * Handles an explicit client leave ("Leave Room" or "Back to Lobby").
   */
  leaveRoom(ws, { uid = null } = {}) {
    let roomId = ws ? this.clientToRoomId.get(ws) : null;
    let data = null;

    if (ws) {
      const room = this.rooms.get(roomId);
      if (room) {
        data = room.clientData.get(ws);
        room.clients.delete(ws);
        room.clientData.delete(ws);
      }
      this.clientToRoomId.delete(ws);
    }

    const targetUid = uid || (data && data.uid);
    if (!targetUid && !roomId) return null;

    let targetRoom = roomId ? this.rooms.get(roomId) : null;
    if (!targetRoom && targetUid) {
      for (const r of this.rooms.values()) {
        if (r.slots.some((s) => s.occupiedBy === targetUid)) {
          targetRoom = r;
          roomId = r.id;
          break;
        }
      }
    }

    if (!targetRoom) return null;

    // Clear any disconnect timers
    if (targetUid) {
      if (this.disconnectTimers.has(targetUid)) {
        clearTimeout(this.disconnectTimers.get(targetUid));
        this.disconnectTimers.delete(targetUid);
      }
      this.disconnectedClients.delete(targetUid);
      this.db.removeMember(targetRoom.id, targetUid).catch(() => {});
    }

    const wasHost = (data && data.slotId === 1) || targetRoom.hostUid === targetUid;
    const freedSlot = targetRoom.slots.find((s) => (targetUid && s.occupiedBy === targetUid) || (data && s.id === data.slotId));

    if (freedSlot) {
      freedSlot.occupiedBy = null;
      freedSlot.name = `Open Slot`;
      freedSlot.avatar = '';
      freedSlot.ready = false;
      freedSlot.connected = false;
      freedSlot.disconnectedAt = null;
    }

    // Remaining human players in this flight
    const remainingHumans = targetRoom.slots.filter((s) => s.type === 'human' && s.occupiedBy);

    if (remainingHumans.length === 0) {
      targetRoom.status = 'finished';
      this.deleteRoom(targetRoom.id);
      return { roomId: targetRoom.id, room: null, wasHost, empty: true, deleted: true };
    }

    let newHost = null;
    if (wasHost && remainingHumans.length > 0) {
      newHost = remainingHumans[0];
      targetRoom.hostUid = newHost.occupiedBy;
      targetRoom.hostName = newHost.name;
      targetRoom.hostAvatar = newHost.avatar;

      const hostSlot = targetRoom.slots.find((s) => s.id === newHost.id);
      if (hostSlot) hostSlot.ready = true;
    }

    targetRoom.updatedAt = Date.now();
    this.db.updateRoom(targetRoom.id, {
      slots: targetRoom.slots,
      host_uid: targetRoom.hostUid,
      host_name: targetRoom.hostName,
      host_avatar: targetRoom.hostAvatar
    }).catch(() => {});

    return { roomId: targetRoom.id, room: targetRoom, wasHost, newHost, empty: false };
  }

  /**
   * Finds an active in-flight room where the user is an active player.
   */
  getActiveInFlightRoomForUser(uid) {
    if (!uid) return null;
    for (const room of this.rooms.values()) {
      if (room.status === 'in_flight') {
        const slot = room.slots.find((s) => s.occupiedBy === uid);
        if (slot) {
          // If all human slots are disconnected and room has no connected clients, it's deserted — do not lock user out
          const connectedHumans = room.slots.filter((s) => s.type === 'human' && s.occupiedBy && s.connected);
          const hasClients = room.clients && room.clients.size > 0;
          if (!hasClients && connectedHumans.length === 0) {
            continue;
          }
          return room;
        }
      }
    }
    return null;
  }

  /**
   * Puts an in-flight player on temporary bot auto-pilot when they exit to lobby.
   */
  setPlayerAway(roomId, ws) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'in_flight') return null;
    const clientData = room.clientData.get(ws);
    if (!clientData) return null;
    const slot = room.slots.find((s) => s.id === clientData.slotId);
    if (!slot || slot.occupiedBy !== clientData.uid) return null;

    slot.controller = 'BOT_TEMPORARY';
    slot.takeoverAt = Date.now();
    if (this.botTakeoverManager) {
      if (room.gameState && room.gameState.currentTurn === slot.role) {
        this.botTakeoverManager.scheduleBotAction(room, slot.role, 800);
      }
    }
    return { success: true, room, slot };
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
    this.db.updateRoom(roomId, { is_public: room.isPublic }).catch(() => {});
    return { success: true, room };
  }

  /**
   * Host kicks a passenger from a seat.
   */
  kickPlayer(roomId, slotId, requesterWs = null) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (requesterWs) {
      const data = room.clientData.get(requesterWs);
      const isHostWs = data && (data.uid === room.hostUid || data.slotId === 1);
      if (!isHostWs) {
        return { error: 'NOT_AUTHORIZED', message: 'Only the flight captain can remove passengers.' };
      }
    }

    if (slotId === 1) return { error: 'CANNOT_KICK_HOST', message: 'Host seat cannot be removed.' };

    const slot = room.slots.find((s) => s.id === slotId);
    if (!slot) return null;

    let kickedWs = null;
    const kickedUid = slot.occupiedBy;
    const kickedName = slot.name;

    // Evict occupant websocket
    for (const [cWs, cData] of room.clientData.entries()) {
      if (cData.slotId === slotId || (kickedUid && cData.uid === kickedUid)) {
        kickedWs = cWs;
        room.clients.delete(cWs);
        room.clientData.delete(cWs);
        this.clientToRoomId.delete(cWs);
        break;
      }
    }

    // Reset slot to open seat
    slot.type = 'human';
    slot.controller = 'HUMAN';
    slot.occupiedBy = null;
    slot.ready = false;
    slot.connected = false;
    slot.name = 'Open Slot';
    slot.avatar = '';
    slot.difficulty = null;

    if (kickedUid) {
      this.db.removeMember(roomId, kickedUid).catch(() => {});
    }
    room.updatedAt = Date.now();
    this.db.updateRoom(roomId, { slots: room.slots }).catch(() => {});

    // System message
    room.messages.push({
      id: `msg_kick_${Date.now().toString(36)}`,
      uid: 'system',
      name: 'Flight System ✈️',
      avatar: 'assets/ui/neora_ref/avatar_nook.png',
      text: `${kickedName || 'Passenger'} was removed from Seat ${slotId}.`,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      timestamp: Date.now()
    });

    return { success: true, room, slot, kickedWs, kickedUid };
  }

  /**
   * Host cycles or updates a slot in the room.
   */
  updateSlot(roomId, slotId, update = {}, requesterWs = null) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (requesterWs) {
      const data = room.clientData.get(requesterWs);
      const isHostWs = data && (data.uid === room.hostUid || data.slotId === 1);
      if (!isHostWs) {
        return { error: 'NOT_AUTHORIZED', message: 'Only the flight captain can configure seats.' };
      }
    }

    const slot = room.slots.find((s) => s.id === slotId);
    if (!slot) return null;
    if (slotId === 1) return { success: true, room, slot }; // Host seat is protected

    let kickedWs = null;
    const prevOccupiedBy = slot.occupiedBy;

    // If seat was occupied by human player and new configuration clears them or changes slot type
    const isReplacingHuman = slot.type === 'human' && prevOccupiedBy && (update.type !== 'human' || update.occupiedBy === null || update.kick);
    if (isReplacingHuman) {
      for (const [cWs, cData] of room.clientData.entries()) {
        if (cData.slotId === slotId || cData.uid === prevOccupiedBy) {
          kickedWs = cWs;
          room.clients.delete(cWs);
          room.clientData.delete(cWs);
          this.clientToRoomId.delete(cWs);
          break;
        }
      }
      if (prevOccupiedBy) {
        this.db.removeMember(roomId, prevOccupiedBy).catch(() => {});
      }
    }

    // Apply allowed fields
    if (update.type !== undefined) {
      slot.type = update.type;
      if (update.type === 'bot') {
        slot.controller = 'BOT_PERMANENT';
        slot.occupiedBy = null;
        slot.ready = true;
        slot.connected = true;
        slot.difficulty = update.difficulty || slot.difficulty || 'easy';
        slot.name = update.name || (slot.difficulty === 'insane' ? 'Apex Sovereign ⚡' : slot.difficulty === 'hard' ? 'Capt. Whiskers 😼' : 'Trainee Mochi 🐾');
        slot.avatar = update.avatar || 'assets/ui/neora_ref/avatar_bot_blue.png';
      } else if (update.type === 'closed') {
        slot.controller = 'NONE';
        slot.occupiedBy = null;
        slot.ready = false;
        slot.connected = false;
        slot.difficulty = null;
        slot.name = update.name || 'Closed Seat';
        slot.avatar = '';
      } else if (update.type === 'human') {
        slot.controller = 'HUMAN';
        slot.difficulty = null;
        if (!update.occupiedBy) {
          slot.occupiedBy = null;
          slot.ready = false;
          slot.connected = false;
          slot.name = update.name || 'Open Slot';
          slot.avatar = '';
        }
      }
    }
    if (update.difficulty !== undefined) slot.difficulty = update.difficulty;
    if (update.name !== undefined) slot.name = update.name;
    if (update.avatar !== undefined) slot.avatar = update.avatar;
    if (update.ready !== undefined) slot.ready = update.ready;
    if (update.occupiedBy !== undefined) slot.occupiedBy = update.occupiedBy;

    room.updatedAt = Date.now();
    this.db.updateRoom(roomId, { slots: room.slots }).catch(() => {});
    return { success: true, room, slot, kickedWs };
  }

  /**
   * Deletes a room and cleans all indices.
   */
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Clear disconnect timers for members of this room
    room.slots.forEach((s) => {
      if (s.occupiedBy && this.disconnectTimers.has(s.occupiedBy)) {
        clearTimeout(this.disconnectTimers.get(s.occupiedBy));
        this.disconnectTimers.delete(s.occupiedBy);
        this.disconnectedClients.delete(s.occupiedBy);
      }
    });

    this.codeToRoomId.delete(room.code);
    room.clients.forEach((ws) => this.clientToRoomId.delete(ws));
    this.rooms.delete(roomId);
    this.db.deleteRoom(roomId).catch(() => {});
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

    this.db.updateRoom(roomId, { messages: room.messages }).catch(() => {});
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
    this.db.updateRoom(roomId, { slots: room.slots }).catch(() => {});
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
          s.connected = true;
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
          s.connected = false;
          s.occupiedBy = null;
          s.isAutoFilled = false;
        }
      });
    }
    room.updatedAt = Date.now();
    this.db.updateRoom(roomId, { slots: room.slots, auto_fill: room.autoFill }).catch(() => {});
    return { success: true, room };
  }

  /**
   * Updates and persists authoritative game state for an active flight.
   */
  updateGameState(roomId, state) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    room.gameState = state;
    room.updatedAt = Date.now();
    if (state && state.gameOver) {
      room.status = 'finished';
      this.db.updateRoom(roomId, { game_state: state, status: 'finished' }).catch(() => {});
    } else {
      this.db.updateRoom(roomId, { game_state: state }).catch(() => {});
    }
    return room;
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
    const now = Date.now();

    this.rooms.forEach((room) => {
      if (!room.isPublic || room.status === 'finished') return;

      const connectedCount = room.clients ? room.clients.size : 0;

      // 1. Hide in-flight games if 0 players are currently connected.
      // Spectating an abandoned match only displays an idle board.
      if (room.status === 'in_flight' && connectedCount === 0) {
        return;
      }

      // 2. Hide abandoned lobby rooms where all clients disconnected > 2 minutes ago
      const updatedTime = room.updatedAt || room.createdAt || now;
      if (room.status === 'lobby' && connectedCount === 0 && (now - updatedTime > 2 * 60 * 1000)) {
        return;
      }

      // 3. Filter out automated test hosts from public departure board
      if (this.isTestRoom(room)) return;

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
   * Returns public rooms. Never falls back to mock data in production!
   * In non-production test mode, can optionally merge sample rooms if explicitly requested.
   */
  listDisplayRooms(opts = {}) {
    const isProduction = process.env.NODE_ENV === 'production';
    const includeSample = !isProduction && (opts.includeSample === true || (opts.includeSample !== false && typeof opts.includeSample === 'undefined'));

    const realRooms = this.listPublicRooms();
    if (!includeSample) {
      return realRooms;
    }

    const now = Date.now();
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
      }
    ];

    const combined = [...realRooms];
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
   * Starts periodic background reaper that automatically sweeps deserted rooms every 30 seconds.
   */
  startStaleRoomReaper() {
    if (this._reaperInterval) clearInterval(this._reaperInterval);
    this._reaperInterval = setInterval(() => {
      try {
        this.cleanStaleRooms();
      } catch (err) {
        console.warn('[RoomRegistry] Stale reaper warning:', err.message);
      }
    }, 30 * 1000);
    if (this._reaperInterval && this._reaperInterval.unref) {
      this._reaperInterval.unref();
    }
  }

  /**
   * Cleans rooms with 0 connected clients older than maxAgeMs, deserted matches, or finished rooms.
   */
  cleanStaleRooms(maxAgeMs = 2 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;
    this.rooms.forEach((room, roomId) => {
      const lastActive = room.updatedAt || room.createdAt || now;
      const noClients = !room.clients || room.clients.size === 0;
      const connectedHumans = (room.slots || []).filter((s) => s.type === 'human' && s.occupiedBy && s.connected);

      // 1. Finished rooms can be removed immediately from memory
      if (room.status === 'finished') {
        this.deleteRoom(roomId);
        cleaned++;
        return;
      }

      // 2. Automated test rooms lingering with 0 clients or 0 connected humans
      if (this.isTestRoom(room) && (noClients || connectedHumans.length === 0)) {
        this.deleteRoom(roomId);
        cleaned++;
        return;
      }

      // 3. Stale deserted rooms older than maxAgeMs with 0 connected clients/humans
      if ((noClients || connectedHumans.length === 0) && (now - lastActive > maxAgeMs)) {
        room.status = 'finished';
        this.deleteRoom(roomId);
        cleaned++;
        return;
      }
    });
    return cleaned;
  }
}

module.exports = RoomRegistry;
