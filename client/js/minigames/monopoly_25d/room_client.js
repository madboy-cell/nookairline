// client/js/minigames/monopoly_25d/room_client.js — transports for the Universal 4-Seat Table Hub.
//
// LocalRoom: runs the SAME shared/universal_room.js TableManager inside the browser → "⚡ Play Solo Now"
//            and the dev preview work with zero server support.
// NetRoom:   forwards table_* / mono_* over the existing WebSocket (net.js) once server.js routes them
//            (deferred until the parallel agents finish editing server.js).
// Both expose the same tiny API: send(msg) · on(type, fn) · close() · userId
import { TableManager } from '/shared/universal_room.js';

class Emitter {
  constructor() { this.handlers = new Map(); }
  on(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); return () => this.handlers.get(type)?.delete(fn); }
  emit(msg) { for (const fn of this.handlers.get(msg.type) || []) { try { fn(msg); } catch (e) { console.error('[room]', msg.type, e); } } for (const fn of this.handlers.get('*') || []) fn(msg); }
}

export class LocalRoom extends Emitter {
  /** @param {{ userId: string, playerInfo: (id) => object }} o */
  constructor({ userId, playerInfo, maxRounds }) {
    super();
    this.userId = userId;
    this.local = true;
    this.mgr = new TableManager({ playerInfo, seedFn: () => (Math.random() * 2 ** 31) | 0, ...(maxRounds ? { maxRounds } : {}) });
    this.mgr.connect(userId);
    this.timer = setInterval(() => { this.mgr.tick(); this.pump(); }, 100);
  }

  pump() {
    for (const { to, msg } of this.mgr.flush()) {
      if (to === 'lobby' || (Array.isArray(to) && to.includes(this.userId))) this.emit(msg);
    }
  }

  send(msg) {
    // async like a socket so UI code never depends on synchronous replies
    queueMicrotask(() => { this.mgr.handle(this.userId, msg); this.pump(); });
  }

  close() { clearInterval(this.timer); this.mgr.disconnect(this.userId); this.handlers.clear(); }
}

export class NetRoom extends Emitter {
  /** @param {{ net: import('../../net.js').Net, userId: string }} o */
  constructor({ net, userId }) {
    super();
    this.net = net;
    this.userId = userId;
    this.local = false;
    this.off = [];
    for (const type of ['table_state', 'table_list_update', 'mono_turn_resolved', 'match_victory_podium', 'table_error']) {
      const fn = (m) => this.emit(m);
      net.addEventListener(type, (e) => fn(e.detail));
    }
  }

  send(msg) { this.net.send(msg); }
  close() { this.send({ type: 'table_leave' }); this.handlers.clear(); }
}
