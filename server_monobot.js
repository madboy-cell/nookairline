/**
 * Nook Airline — 🤖 Sky Monopoly Solo Bot Server Authority
 *
 * Handles stake management, plausibility checks, streak tracking,
 * comeback incentives, and diamond payouts for matches against Captain Whiskers.
 */
const Costumes = require('./public/costumes.js');

const ECON = Costumes.ECONOMY.BOT || {
  EASY_WIN: 50,
  EASY_LOSS: 10,
  HARD_STAKE: 100,
  HARD_COMEBACK_STAKE: 50,
  HARD_WIN: 400,
  HARD_LOSS: 0,
  INSANE_STAKE: 150,
  INSANE_COMEBACK_STAKE: 75,
  INSANE_WIN: 950,
  INSANE_LOSS: 50,
  STREAK_BONUS_PER_WIN: 50,
  MAX_STREAK_BONUS: 200,
  MIN_ROUNDS_PLAUSIBLE: 6
};

const otherRole = (r) => (r === 'bkk' ? 'dxb' : 'bkk');

module.exports = function createMonoBot({ vault, persistVault, sendToRole, broadcastVault, publicProfiles, daily }) {
  function ensureBotStats(role) {
    const p = vault[role];
    if (!p.botStats || typeof p.botStats !== 'object') {
      p.botStats = { played: 0, wins: 0, hardStreak: 0, hardLossStreak: 0, net: 0 };
    }
    return p.botStats;
  }

  function checkSessionExpiry(role) {
    const p = vault[role];
    if (p && p.botSession && p.botSession.startedAt) {
      const ageMs = Date.now() - p.botSession.startedAt;
      if (ageMs > 24 * 3600 * 1000) {
        console.log(`[MonoBot] ⏰ Expired 24h bot session for ${role.toUpperCase()} (${p.botSession.id})`);
        const stats = ensureBotStats(role);
        if (p.botSession.level === 'hard' && p.botSession.stake > 0) {
          stats.hardStreak = 0;
          stats.hardLossStreak = (stats.hardLossStreak || 0) + 1;
          stats.net = (stats.net || 0) - p.botSession.stake;
        }
        delete p.botSession;
        persistVault();
      }
    }
  }

  function handle(ws, role, msg, sendTo) {
    checkSessionExpiry(role);
    const partner = otherRole(role);

    switch (msg.type) {
      // -----------------------------------------------------------------------
      // 1. START BOT MATCH
      // -----------------------------------------------------------------------
      case 'vault_bot_start': {
        const level = (msg.level === 'easy' || msg.level === 'insane') ? msg.level : 'hard';
        const stats = ensureBotStats(role);
        let stake = 0;

        if (level === 'hard' || level === 'insane') {
          const isComeback = (stats.hardLossStreak || 0) >= 2;
          if (level === 'insane') {
            stake = isComeback ? (ECON.INSANE_COMEBACK_STAKE || 75) : (ECON.INSANE_STAKE || 150);
          } else {
            stake = isComeback ? ECON.HARD_COMEBACK_STAKE : ECON.HARD_STAKE;
          }

          if ((vault[role].diamonds || 0) < stake) {
            sendTo(ws, {
              type: 'vault_error',
              scope: 'monobot',
              error: `Not enough diamonds for ${level.toUpperCase()} stake (${stake}💎 needed)`,
              reqId: msg.reqId
            });
            return;
          }

          vault[role].diamonds -= stake;
          vault[role].lastSpentAt = Date.now();
        }

        // If an unfinished session was open, forfeit it
        if (vault[role].botSession) {
          const old = vault[role].botSession;
          console.log(`[MonoBot] ${role.toUpperCase()} starting new bot session, forfeiting old session ${old.id}`);
          if (old.level === 'hard' && old.stake > 0) {
            stats.hardStreak = 0;
            stats.hardLossStreak = (stats.hardLossStreak || 0) + 1;
            stats.net = (stats.net || 0) - old.stake;
          }
        }

        const sessionId = msg.sessionId || ('mbs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
        vault[role].botSession = {
          id: sessionId,
          level,
          stake,
          startedAt: Date.now()
        };

        persistVault();
        console.log(`[MonoBot] 🎮 Started ${level.toUpperCase()} session for ${role.toUpperCase()} (stake: ${stake}💎, session: ${sessionId})`);

        sendTo(ws, {
          type: 'vault_bot_started',
          sessionId,
          level,
          stake,
          profiles: publicProfiles(),
          reqId: msg.reqId
        });
        broadcastVault();
        break;
      }

      // -----------------------------------------------------------------------
      // 2. FINISH BOT MATCH
      // -----------------------------------------------------------------------
      case 'vault_bot_finish': {
        const sessionId = msg.sessionId;
        const session = vault[role].botSession;

        if (!session || (sessionId && session.id !== sessionId)) {
          console.warn(`[MonoBot] Ignoring invalid or duplicate finish from ${role.toUpperCase()}: session=${sessionId}, active=${session ? session.id : 'none'}`);
          sendTo(ws, {
            type: 'vault_error',
            scope: 'monobot',
            error: 'Invalid or already finished bot session',
            reqId: msg.reqId
          });
          return;
        }

        // Plausibility checks
        const rounds = Number(msg.rounds) || 1;
        const elapsedMs = Number(msg.elapsedMs) || (Date.now() - session.startedAt);
        const elapsedSec = elapsedMs / 1000;
        const reason = String(msg.reason || 'nw');
        const isBankrupt = reason === 'bankrupt';
        const minRounds = isBankrupt ? 1 : (ECON.MIN_ROUNDS_PLAUSIBLE || 6);
        const minTimeSec = rounds * 2 * 2.0; // At least ~4 seconds per round
        const isPlausible = rounds >= minRounds && elapsedSec >= minTimeSec && rounds <= 24;

        let winner = msg.winner; // 'me' | 'bot' | 'draw'
        if (!isPlausible && winner === 'me') {
          console.warn(`[MonoBot] ⚠️ Implausible bot finish from ${role.toUpperCase()}: rounds=${rounds}, elapsed=${elapsedSec.toFixed(1)}s, reason=${reason}. Rejecting win payout.`);
          winner = 'bot';
        }

        const stats = ensureBotStats(role);
        stats.played = (stats.played || 0) + 1;
        let payout = 0;
        let breakdown = '';

        if (session.level === 'easy') {
          if (winner === 'me') {
            stats.wins = (stats.wins || 0) + 1;
            payout = ECON.EASY_WIN;
            breakdown = `Victory vs Trainee Mochi (+${payout}💎)`;
          } else {
            payout = ECON.EASY_LOSS;
            breakdown = winner === 'draw'
              ? `Draw vs Trainee Mochi (+${payout}💎)`
              : `Good effort vs Trainee Mochi (+${payout}💎)`;
          }
          stats.net = (stats.net || 0) + payout;
        } else if (session.level === 'insane') {
          // Insane mode
          if (winner === 'me') {
            stats.wins = (stats.wins || 0) + 1;
            stats.hardStreak = (stats.hardStreak || 0) + 1;
            stats.hardLossStreak = 0;
            const baseWin = ECON.INSANE_WIN || 950;
            const streakBonus = Math.min((stats.hardStreak - 1) * ECON.STREAK_BONUS_PER_WIN, ECON.MAX_STREAK_BONUS);
            payout = baseWin + streakBonus;
            stats.net = (stats.net || 0) + (payout - session.stake);
            breakdown = streakBonus > 0
              ? `Victory vs Apex Sovereign (+${baseWin}💎 + ${streakBonus}💎 Streak Bonus!)`
              : `Victory vs Apex Sovereign (+${baseWin}💎)`;
          } else {
            stats.hardStreak = 0;
            stats.hardLossStreak = (stats.hardLossStreak || 0) + 1;
            payout = ECON.INSANE_LOSS != null ? ECON.INSANE_LOSS : 50;
            stats.net = (stats.net || 0) + (payout - session.stake);
            breakdown = `Defeat vs Apex Sovereign (+${payout}💎 rebate, -${session.stake - payout}💎 net)`;
          }
        } else {
          // Hard mode
          if (winner === 'me') {
            stats.wins = (stats.wins || 0) + 1;
            stats.hardStreak = (stats.hardStreak || 0) + 1;
            stats.hardLossStreak = 0;
            const baseWin = ECON.HARD_WIN;
            const streakBonus = Math.min((stats.hardStreak - 1) * ECON.STREAK_BONUS_PER_WIN, ECON.MAX_STREAK_BONUS);
            payout = baseWin + streakBonus;
            stats.net = (stats.net || 0) + (payout - session.stake);
            breakdown = streakBonus > 0
              ? `Victory vs Hard Captain Whiskers (+${baseWin}💎 + ${streakBonus}💎 Streak Bonus!)`
              : `Victory vs Hard Captain Whiskers (+${baseWin}💎)`;
          } else {
            stats.hardStreak = 0;
            stats.hardLossStreak = (stats.hardLossStreak || 0) + 1;
            payout = ECON.HARD_LOSS;
            stats.net = (stats.net || 0) - session.stake;
            breakdown = `Defeat vs Hard Captain Whiskers (-${session.stake}💎 stake)`;
          }
        }

        vault[role].diamonds = Math.max(0, (vault[role].diamonds || 0) + payout);
        delete vault[role].botSession;
        persistVault();

        if (daily && typeof daily.track === 'function') {
          daily.track(role, 'monopoly', 1);
        }

        console.log(`[MonoBot] 🏁 Match resolved for ${role.toUpperCase()} (${session.level}): winner=${winner}, payout=+${payout}💎, net=${session.level === 'hard' ? payout - session.stake : payout}💎, streak=${stats.hardStreak}`);

        sendTo(ws, {
          type: 'vault_bot_result',
          role,
          payout,
          net: session.level === 'hard' ? payout - session.stake : payout,
          streak: stats.hardStreak,
          lossStreak: stats.hardLossStreak,
          breakdown,
          profiles: publicProfiles(),
          reqId: msg.reqId
        });

        // Notify partner if it was an impressive Hard win
        if (session.level === 'hard' && winner === 'me') {
          sendToRole(partner, {
            type: 'vault_event',
            kind: 'bot_hard_win',
            role,
            payout,
            streak: stats.hardStreak,
            profiles: publicProfiles()
          });
        }

        broadcastVault();
        break;
      }

      // -----------------------------------------------------------------------
      // 3. FORFEIT BOT MATCH
      // -----------------------------------------------------------------------
      case 'vault_bot_forfeit': {
        const session = vault[role].botSession;
        if (session && (!msg.sessionId || session.id === msg.sessionId)) {
          const stats = ensureBotStats(role);
          if (session.level === 'hard') {
            stats.hardStreak = 0;
            stats.hardLossStreak = (stats.hardLossStreak || 0) + 1;
            stats.net = (stats.net || 0) - session.stake;
          }
          delete vault[role].botSession;
          persistVault();
          console.log(`[MonoBot] 🏳️ Forfeited bot session for ${role.toUpperCase()} (${session.id})`);

          sendTo(ws, {
            type: 'vault_bot_result',
            role,
            payout: 0,
            net: session.level === 'hard' ? -session.stake : 0,
            streak: 0,
            lossStreak: stats.hardLossStreak,
            breakdown: 'Forfeited bot match',
            profiles: publicProfiles(),
            reqId: msg.reqId
          });
          broadcastVault();
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    handle,
    checkSessionExpiry,
    ensureBotStats
  };
};
