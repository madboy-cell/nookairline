/**
 * 🛫 NOOK AIRLINE — 10-AGENT REAL-TIME SWARM SIMULATOR
 *
 * Spawns 10 autonomous simulated personas connecting to http://localhost:3000:
 * - Room 1: Flight SKY-777 (4-Player Active In-Flight Match + Dedicated AI Spectator)
 * - Room 2: Flight SKY-888 (4-Player Active In-Flight Match)
 * - Room 3: Flight SKY-999 (Boarding Lounge with Open Seats for human flyers)
 * - Dedicated AI Spectator: Observer Zero 👁️ broadcasting cheers
 *
 * Humans can open http://localhost:3000 in their browser, click "Spectate" on SKY-777 or SKY-888,
 * and watch real-time turns, dice rolls, token hopping, property building, rent, and victory cycles!
 */

const { WebSocket } = require('ws');

const PORT = process.env.PORT || 3000;
const WS_URL = `ws://localhost:${PORT}/ws`;

console.log('================================================================================');
console.log('🛫 NOOK AIRLINE: 10-AGENT LIVE SIMULATION ENGINE');
console.log(`Connecting to: ${WS_URL}`);
console.log('================================================================================\n');

// ---------------------------------------------------------------------------
// 1. Board & Rules Definition
// ---------------------------------------------------------------------------
const MONOPOLY_TILES = [
  { id: 0, name: 'Departure Gate', shortName: 'START', zone: 'corner', type: 'start', price: 0, rent: 0 },
  { id: 1, name: 'Yaowarat Street', shortName: 'Yaowarat', zone: 'bkk', type: 'property', price: 100, rent: 30 },
  { id: 2, name: 'Siam Paragon', shortName: 'Paragon', zone: 'bkk', type: 'property', price: 140, rent: 45 },
  { id: 3, name: 'Chatuchak Market', shortName: 'Chatuchak', zone: 'bkk', type: 'property', price: 160, rent: 55 },
  { id: 4, name: 'Sky Casino', shortName: 'CASINO', zone: 'corner', type: 'casino', price: 0, rent: 0 },
  { id: 5, name: 'Dubai Gold Souk', shortName: 'Gold Souk', zone: 'dxb', type: 'property', price: 180, rent: 60 },
  { id: 6, name: 'Palm Jumeirah', shortName: 'Palm', zone: 'dxb', type: 'property', price: 220, rent: 75 },
  { id: 7, name: 'Airdrop Crate', shortName: 'AIRDROP', zone: 'special', type: 'airdrop', price: 0, rent: 0 },
  { id: 8, name: 'Burj Khalifa', shortName: 'Burj', zone: 'dxb', type: 'property', price: 260, rent: 90 },
  { id: 9, name: 'Sky Bridge', shortName: 'BRIDGE', zone: 'special', type: 'bridge', price: 0, rent: 0 },
  { id: 10, name: 'Black Market', shortName: 'MARKET', zone: 'corner', type: 'market', price: 0, rent: 0 },
  { id: 11, name: 'Shibuya Crossing', shortName: 'Shibuya', zone: 'tyo', type: 'property', price: 280, rent: 95 },
  { id: 12, name: 'Akihabara', shortName: 'Akiba', zone: 'tyo', type: 'property', price: 300, rent: 100 },
  { id: 13, name: 'Shinjuku Golden Gai', shortName: 'Shinjuku', zone: 'tyo', type: 'property', price: 320, rent: 110 },
  { id: 14, name: 'Takeover Arena', shortName: 'ARENA', zone: 'corner', type: 'arena', price: 0, rent: 0 },
  { id: 15, name: 'Paris Eiffel Tower', shortName: 'Paris', zone: 'eu', type: 'property', price: 340, rent: 115 },
  { id: 16, name: 'Santorini Caldera', shortName: 'Santorini', zone: 'eu', type: 'property', price: 360, rent: 125 },
  { id: 17, name: 'Winterfell Heart Tree', shortName: 'Winterfell', zone: 'got', type: 'property', price: 380, rent: 135 },
  { id: 18, name: 'The Red Keep', shortName: 'Red Keep', zone: 'got', type: 'property', price: 420, rent: 150 },
  { id: 19, name: 'Dragonstone Citadel', shortName: 'Dragonstone', zone: 'got', type: 'property', price: 450, rent: 165 }
];

const ZONE_TILES = {
  bkk: [1, 2, 3],
  dxb: [5, 6, 8],
  tyo: [11, 12, 13],
  eu:  [15, 16],
  got: [17, 18, 19]
};

const RENT_MULT = { 1: 1, 2: 4, 3: 12 };

// ---------------------------------------------------------------------------
// 2. Persona Definitions
// ---------------------------------------------------------------------------
const PERSONAS = [
  // Room 1: Flight SKY-777
  { id: 'usr_alex_01', name: 'Captain Alex 🐺',  role: 'bkk',  room: 'sky777', isHost: true,  avatar: 'assets/bkk_warrior_idle.png' },
  { id: 'usr_luna_02', name: 'Princess Luna 🐉', role: 'dxb',  room: 'sky777', isHost: false, avatar: 'assets/got_queen_idle.png' },
  { id: 'usr_kai_03',  name: 'Pilot Kai 🐺',     role: 'bot1', room: 'sky777', isHost: false, avatar: 'assets/bkk_warrior_idle.png' },
  { id: 'usr_momo_04', name: 'Sailor Momo 🐉',    role: 'bot2', room: 'sky777', isHost: false, avatar: 'assets/got_queen_idle.png' },

  // Room 2: Flight SKY-888
  { id: 'usr_roy_05',  name: 'Jetstream Roy 🐺',  role: 'bkk',  room: 'sky888', isHost: true,  avatar: 'assets/bkk_warrior_idle.png' },
  { id: 'usr_mira_06', name: 'Sky Queen Mira 🐉', role: 'dxb',  room: 'sky888', isHost: false, avatar: 'assets/got_queen_idle.png' },
  { id: 'usr_ken_07',  name: 'Aero Ken 🐺',      role: 'bot1', room: 'sky888', isHost: false, avatar: 'assets/bkk_warrior_idle.png' },
  { id: 'usr_ivy_08',  name: 'Stellar Ivy 🐉',    role: 'bot2', room: 'sky888', isHost: false, avatar: 'assets/got_queen_idle.png' },

  // Room 3: Flight SKY-999 (Open Boarding Lounge)
  { id: 'usr_neo_09',  name: 'Cloud Neo 🐺',      role: 'bkk',  room: 'sky999', isHost: true,  avatar: 'assets/bkk_warrior_idle.png' },

  // AI Dedicated Spectator for SKY-777
  { id: 'usr_zero_10', name: 'Observer Zero 👁️',  role: 'spec', room: 'sky777', isHost: false, avatar: 'assets/got_queen_idle.png', spectator: true }
];

const CHAT_PHRASES = [
  'Rolling for a double! 🎲',
  'Watch your step, that hotel charges serious rent! 🏨',
  'Nice turn! Collecting +200 miles passing START 🛫',
  'Gacha luck is paying off today! ✨',
  'Who wants to challenge in the Takeover Arena? ⚔️',
  'Spectators, welcome aboard Nook Airline! 🍿',
  'Clean landing on Dubai Gold Souk! 🍫',
  'Watch out for that Banana Peel! 🍌'
];

const SPECTATOR_CHEERS = [
  'Great roll Captain Alex! 🎉',
  'Princess Luna is building a monopoly in Dubai! 🏖️',
  'Spectator front row seat is thrilling! 🍿',
  'That hotel rent is brutal! 💥',
  'Go Kai! Clean turn! 🐺',
  'Loving this match! Keep it up everyone! 💖'
];

// ---------------------------------------------------------------------------
// 3. Virtual Agent WebSocket Client
// ---------------------------------------------------------------------------
function connectAgent(persona) {
  return new Promise((resolve, reject) => {
    const agentUrl = `${WS_URL}?uid=${encodeURIComponent(persona.id)}&username=${encodeURIComponent(persona.name)}&terminal=${persona.role === 'dxb' ? 'dxb' : 'bkk'}`;
    const ws = new WebSocket(agentUrl);
    ws.persona = persona;
    ws.inbox = [];

    const timeout = setTimeout(() => {
      reject(new Error(`Agent ${persona.name} connection timed out`));
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timeout);
      ws.send(JSON.stringify({
        type: 'identify',
        uid: persona.id,
        username: persona.name,
        terminal: persona.role === 'dxb' ? 'dxb' : 'bkk'
      }));
      resolve(ws);
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        ws.inbox.push(msg);
        if (ws.onPacket) ws.onPacket(msg);
      } catch (_) {}
    });

    ws.on('error', (err) => {
      console.warn(`[Agent ${persona.name}] Socket error:`, err.message);
    });
  });
}

function waitForPacket(ws, filterFn, timeoutMs = 8000) {
  for (let i = 0; i < ws.inbox.length; i++) {
    if (filterFn(ws.inbox[i])) {
      return Promise.resolve(ws.inbox.splice(i, 1)[0]);
    }
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for packet')), timeoutMs);
    const prevOnPacket = ws.onPacket;
    ws.onPacket = (msg) => {
      if (filterFn(msg)) {
        clearTimeout(timer);
        ws.onPacket = prevOnPacket;
        resolve(msg);
      } else if (prevOnPacket) {
        prevOnPacket(msg);
      }
    };
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// 4. Live Match Simulation Engine
// ---------------------------------------------------------------------------
class LiveMatchSimulation {
  constructor(roomKey, flightName, hostPersona, playerPersonas, sockets, onComplete) {
    this.roomKey = roomKey;
    this.flightName = flightName;
    this.hostPersona = hostPersona;
    this.playerPersonas = playerPersonas;
    this.sockets = sockets;
    this.onComplete = onComplete;
    this.finished = false;
    this.room = null;
    this.active = false;
    this.turnTimer = null;
    this.gameState = null;
  }

  getSocket(uid) {
    return this.sockets[uid];
  }

  async setupRoom() {
    const hostWs = this.getSocket(this.hostPersona.id);
    console.log(`[${this.roomKey}] Creating flight "${this.flightName}" hosted by ${this.hostPersona.name}...`);

    const slots = [
      { id: 1, role: 'bkk', color: 'ruby', type: 'human', controller: 'HUMAN', ready: true, occupiedBy: this.hostPersona.id, name: this.hostPersona.name, avatar: this.hostPersona.avatar, connected: true },
      { id: 2, role: 'dxb', color: 'cyan', type: 'human', controller: 'HUMAN', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
      { id: 3, role: 'bot1', color: 'emerald', type: 'human', controller: 'HUMAN', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
      { id: 4, role: 'bot2', color: 'amber', type: 'human', controller: 'HUMAN', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false }
    ];

    const pCreated = waitForPacket(hostWs, (m) => m.type === 'room_created');
    hostWs.send(JSON.stringify({
      type: 'room_create',
      hostUid: this.hostPersona.id,
      hostName: this.hostPersona.name,
      hostAvatar: this.hostPersona.avatar,
      flightName: this.flightName,
      isPublic: true,
      tags: ['Casual', 'Live Match', 'Spectate 👁️'],
      slots
    }));

    const res = await pCreated;
    this.room = res.room;
    console.log(`[${this.roomKey}] Room created with Flight No: ${this.room.flightNumber} (ID: ${this.room.id})`);

    // Other 3 players join and ready up
    for (let i = 1; i < this.playerPersonas.length; i++) {
      const p = this.playerPersonas[i];
      const pWs = this.getSocket(p.id);
      const pJoined = waitForPacket(pWs, (m) => m.type === 'room_joined');
      pWs.send(JSON.stringify({
        type: 'room_join',
        roomId: this.room.id,
        uid: p.id,
        name: p.name,
        avatar: p.avatar
      }));

      await pJoined;

      // Ready up
      pWs.send(JSON.stringify({
        type: 'room_toggle_ready',
        roomId: this.room.id
      }));
      await wait(300);
    }

    console.log(`[${this.roomKey}] All 4 seats boarded and ready!`);
  }

  initGameState() {
    const players = {};
    const turnOrder = ['bkk', 'dxb', 'bot1', 'bot2'];
    this.playerPersonas.forEach((p) => {
      players[p.role] = {
        id: p.role,
        pos: 0,
        position: 0,
        miles: 2500,
        name: p.name,
        sprite: p.avatar,
        bankrupt: false,
        inventory: [],
        color: p.role === 'bkk' ? '#ef4444' : p.role === 'dxb' ? '#06b6d4' : p.role === 'bot1' ? '#10b981' : '#f59e0b'
      };
    });

    this.gameState = {
      version: 2,
      active: true,
      mode: '4p',
      round: 1,
      turnOrder,
      currentTurn: 'bkk',
      isRolling: false,
      players,
      properties: {},
      stats: { rentPaid: {}, takeovers: {} },
      gameOver: null
    };
  }

  async startMatch() {
    this.initGameState();
    const hostWs = this.getSocket(this.hostPersona.id);
    console.log(`[${this.roomKey}] 🚀 Launching flight match for ${this.flightName}!`);

    hostWs.send(JSON.stringify({
      type: 'room_start',
      roomId: this.room.id,
      state: this.gameState
    }));

    this.active = true;
    this.scheduleNextTurn(2500);
  }

  scheduleNextTurn(delay = 4000) {
    if (!this.active) return;
    this.turnTimer = setTimeout(() => this.executeTurn(), delay);
  }

  calculateRent(tileId) {
    const tile = MONOPOLY_TILES[tileId];
    if (!tile || tile.type !== 'property') return 0;
    const prop = this.gameState.properties[tileId];
    if (!prop) return 0;

    let base = tile.rent * (RENT_MULT[prop.level] || 1);
    // Check zone monopoly
    const zTiles = ZONE_TILES[tile.zone] || [];
    const fullZone = zTiles.every((tid) => this.gameState.properties[tid]?.owner === prop.owner);
    if (fullZone) base *= 2;

    return base;
  }

  async executeTurn() {
    if (!this.active || !this.gameState) return;

    const currentTurn = this.gameState.currentTurn;
    const activePlayer = this.gameState.players[currentTurn];
    const persona = this.playerPersonas.find((p) => p.role === currentTurn);
    const pWs = this.getSocket(persona.id);

    if (!activePlayer || activePlayer.bankrupt) {
      this.advanceTurn();
      this.scheduleNextTurn(1000);
      return;
    }

    // 1. Roll Dice (1d6)
    const roll = Math.floor(Math.random() * 6) + 1;
    const oldPos = activePlayer.pos;
    const newPos = (oldPos + roll) % MONOPOLY_TILES.length;

    // Lap bonus if passed START (tile 0)
    let passedStart = newPos < oldPos && newPos !== 0;
    if (newPos === 0 || passedStart) {
      activePlayer.miles += 200;
      console.log(`[${this.roomKey}] ✈️ ${activePlayer.name} passed START and collected +200 miles!`);
    }

    activePlayer.pos = newPos;
    activePlayer.position = newPos;
    const landedTile = MONOPOLY_TILES[newPos];

    console.log(`[${this.roomKey}] 🎲 ${activePlayer.name} [${currentTurn.toUpperCase()}] rolled a ${roll} -> landed on [${newPos}] ${landedTile.name}`);

    // Broadcast roll
    pWs.send(JSON.stringify({
      type: 'monopoly_action',
      action: 'roll',
      playerKey: currentTurn,
      rollVal: roll,
      state: this.gameState
    }));

    // Wait 1.8s for token hop animation on spectators' screens
    await wait(1800);

    // 2. Resolve Landing Action
    if (landedTile.type === 'property') {
      const prop = this.gameState.properties[landedTile.id];
      if (!prop) {
        // Unowned: Buy with 85% probability
        if (activePlayer.miles >= landedTile.price && Math.random() < 0.85) {
          activePlayer.miles -= landedTile.price;
          this.gameState.properties[landedTile.id] = { owner: currentTurn, level: 1 };
          console.log(`[${this.roomKey}] 🏠 ${activePlayer.name} purchased ${landedTile.name} for ${landedTile.price}🪙!`);
          pWs.send(JSON.stringify({
            type: 'monopoly_action',
            action: 'buy',
            tileId: landedTile.id,
            state: this.gameState
          }));
        } else {
          pWs.send(JSON.stringify({
            type: 'monopoly_action',
            action: 'pass',
            tileId: landedTile.id,
            state: this.gameState
          }));
        }
      } else if (prop.owner === currentTurn) {
        // Own property: Upgrade if level < 3
        if (prop.level < 3 && activePlayer.miles >= Math.round(landedTile.price * 0.65) && Math.random() < 0.65) {
          const upgradeCost = Math.round(landedTile.price * 0.65);
          activePlayer.miles -= upgradeCost;
          prop.level += 1;
          const label = prop.level === 3 ? 'Grand Hotel 🏨' : '2 Houses 🏠🏠';
          console.log(`[${this.roomKey}] ✨ ${activePlayer.name} upgraded ${landedTile.name} to ${label}!`);
          pWs.send(JSON.stringify({
            type: 'monopoly_action',
            action: 'upgrade',
            tileId: landedTile.id,
            state: this.gameState
          }));
        }
      } else {
        // Opponent property: Pay rent!
        const ownerRole = prop.owner;
        const ownerPlayer = this.gameState.players[ownerRole];
        const rent = this.calculateRent(landedTile.id);
        const actualRent = Math.min(activePlayer.miles, rent);

        activePlayer.miles -= actualRent;
        if (ownerPlayer) ownerPlayer.miles += actualRent;

        console.log(`[${this.roomKey}] 💸 ${activePlayer.name} paid ${actualRent}🪙 rent to ${ownerPlayer ? ownerPlayer.name : ownerRole}!`);

        pWs.send(JSON.stringify({
          type: 'monopoly_action',
          action: 'rent',
          tileId: landedTile.id,
          state: this.gameState
        }));

        if (activePlayer.miles <= 0) {
          activePlayer.bankrupt = true;
          console.log(`[${this.roomKey}] 💀 ${activePlayer.name} went BANKRUPT!`);
        }
      }
    } else if (landedTile.type === 'casino') {
      // Casino spin
      const casinoWin = Math.random() < 0.5;
      const amt = casinoWin ? 200 : -100;
      activePlayer.miles = Math.max(50, activePlayer.miles + amt);
      console.log(`[${this.roomKey}] 🎰 ${activePlayer.name} spun Sky Casino: ${casinoWin ? '+200🪙' : '-100🪙'}!`);
      pWs.send(JSON.stringify({
        type: 'monopoly_action',
        action: 'state',
        ticker: `🎰 ${activePlayer.name} spun Sky Casino: ${casinoWin ? '+200🪙 Jackpots!' : 'Better luck next time!'}`,
        state: this.gameState
      }));
    }

    // Occasional in-flight chat
    if (Math.random() < 0.25) {
      const phrase = CHAT_PHRASES[Math.floor(Math.random() * CHAT_PHRASES.length)];
      pWs.send(JSON.stringify({
        type: 'room_chat',
        roomId: this.room.id,
        sender: { uid: persona.id, name: persona.name, avatar: persona.avatar },
        text: phrase
      }));
    }

    // 3. Advance Turn or Check Game Over
    const activeSurvivors = Object.keys(this.gameState.players).filter((r) => !this.gameState.players[r].bankrupt);
    const someoneReachedCap = Object.values(this.gameState.players).some((p) => p.miles >= 6000);

    if (activeSurvivors.length <= 1 || someoneReachedCap || this.gameState.round > 24) {
      const winnerRole = activeSurvivors[0] || 'bkk';
      const winner = this.gameState.players[winnerRole];
      console.log(`[${this.roomKey}] 👑 Match ended! Winner: ${winner.name}!`);
      this.gameState.gameOver = { winner: winnerRole, reason: 'conquest' };

      pWs.send(JSON.stringify({
        type: 'monopoly_action',
        action: 'state',
        state: this.gameState
      }));

      this.active = false;
      this.finished = true;
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }

      if (typeof this.onComplete === 'function') {
        this.onComplete(this);
      }
      return;
    }

    this.advanceTurn();
    this.scheduleNextTurn(2500);
  }

  advanceTurn() {
    const order = this.gameState.turnOrder;
    const curIdx = order.indexOf(this.gameState.currentTurn);
    let nextIdx = (curIdx + 1) % order.length;

    // Skip bankrupt players
    let attempts = 0;
    while (this.gameState.players[order[nextIdx]]?.bankrupt && attempts < 4) {
      nextIdx = (nextIdx + 1) % order.length;
      attempts++;
    }

    if (nextIdx <= curIdx) {
      this.gameState.round += 1;
      console.log(`[${this.roomKey}] 🏁 Round ${this.gameState.round} begun!`);
    }

    this.gameState.currentTurn = order[nextIdx];
  }
}

// ---------------------------------------------------------------------------
// 5. Main Swarm Orchestrator
// ---------------------------------------------------------------------------
async function startSwarm() {
  try {
    const socketMap = {};

    console.log('Connecting 10 virtual personas to server...');
    for (const p of PERSONAS) {
      const ws = await connectAgent(p);
      socketMap[p.id] = ws;
      console.log(`  ✓ Connected: ${p.name} (${p.id})`);
    }

    let spectatorCheerTimer = null;
    const activeSims = [];

    const handleSimulationComplete = (completedSim) => {
      console.log(`[${completedSim.roomKey}] 🏁 Simulation complete!`);
      const allDone = activeSims.every((s) => s.finished);
      if (allDone) {
        console.log('\n🏆 All simulated matches have finished!');
        console.log('⏳ Giving spectators 8 seconds to celebrate on the Victory Ceremony screen...');
        setTimeout(() => {
          console.log('👋 Quitting all 10 virtual agents and disconnecting...');
          if (spectatorCheerTimer) clearInterval(spectatorCheerTimer);
          for (const p of PERSONAS) {
            const ws = socketMap[p.id];
            if (ws && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'room_leave', uid: p.id }));
                ws.close();
              } catch (_) {}
            }
          }
          console.log('✨ All 10 agents successfully quit. Process exiting cleanly.');
          process.exit(0);
        }, 8000);
      }
    };

    // --- SETUP ROOM 1: FLIGHT SKY-777 ---
    const r1Host = PERSONAS[0];
    const r1Players = PERSONAS.slice(0, 4);
    const simR1 = new LiveMatchSimulation('SKY-777', 'Flight SKY-777 ✈️ High-Roller Express', r1Host, r1Players, socketMap, handleSimulationComplete);
    activeSims.push(simR1);
    await simR1.setupRoom();

    // AI Spectator joins SKY-777
    const specPersona = PERSONAS[9]; // Observer Zero
    const specWs = socketMap[specPersona.id];
    specWs.send(JSON.stringify({
      type: 'room_join',
      roomId: simR1.room.id,
      uid: specPersona.id,
      name: specPersona.name,
      avatar: specPersona.avatar,
      spectator: true
    }));
    console.log(`  ✓ Spectator ${specPersona.name} joined Flight SKY-777`);

    // Spectator periodic cheers
    spectatorCheerTimer = setInterval(() => {
      if (simR1.room && simR1.active) {
        const cheer = SPECTATOR_CHEERS[Math.floor(Math.random() * SPECTATOR_CHEERS.length)];
        specWs.send(JSON.stringify({
          type: 'room_chat',
          roomId: simR1.room.id,
          sender: { uid: specPersona.id, name: specPersona.name, avatar: specPersona.avatar },
          text: cheer
        }));
      }
    }, 15000);

    // --- SETUP ROOM 2: FLIGHT SKY-888 ---
    const r2Host = PERSONAS[4];
    const r2Players = PERSONAS.slice(4, 8);
    const simR2 = new LiveMatchSimulation('SKY-888', 'Flight SKY-888 🌌 Astral Odyssey', r2Host, r2Players, socketMap, handleSimulationComplete);
    activeSims.push(simR2);
    await simR2.setupRoom();

    // --- SETUP ROOM 3: FLIGHT SKY-999 (Boarding Lounge with Auto-Takeoff) ---
    const r3Host = PERSONAS[8];
    const r3Ws = socketMap[r3Host.id];
    console.log(`[SKY-999] Creating open boarding flight hosted by ${r3Host.name}...`);
    const pR3Created = waitForPacket(r3Ws, (m) => m.type === 'room_created');
    r3Ws.send(JSON.stringify({
      type: 'room_create',
      hostUid: r3Host.id,
      hostName: r3Host.name,
      hostAvatar: r3Host.avatar,
      flightName: 'Flight SKY-999 ☁️ Sunset Lounge (Auto-Start)',
      isPublic: true,
      tags: ['Relaxed', 'Auto-Start', 'Join to Play! ♡'],
      slots: [
        { id: 1, role: 'bkk', color: 'ruby', type: 'human', controller: 'HUMAN', ready: true, occupiedBy: r3Host.id, name: r3Host.name, avatar: r3Host.avatar, connected: true },
        { id: 2, role: 'dxb', color: 'cyan', type: 'human', controller: 'HUMAN', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
        { id: 3, role: 'bot1', color: 'emerald', type: 'human', controller: 'HUMAN', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false },
        { id: 4, role: 'bot2', color: 'amber', type: 'human', controller: 'HUMAN', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '', connected: false }
      ]
    }));

    const r3CreatedMsg = await pR3Created;
    const r3RoomId = r3CreatedMsg.room.id;
    console.log(`[SKY-999] Room created with Flight No: ${r3CreatedMsg.room.flightNumber} (ID: ${r3RoomId})`);

    // Listen for humans joining SKY-999 to auto-start
    let r3Launched = false;
    r3Ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'room_update' && msg.room && msg.room.id === r3RoomId && !r3Launched) {
          const humanGuests = (msg.room.slots || []).filter((s) => s.type === 'human' && s.occupiedBy && s.occupiedBy !== r3Host.id);
          if (humanGuests.length > 0) {
            r3Launched = true;
            console.log(`[SKY-999] 👤 Human player "${humanGuests[0].name}" joined! Auto-filling crew and launching!`);
            r3Ws.send(JSON.stringify({
              type: 'room_chat',
              roomId: r3RoomId,
              sender: { uid: r3Host.id, name: r3Host.name, avatar: r3Host.avatar },
              text: `Welcome aboard ${humanGuests[0].name}! Auto-filling co-pilots and launching in 3s! 🛫`
            }));
            await wait(1000);
            for (const slot of (msg.room.slots || [])) {
              if (!slot.occupiedBy && slot.type !== 'closed') {
                r3Ws.send(JSON.stringify({
                  type: 'room_slot_change',
                  roomId: r3RoomId,
                  slotId: slot.id,
                  action: 'bot',
                  botLevel: 'hard'
                }));
                await wait(200);
              }
            }
            await wait(1000);
            r3Ws.send(JSON.stringify({
              type: 'room_start',
              roomId: r3RoomId
            }));
            console.log(`[SKY-999] 🚀 Flight launched with human player!`);
          }
        }
      } catch (_) {}
    });

    // Start matches in SKY-777 and SKY-888!
    await simR1.startMatch();
    await wait(1200);
    await simR2.startMatch();

    console.log('\n================================================================================');
    console.log('✨ 10-AGENT SWARM SIMULATION IS RUNNING LIVE!');
    console.log('You can now open http://localhost:3000 in your browser,');
    console.log('Open the Departure Board / Monopoly Lobby:');
    console.log('- Click "👁 Watching" on SKY-777 or SKY-888 to spectate live 4-player in-flight gameplay!');
    console.log('- Click "Join" on SKY-999 to enter and Cloud Neo will auto-fill co-pilots and launch with you!');
    console.log('================================================================================\n');

  } catch (err) {
    console.error('❌ Failed to start live simulation swarm:', err);
    process.exit(1);
  }
}

startSwarm();
