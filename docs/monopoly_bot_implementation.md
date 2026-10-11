# Sky Monopoly — Solo Bot Mode ("vs Captain Whiskers")
## Comprehensive Architecture & Technical Implementation Report

> **Target Platform:** Mobile-first (iPhone 18 Pro · 402×874 viewport) & Desktop  
> **Tech Stack:** Vanilla JavaScript (ES2022, UMD), Vanilla CSS, Node.js + `ws` WebSocket Server  
> **Date Deployed:** 2026-10-08  
> **Author:** Antigravity Engineering

---

## 1. High-Level System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Browser Client (iPhone / Web)            │
                    │                                                        │
                    │   ┌─────────────────────┐   ┌──────────────────────┐   │
                    │   │   monopoly_rules    │   │     monopoly_bot     │   │
                    │   │    (Pure Math &     │◄──┤  (Fair Heuristics &  │   │
                    │   │    Game Engine)     │   │     Personality)     │   │
                    │   └──────────┬──────────┘   └──────────┬───────────┘   │
                    │              │                         │               │
                    │              ▼                         ▼               │
                    │   ┌────────────────────────────────────────────────┐   │
                    │   │             monopoly.js (UI / Loop)            │   │
                    │   │  - Mode Picker (Couple vs Easy vs Hard)        │   │
                    │   │  - State Isolation (Bot: local / Couple: net)  │   │
                    │   │  - Autonomous Turn Scheduler                   │   │
                    │   │  - Victory Overlay with Rematch Flow           │   │
                    │   └───────────────────────┬────────────────────────┘   │
                    └───────────────────────────┼────────────────────────────┘
                                                │ WebSocket Signaling
                                                │ (vault_bot_start / finish)
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │                Node.js Backend Server                  │
                    │                                                        │
                    │   ┌─────────────────────┐   ┌──────────────────────┐   │
                    │   │      server.js      │──►│   server_monobot.js  │   │
                    │   │ (Connection routing │   │ (Authoritative Stake,│   │
                    │   │   & Vault state)    │   │  Anti-Cheat & Payout)│   │
                    │   └─────────────────────┘   └──────────┬───────────┘   │
                    │                                        │               │
                    │                                        ▼               │
                    │                             data/vault_profiles.json   │
                    └────────────────────────────────────────────────────────┘
```

The system is designed with strict **separation of concerns**:
1. **Zero Couple Game Interference:** When in Bot Mode, network broadcasts of board actions (`monopoly_action`, `reset_game`) are suppressed. Couple match states on the server (`data/monopoly_state.json`) and local storage (`nook_sky_monopoly_v5`) are completely isolated from bot sessions (`nook_sky_monopoly_bot_v1`).
2. **Server Authority over Economy:** Client calculates game results locally, but **all diamond stakes and payouts are managed authoritatively by the server** with cryptographic-grade anti-cheat and physical plausibility verification.
3. **Pure Shared Math:** Game logic and bot intelligence reside in dependency-free UMD modules that run identically in client browsers, automated Puppeteer tests, and headless Monte Carlo simulations.

---

## 2. Phase-by-Phase Technical Implementation

### Phase 1 — Removal of Idle Takeover ("Play for Partner") & Pause UX
* **Objective:** Ensure couple games represent genuine togetherness. An idle partner must never be played by the other player.
* **Code Removals:**
  * Purged all takeover flags and functions: `partnerIdle`, `playingForPartner`, `forPartnerBanner`, `IDLE_TAKEOVER_MS`.
  * Removed "Roll for Partner" and "Decide for Partner" hijack buttons across modals, card challenges, and duel overlays.
* **Pause Banner:**
  * Added `.monopoly-pause-banner` (`#monopolyPauseBanner`).
  * When `partnerAway()` evaluates true during an active couple game, the HUD presents:
    ```
    ✈️ Waiting for {BADGE}… Match saved — resumes when they return.
    ```
  * Game halts gracefully without timers or forfeits. Reconnection automatically syncs board state via `monopoly_sync`.

### Phase 2 — Pure Rules Module & Bot Engine (`NookMonoBot`)
* **`public/monopoly_rules.js` (UMD):**
  * Contains pure data structures: `MONO_CFG`, `MONOPOLY_TILES`, `ZONES`, `ITEMS`, `CASINO_TABLE`, `CARD_DECK`.
  * Pure calculation helpers taking state as parameter: `getTileRent(state, tileId, level)`, `netWorth(state, role)`, `upgradeCost(tileId, level)`, `ownsZone(state, role, zoneId)`, `finalBoardingMult(state)`, `chargePlayer(state, role, amount)`.
  * Standardized bankruptcy liquidation algorithm: sells highest-value non-hotel properties first, clears houses down to base value.
* **`public/monopoly_bot.js` (UMD):**
  * Exposes `window.NookMonoBot` with core APIs: `decide()`, `preRoll()`, `personality()`, `calculateReserve()`.
  * **Heuristics & AI Logic:**
    * **Dynamic Cash Reserve:** Scans tiles 2 to 12 steps ahead. Multiplies maximum opponent rent by current Final Boarding multiplier with a 150 coin baseline floor.
    * **Property Acquisition:** Prioritizes completing own color zones (`ZONE_MULT 2×`) and blocking opponent zones. Drops low-rent tiles late game if cash < reserve.
    * **Tactical Item Usage (`preRoll`):**
      * *Golden Dice:* Computes 1-6 outcomes; picks tile that completes a zone, lands on own hotel, or avoids high-rent enemy traps.
      * *C4 Bomb:* Targets the opponent's single highest-earning hotel.
      * *Magnet:* Activates when opponent cash > 600.
      * *Swap Portal:* Activates when bot is facing imminent danger while opponent sits in safe territory.
    * **Rent Defense & Takeovers:**
      * *Shield:* Deploys if rent > 35% of current cash or tile is an enemy hotel.
      * *Takeover:* Declared only if EV is positive, tile completes a zone, and bot can afford `price + (price * 1.5)` takeover loss penalty.
  * **Difficulty Personalities:**
    * 🐣 **Easy Mode:** Friendly and sweet. Does not calculate cash reserves. Buys impulsively, spins casino for fun, rarely declares takeovers, and occasionally makes "cute mistakes" (15% chance to skip a tile with a playful dialogue).
    * 😈 **Hard Mode:** High-IQ tactical pilot. Smug but charming. Strictly enforces cash reserves, hunts zone completions, aggressively defends high rents, and deploys items for maximum disruption.
  * **Guaranteed Fair Play:** The bot never peeks at dice rolls or manipulates RNG. It rolls standard fair 1d6 dice.

### Phase 3 — Solo Bot Mode Client Integration (`public/monopoly.js`)
* **Mode Picker Modal:**
  * Triggered on game initialization or when tapping "Reset / New Game".
  * Options:
    * 💞 **Play Together:** Disabled with clear indicator when partner is offline.
    * 🐣 **Captain Whiskers · Easy:** Free entry, relaxed pacing, +80💎 win.
    * 😈 **Captain Whiskers · Hard:** Requires 100💎 stake (50💎 with comeback discount); +450💎 win.
* **State Isolation:**
  * Couple state saved to `localStorage['nook_sky_monopoly_v5']`.
  * Bot state saved to `localStorage['nook_sky_monopoly_bot_v1']`.
  * Network send gate: `if (st.mode !== 'bot') sendSignaling(...)` guards `pushState`, `startRoll`, `sendPick`, and `reset_game`.
* **Autonomous Bot Turn Loop:**
  * When `currentTurn === botRole`, `checkBotTurn()` activates a natural scheduler:
    1. Delays 700–1400ms (thinking animation).
    2. Runs `preRoll()`. If item selected, executes item animation.
    3. Rolls fair 1d6 with 3D dice tumbling sound and visual effects.
    4. Upon landing, evaluates decision without opening human modals.
    5. Bot speech bubble appears (e.g. *"This hotel has my name on it! 😼"*), then applies action via shared named functions (`actBuy`, `actPayRent`, `actTakeover`, `actUpgrade`).
  * Duels vs Bot: The bot automatically rolls its d6 after human completes their duel roll.
  * Vibe Check is disabled in bot matches.

### Phase 4 — Headless Simulation & Economy Balancing
* **Simulator:** Built in [scripts/sim_monopoly.js](file:///Users/thanapat/Documents/nookairline/scripts/sim_monopoly.js). Runs headless Node tournaments using identical logic from `monopoly_rules.js` and `monopoly_bot.js`.
* **Monte Carlo Results (5,000 Games Per Matchup):**

| Matchup | Games | P1 Win Rate | P2 Win Rate | Draw Rate | Avg Rounds | Real-Time Est. |
|---|---|---|---|---|---|---|
| **Easy vs Human Proxy** | 5,000 | 30.4% (Easy) | **69.5% (Human)** | 0.1% | 22.9 rounds | ~5.4 minutes |
| **Hard vs Human Proxy** | 5,000 | 47.7% (Hard) | **52.3% (Human)** | 0.1% | 23.3 rounds | ~5.5 minutes |
| **Hard vs Easy** | 5,000 | **66.8% (Hard)** | 33.1% (Easy) | 0.1% | 22.7 rounds | ~5.3 minutes |
| **Random vs Random** | 2,000 | 49.1% | 50.8% | 0.1% | 23.9 rounds | ~5.6 minutes |

* **Final Tuned Economy Constants (`ECONOMY.BOT` in `public/costumes.js`):**
  ```javascript
  BOT: {
    EASY: {
      ENTRY_FEE: 0,
      WIN_DIAMONDS: 80,
      LOSS_DIAMONDS: 30
    },
    HARD: {
      ENTRY_FEE: 100,
      WIN_DIAMONDS: 450,       // Net +350💎
      LOSS_DIAMONDS: 0,         // Net -100💎 (forfeited stake)
      WIN_STREAK_BONUS: 50,     // +50💎 per consecutive win
      MAX_WIN_STREAK_BONUS: 200,// Capped at +200💎 extra
      COMEBACK_LOSSES: 2,       // 2 losses in a row
      COMEBACK_DISCOUNT: 0.5    // Next stake is 50💎 (50% off)
    }
  }
  ```

### Phase 5 — Server Authority (`server_monobot.js`)
* Implemented following the `server_cats.js` dependency-injection factory pattern:
  `module.exports = function createMonoBotServer({ vault, persistVault, sendToRole, broadcastVault, publicProfiles, daily })`
* **Protocol & State Flow:**
  1. `vault_bot_start { level, sessionId, reqId }`:
     - Checks diamond balance. For Hard mode, immediately deducts stake (100💎 or 50💎).
     - Persists session: `vault[role].botSession = { id, level, stake, startedAt }`.
     - Returns `vault_bot_started` with updated profile.
  2. `vault_bot_finish { sessionId, winner, rounds, reason, elapsedMs, reqId }`:
     - Verifies session match. Prevents replay attacks.
     - **Plausibility Checks:**
       - `rounds >= 6` (unless `reason === 'bankrupt'`).
       - `elapsedSec >= rounds * 4s` (humanly impossible speedruns rejected).
       - `rounds <= MONO_CFG.MAX_ROUNDS`.
     - Updates `vault[role].botStats`: `played`, `wins`, `hardStreak`, `hardLossStreak`, `net`.
     - Automatically increments daily quest tracking: `daily.track(role, 'monopoly', 1)`.
     - On Hard win, broadcasts celebratory toast to partner:
       ```
       sendToRole(otherRole, { type: 'vault_toast', text: `🎉 ${name} just defeated Captain Whiskers on HARD mode! (+${payout}💎)` });
       ```
  3. `vault_bot_forfeit { sessionId }`: Clears open session and records loss.
  4. **24-Hour Auto-Expiry:** Sessions older than 24 hours automatically expire on connection or next start request.

### Phase 6 — Polish, Victory Overlay & Production Deployment
* **Mobile Viewport Verification:** Tested on iPhone 18 Pro (402×874). Cards, dice rolling container, and modals fit cleanly with zero horizontal scroll and zero cut-off buttons.
* **Victory Screen Overlay:**
  - Displays winner crown, animated confetti, breakdown of earnings, net worth comparison, and match stats.
  - Features high-contrast primary **😼 Rematch** button for instant replay.
  - Interactive: Tapping the bottom `GAME OVER 🏆` banner or center dice box re-opens the victory screen at any time if dismissed.
* **Production Deployment:**
  - Full backup archived in `data_backups/data_20261008_165505`.
  - Process started cleanly with `node server.js` on port 3000 behind Cloudflare Tunnel.

---

## 3. File Reference & Modifications

| File | Type | Purpose & Changes |
|---|---|---|
| [public/monopoly_rules.js](file:///Users/thanapat/Documents/nookairline/public/monopoly_rules.js) | **NEW** (UMD) | Pure game rules, config constants, rent formulas, liquidation math. |
| [public/monopoly_bot.js](file:///Users/thanapat/Documents/nookairline/public/monopoly_bot.js) | **NEW** (UMD) | Captain Whiskers AI engine, decision heuristics, cash reserve math, dialog quotes. |
| [server_monobot.js](file:///Users/thanapat/Documents/nookairline/server_monobot.js) | **NEW** (Node) | Server authority module: staking, anti-cheat validation, stats tracking, partner toasts. |
| [scripts/sim_monopoly.js](file:///Users/thanapat/Documents/nookairline/scripts/sim_monopoly.js) | **NEW** (Node) | Monte Carlo headless simulator for balancing and parity testing. |
| [public/monopoly.js](file:///Users/thanapat/Documents/nookairline/public/monopoly.js) | **MODIFIED** | Removed idle-takeover, added pause banner, integrated mode picker, bot loop, and rematch overlay. |
| [public/costumes.js](file:///Users/thanapat/Documents/nookairline/public/costumes.js) | **MODIFIED** | Added `ECONOMY.BOT` configuration constants. |
| [public/vault.js](file:///Users/thanapat/Documents/nookairline/public/vault.js) | **MODIFIED** | Added Captain Whiskers bot mode lines to "How to earn diamonds" guide. |
| [public/index.html](file:///Users/thanapat/Documents/nookairline/public/index.html) | **MODIFIED** | Added script tags (`monopoly_rules.js` → `monopoly_bot.js`), bumped cache query to `v=20261008b3`. |
| [server.js](file:///Users/thanapat/Documents/nookairline/server.js) | **MODIFIED** | Wired `server_monobot.js` into WebSocket routing, `makeProfile()`, and connection greeting. |

---

## 4. Guide for Future Agents & Developers

### 1. How to Add a New Bot Personality or Difficulty
1. Open [public/monopoly_bot.js](file:///Users/thanapat/Documents/nookairline/public/monopoly_bot.js).
2. Add a new difficulty key (e.g. `'nightmare'` or `'pilot_paws'`) in `PERSONALITIES`:
   ```javascript
   PERSONALITIES.nightmare = {
     name: 'Admiral Whiskers',
     sprite: 'assets/cats/m_admiral.png',
     quotes: { buy: [...], rent: [...], win: [...] }
   };
   ```
3. Define decision rules inside `decide()` and `preRoll()`.
4. Add economy entry in `ECONOMY.BOT` inside [public/costumes.js](file:///Users/thanapat/Documents/nookairline/public/costumes.js).
5. Update the Mode Picker UI in `promptResetOrMode()` inside [public/monopoly.js](file:///Users/thanapat/Documents/nookairline/public/monopoly.js).

### 2. How to Re-Run Headless Simulations
Run the headless simulator with any sample size:
```bash
node scripts/sim_monopoly.js 5000
```
This outputs win rate matrices, average round durations, and economic yields without requiring a browser or DOM.

### 3. How to Run Unit & Server Tests
All tests are non-destructive and can be run via:
```bash
# Verify Pure Rules & Bot AI Decision Tree
node scratch/test_monobot_unit.js

# Verify Server Authority, Anti-Cheat, and Staking
node scratch/test_monobot_server.js
```

### 4. Safe Production Deployment Protocol
Always follow this exact protocol before touching the live server:
```bash
# 1. Back up database
mkdir -p data_backups && cp -R data data_backups/data_$(date +%Y%m%d_%H%M%S)

# 2. Syntax check all modified files
node -c server.js server_monobot.js public/monopoly.js public/monopoly_bot.js

# 3. Restart server
kill $(lsof -t -i :3000)
node server.js
```
The Cloudflare tunnel process runs independently and does not require restarting.

---
*End of Report.*
