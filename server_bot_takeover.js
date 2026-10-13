/**
 * NEORA Sky Monopoly — 🤖 Server-Side Temporary Bot Takeover Engine
 *
 * Implements server-side autonomous bot takeover for disconnected players:
 * - 10-second configurable reconnect grace period.
 * - Non-destructive seat retention (preserves UID, cash, net worth, properties, tickets).
 * - Automatic legal turn execution when it is the disconnected player's turn.
 * - Safe concurrency locks to prevent human and bot from acting simultaneously.
 * - Instant human control restoration upon session reconnection.
 * - Abandonment policy: terminates matches if all humans abandon for > 3 minutes.
 */

const Bot = require('./public/monopoly_bot.js');

const TAKEOVER_GRACE_MS = 30 * 1000; // 30 seconds grace before bot takeover
const BOT_STEP_DELAY_MS = 1200; // 1.2s delay for natural turn pacing
const ABANDONMENT_TIMEOUT_MS = 180 * 1000; // 3 minutes with 0 humans terminates match

class BotTakeoverManager {
  constructor(roomRegistry, broadcastToRoom, broadcastDepartureBoard) {
    this.roomRegistry = roomRegistry;
    this.broadcastToRoom = broadcastToRoom;
    this.broadcastDepartureBoard = broadcastDepartureBoard;

    this.takeoverTimers = new Map(); // uid -> Timeout
    this.actionTimeouts = new Map(); // roomId:role -> Timeout
    this.abandonmentTimers = new Map(); // roomId -> Timeout
  }

  /**
   * Called when a player disconnects unexpectedly during an active session.
   */
  onPlayerDisconnected(room, slot, uid) {
    if (!room || room.status !== 'in_flight' || !slot) return;

    console.log(`[BotTakeover] Player ${slot.name} (${uid}) disconnected in room ${room.id}. Starting ${TAKEOVER_GRACE_MS / 1000}s grace timer.`);

    // Check if any human is still connected
    this.checkAbandonment(room);

    // Cancel any existing timer for this UID
    if (this.takeoverTimers.has(uid)) {
      clearTimeout(this.takeoverTimers.get(uid));
    }

    const timer = setTimeout(() => {
      this.activateBotTakeover(room.id, slot.id, uid);
    }, TAKEOVER_GRACE_MS);

    this.takeoverTimers.set(uid, timer);
  }

  /**
   * Activates bot takeover after grace period expires.
   */
  activateBotTakeover(roomId, slotId, uid) {
    this.takeoverTimers.delete(uid);

    const room = this.roomRegistry.getRoom(roomId);
    if (!room || room.status !== 'in_flight') return;

    const slot = room.slots.find((s) => s.id === slotId && s.occupiedBy === uid);
    if (!slot) return;

    // Concurrency guard: if player reconnected in the interim, abort
    if (slot.connected) {
      console.log(`[BotTakeover] Player ${slot.name} already reconnected. Aborting takeover.`);
      return;
    }

    slot.controller = 'BOT_TEMPORARY';
    slot.takeoverAt = Date.now();

    console.log(`[BotTakeover] 🤖 Bot takeover ACTIVATED for seat ${slot.id} (${slot.role}: ${slot.name}) in room ${room.id}`);

    // Broadcast takeover event to all remaining clients in room
    this.broadcastToRoom(room, {
      type: 'player_bot_takeover',
      roomId: room.id,
      slotId: slot.id,
      role: slot.role,
      name: slot.name,
      controller: 'BOT_TEMPORARY'
    });

    // If it is currently this player's turn, trigger autonomous bot action
    const currentTurn = room.gameState ? room.gameState.currentTurn : null;
    if (currentTurn === slot.role) {
      this.scheduleBotAction(room, slot.role, BOT_STEP_DELAY_MS);
    }
  }

  /**
   * Called when a player reconnects to reclaim their seat.
   */
  onPlayerReconnected(room, slot, uid) {
    if (!room || !slot) return;

    // Clear any pending takeover grace timer
    if (this.takeoverTimers.has(uid)) {
      clearTimeout(this.takeoverTimers.get(uid));
      this.takeoverTimers.delete(uid);
    }

    // Cancel any scheduled bot action for this role
    const actionKey = `${room.id}:${slot.role}`;
    if (this.actionTimeouts.has(actionKey)) {
      clearTimeout(this.actionTimeouts.get(actionKey));
      this.actionTimeouts.delete(actionKey);
    }

    // Cancel abandonment timer if one was running
    if (this.abandonmentTimers.has(room.id)) {
      clearTimeout(this.abandonmentTimers.get(room.id));
      this.abandonmentTimers.delete(room.id);
    }

    const wasBotTakeover = slot.controller === 'BOT_TEMPORARY';
    slot.controller = 'HUMAN';
    slot.takeoverAt = null;
    slot.connected = true;
    slot.disconnectedAt = null;

    if (wasBotTakeover) {
      console.log(`[BotTakeover] 👤 Human control RESTORED for seat ${slot.id} (${slot.name}) in room ${room.id}`);
      this.broadcastToRoom(room, {
        type: 'player_human_restored',
        roomId: room.id,
        slotId: slot.id,
        role: slot.role,
        name: slot.name,
        controller: 'HUMAN'
      });
    }
  }

  /**
   * Called when game state turn advances to a new role.
   */
  onTurnAdvance(room, nextRole) {
    if (!room || room.status !== 'in_flight' || !nextRole) return;

    // Concurrency check: If any connected human is in the room, let the client host resolve bot turns.
    // The server bot takeover is exclusively for when ALL human players are disconnected or away.
    const connectedHumans = (room.slots || []).filter((s) => s.type === 'human' && s.occupiedBy && s.connected);
    if (connectedHumans.length > 0) {
      return;
    }

    const slot = room.slots.find((s) => s.role === nextRole);
    if (!slot) return;

    const isBot = slot.type === 'bot' || slot.controller === 'BOT_TEMPORARY';
    if (isBot) {
      // If all human players are disconnected, don't rush — ensure pacing
      this.scheduleBotAction(room, nextRole, BOT_STEP_DELAY_MS);
    }
  }

  /**
   * Schedules an autonomous bot roll or decision with race condition protection.
   */
  scheduleBotAction(room, role, delayMs = BOT_STEP_DELAY_MS) {
    const actionKey = `${room.id}:${role}`;
    if (this.actionTimeouts.has(actionKey)) {
      clearTimeout(this.actionTimeouts.get(actionKey));
    }

    const timeout = setTimeout(() => {
      this.actionTimeouts.delete(actionKey);
      this.executeBotAction(room.id, role);
    }, delayMs);

    this.actionTimeouts.set(actionKey, timeout);
  }

  /**
   * Executes the autonomous bot turn or resolves pending decisions.
   */
  executeBotAction(roomId, role) {
    const room = this.roomRegistry.getRoom(roomId);
    if (!room || room.status !== 'in_flight') return;

    // Concurrency guard: if an active human is connected, abort server bot action to avoid dual resolution
    const connectedHumans = (room.slots || []).filter((s) => s.type === 'human' && s.occupiedBy && s.connected);
    if (connectedHumans.length > 0) {
      return;
    }

    const slot = room.slots.find((s) => s.role === role);
    if (!slot) return;

    // Concurrency check: make sure the seat is still a bot
    const isBot = slot.type === 'bot' || slot.controller === 'BOT_TEMPORARY';
    if (!isBot) {
      console.log(`[BotTakeover] Seat ${role} is no longer bot-controlled. Skipping bot action.`);
      return;
    }

    const st = room.gameState;
    if (!st || st.gameOver) return;

    // Check if it's currently this role's turn
    if (st.currentTurn !== role) {
      return;
    }

    // 1. Resolve pending decision if any
    if (st.pendingDecision) {
      const decision = Bot.decide(st, role, st.pendingDecision, slot.difficulty || 'easy');
      const actionType = decision ? decision.act : 'pass';

      this.broadcastToRoom(room, {
        type: 'monopoly_action',
        action: actionType,
        playerKey: role,
        tileId: st.pendingDecision.tileId,
        botAuto: true
      });
      return;
    }

    // 2. Execute dice roll (1d6 = 1..6 tiles on 20-tile board)
    if (!st.isRolling) {
      const rollVal = Math.floor(Math.random() * 6) + 1;

      console.log(`[BotTakeover] 🎲 Bot auto-roll for ${role} (${slot.name}): [${rollVal}]`);

      this.broadcastToRoom(room, {
        type: 'monopoly_action',
        action: 'roll',
        playerKey: role,
        rollVal,
        botAuto: true
      });
    }
  }

  /**
   * Monitors rooms to enforce abandonment policy.
   * If all human players leave/disconnect from an in-flight match, schedule termination.
   */
  checkAbandonment(room) {
    if (!room || room.status !== 'in_flight') return;

    const connectedHumans = room.slots.filter((s) => s.type === 'human' && s.occupiedBy && s.connected);

    if (connectedHumans.length === 0) {
      if (!this.abandonmentTimers.has(room.id)) {
        console.log(`[BotTakeover] Room ${room.id} has 0 connected humans. Scheduling abandonment termination in 3m.`);
        const timer = setTimeout(() => {
          this.terminateAbandonedRoom(room.id);
        }, ABANDONMENT_TIMEOUT_MS);
        this.abandonmentTimers.set(room.id, timer);
      }
    } else {
      if (this.abandonmentTimers.has(room.id)) {
        clearTimeout(this.abandonmentTimers.get(room.id));
        this.abandonmentTimers.delete(room.id);
      }
    }
  }

  terminateAbandonedRoom(roomId) {
    this.abandonmentTimers.delete(roomId);
    const room = this.roomRegistry.getRoom(roomId);
    if (!room || room.status === 'finished') return;

    const connectedHumans = room.slots.filter((s) => s.type === 'human' && s.occupiedBy && s.connected);
    if (connectedHumans.length === 0) {
      console.log(`[BotTakeover] Room ${roomId} terminated due to abandonment (0 human players for > 3m).`);
      room.status = 'finished';
      this.roomRegistry.deleteRoom(roomId);
      this.broadcastDepartureBoard();
    }
  }
}

module.exports = BotTakeoverManager;
