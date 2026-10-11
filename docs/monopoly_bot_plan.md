# Sky Monopoly — Solo Bot Mode ("vs Captain Whiskers") · Implementation Plan

> [!IMPORTANT]
> **For the implementing agent:** read this whole file before writing code. The project is
> `/Users/thanapat/Documents/nookairline`. It's a private 2-person app: BKK (him) and DXB (her, on an
> **iPhone 18 Pro**, about 402×874 viewport). The stack is vanilla JS/CSS with a Node + `ws` server and no build step.

## 0. Goal

DXB should be able to play Monopoly alone against a bot and earn 💎 when BKK is busy, without
weakening the couple game. The plan has four parts:

1. **Remove "play for partner"** (the idle-takeover mode). A couple game now **pauses** when someone is away.
2. **Add a solo bot mode** with two difficulties:
   - 🐣 **Easy:** friendly play, free to enter, small reward.
   - 😈 **Hard:** plays to win, **diamond stake**, big reward. A loss forfeits the stake.
3. **Make the server authoritative** for the stake and payout. No daily cap; balance comes from the stake and the reward size.
4. **Build a bot-vs-bot simulator** to *measure* win rates and game length. Final 💎 numbers are set from that data.

Non-goals: no online matchmaking, and no bot inside a couple game.

---

## 1. Codebase facts (verified 2026-10-08)

| Thing | Where | Notes |
|---|---|---|
| Game client | [monopoly.js](file:///Users/thanapat/Documents/nookairline/public/monopoly.js) (about 2.9k lines) | All rules **and** rendering live here, tightly coupled to the DOM and modals |
| FX layer | [monopoly_fx.js](file:///Users/thanapat/Documents/nookairline/public/monopoly_fx.js) | Animations and tokens; `MonoFX.busy()` delays the victory screen. Has a `buildTestPanel()` (line ~1070) |
| Config | `MONO_CFG` [L119-143](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L119-L143) | 20 tiles, START 1200, win at 3,500 net worth or **24 rounds**, Final Boarding ×1.5 at round 17 and ×2 at round 21 |
| Items | `ITEMS` [L190-196](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L190-L196) | golden_dice, c4, shield, magnet, swap; `MAX_ITEMS: 2` |
| State shape | `createDefaultMonopolyState()` [L406](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L406) | `players.{bkk,dxb}`, `properties`, `pendingDecision`, `activeChallenge`, `activeDuel`, `gameOver`, `stats`, `gameId`, `perks` |
| Sync model | header comment and `pushState()` [L717](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L717) | Whoever rolls is the **turn resolver**: it resolves random outcomes, then broadcasts the full state (`monopoly_action`) |
| Turn flow | `handleUserRollRequest` → `startRoll` → `executeRoll` → `onTileLanded` → `resolveLanding` [L1451](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1451) → `setDecision` / `finishTurn` → `endTurn` [L1544](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1544) | |
| Decisions | `openDecisionModal` [L1633](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1633) | Types: `buy`, `upgrade`, `rent` (pay / ⚔️ takeover / 🎯 vibe / 🛡️ shield), `casino`, `market`, `arena` |
| Duels | `duelRoll` [L2205](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L2205), `trySettleDuel` [L2219](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L2219) | Pure d6 roll-off (perk `duelTieWin` breaks ties) |
| Vibe Check | `activeChallenge`, `renderChallengeOverlay` [L1917](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1917) | Couple card questions; **must be disabled in bot mode** |
| Items use | `useItem` [L2590](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L2590), `canUseItemsNow` [L1279](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1279) | |
| New game | `resetMonopolyGame()` [L990](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L990) | Locks perks in via `NookVault.monopolyPerks()` and sends `reset_game` |
| Victory and 💎 | `renderVictory()` [L2704](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L2704) | **The client** sends `vault_award {gameKey, winner, matches}` |
| Server award | `vaultAward()` in [server.js](file:///Users/thanapat/Documents/nookairline/server.js) (~L242) and `case 'vault_award'` (~L376) | Pays **both** players: WIN 500 / LOSS 150 + 10/vibe match + 50 first game of the day; dedupes by `gameKey`; calls `daily.track(role,'monopoly',1)` |
| Economy constants | [costumes.js](file:///Users/thanapat/Documents/nookairline/public/costumes.js) `ECONOMY` (~L20) | Shared by client and server (UMD pattern) |
| Server game save | server.js `serverMonopolyState` + `data/monopoly_state.json` (~L640-715) | **One slot only.** Any `monopoly_*` message with `state` overwrites it |
| Local save | `localStorage['nook_sky_monopoly_v5']` | |
| Presence | `window.nookPartnerOnline`, `partnerAway()`/`partnerIdle()` [L482-483](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L482-L483) | |
| Vault client | [vault.js](file:///Users/thanapat/Documents/nookairline/public/vault.js) | `NookVault.toast`, `getProfiles()`, `vault:profiles` event, the `vault_error` path |
| Daily quests | [server_daily.js](file:///Users/thanapat/Documents/nookairline/server_daily.js), [rewards.js](file:///Users/thanapat/Documents/nookairline/public/rewards.js) | Quest key `monopoly` |
| Server module pattern | [server_cats.js](file:///Users/thanapat/Documents/nookairline/server_cats.js) | `module.exports = function createX({ vault, persistVault, sendToRole, broadcastVault, publicProfiles, daily })`, routed from `handleVaultMessage`. **Copy this pattern.** |
| Shared config pattern | [cats.js](file:///Users/thanapat/Documents/nookairline/public/cats.js) | UMD: `window.X` and `module.exports` |

---

## 2. Decisions

### Locked (from the owner)
- ❌ **Remove "play for partner" completely.**
- 🤖 **Bot auto-play**, with Easy and Hard difficulties.
- ♾️ **No daily cap** on bot games.
- ⚖️ Balance: **Easy = small reward, no risk. Hard = bigger reward, but losing costs 💎.**
- 🎲 **The bot never cheats:** same fair dice and no hidden-information tricks. Show "Captain Whiskers plays fair 🎲" in the UI.

### Draft numbers (tune after the simulation in Phase 4)
| Mode | Entry | Win | Loss | Notes |
|---|---|---|---|---|
| 🐣 Easy | free | +80💎 | +30💎 | |
| 😈 Hard | **100💎 stake** (deducted at start) | +450💎 total (net +350) | 0 (net −100) | Needs ≥100💎 to start |
| 💞 Couple (unchanged) | free | +500 | +150 | Must stay the **best 💎 per hour** |

Targets for tuning:
- A reasonable human wins about **70% vs Easy** and about **40–45% vs Hard**.
- Average 💎 per game: Hard ≈ 1.5× Easy for a decent player. Both stay well below couple play per hour.

### Open (ask the owner if they haven't answered; otherwise use the default)
1. Hard extras. Default **ON**:
   - **Comeback:** after 2 Hard losses in a row, the next stake is halved.
   - **Win streak:** +50💎 per consecutive Hard win, capped at +200.
2. Stake tiers (100 / 250 / 500 at the same odds). Default **OFF** for v1.
3. Does a bot game count for the daily `monopoly` quest? Default **yes**. The +50 first-game-of-the-day bonus stays **couple-only**.
4. Does the partner get a feed or toast line ("DXB beat Hard Captain Whiskers! +450💎")? Default **yes, toast only**.

---

## 3. Phases

### Phase 1: Remove "play for partner" and add pause
Remove every idle-takeover path (grep `partnerIdle|playingForPartner|forPartnerBanner|IDLE_TAKEOVER_MS`):
- `rollButtonState()` [L1168](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1168): drop the `ROLL FOR …` branch and show `⏳ {BADGE}'S TURN`, or `✈️ Waiting for {BADGE}…` when `partnerAway()`.
- Around [L930](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L930) (init/HUD idle logic) and [L1252](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1252) (the "decide for partner" button): remove.
- `resolveLanding` arena branch [L1498](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1498): remove `|| playingForPartner()`.
- Rent modal [L1762-1776](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1762-L1776): remove the `forPartner` conditions.
- Challenge overlay [L1997](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L1997) and duel overlay [L2151](file:///Users/thanapat/Documents/nookairline/public/monopoly.js#L2151): remove the "partner idle — pick/roll for them" buttons.
- Delete `forPartnerBanner()` and its call sites, plus `playingForPartner()`, `partnerIdle()` and `IDLE_TAKEOVER_MS`. Delete the related CSS (`.for-partner-banner`, `.take-turn-btn`) only if nothing else uses it.
- **Pause UX:** if `partnerAway()` and it's their turn or their input is needed, show a soft banner: "✈️ {name} stepped away — game saved, it continues when they're back". Nothing advances. State is already persisted server-side, so a reconnect resumes through `monopoly_sync`.
- **Keep** `isResolver()`: the sync model still needs it.

✅ Done when two browsers can play a couple game, closing one shows the pause banner on the other, nothing can be done for the absent player, and reopening resumes the game.

### Phase 2: Shared rules module and bot brain (pure JS)
The rules are tangled with the DOM. To share them between the client bot and the Node simulator:

1. Create **`public/monopoly_rules.js`** (UMD like cats.js). Move or duplicate **pure** pieces into it: `MONO_CFG`, `MONOPOLY_TILES`, `ZONES`, `ITEMS`, `CASINO_TABLE`, and pure helpers that take `state` as a parameter (`upgradeCost`, `propValue`, `getTileRent(state, id, lvl)`, `netWorth(state, role)`, `ownsZone`, `zoneTiles`, `finalBoardingMult(state)`, `chargePlayer` math).
   - Prefer making monopoly.js **call into** this module, so there's one source of truth. If a function is too tangled, keep the original and add a comment `// keep in sync with monopoly_rules.js`. Add a parity test (Phase 4).
   - **Preserve existing comments** when moving code.
2. Create **`public/monopoly_bot.js`** (UMD) exporting `NookMonoBot`:
   ```js
   decide(state, botRole, decision, level) // → { act: 'buy'|'pass'|'upgrade'|'skip'|'pay'|'takeover'|'shield'|'spin'|'leave'|'buyItem', itemId?, targetTileId? }
   preRoll(state, botRole, level)           // → null | { useItem: 'golden_dice', value } | { useItem: 'swap' } | { useItem: 'magnet' } | { useItem: 'c4', tileId }
   personality(level)                       // name, avatar, chat lines
   ```
   It must be pure (no DOM), deterministic given an RNG argument, and only use info visible to a human.
3. **Hard strategy** (heuristics, no lookahead needed):
   - **Cash reserve** = max rent of opponent tiles within 2–12 steps × the Final Boarding multiplier, with a floor of about 150.
   - **Buy** if it keeps the reserve, with a strong preference when it completes or blocks a zone (`ZONE_MULT 2`). Skip cheap tiles late in the game if they're useless.
   - **Upgrade** zone tiles first, then highest rent per cost. Don't drop below the reserve. Hotels are a priority once rounds ≥ 12.
   - **Rent choice:**
     - 🛡️ Shield if rent ≥ 35% of cash, or rent is from a hotel.
     - ⚔️ Takeover if the property completes its zone or is a hotel-path tile, it can afford price + lose cost (`TAKEOVER_LOSE_MULT 1.5`), and EV > 0 (≈50% duel).
     - Otherwise pay.
   - **Items:**
     - 🎲 Golden Dice: pick the roll that lands on its own property, or an empty buyable tile in a zone it's building; avoid opponent hotels.
     - 🌀 Swap when the opponent is in a safe stretch and the bot is facing danger, or vice versa.
     - 💣 C4 on the opponent's highest-rent hotel.
     - 🧲 Magnet when the opponent's cash > 600.
   - **Casino:** spin only if cash > reserve + 300. **Market:** buy Shield or Golden Dice if affordable above the reserve. **Arena:** challenge the highest-value non-hotel opponent tile when it's affordable.
4. **Easy strategy:**
   - Buys almost everything it can afford, rarely plans for zones, never keeps a reserve.
   - Uses items at random good-enough moments (about 50%), rarely declares takeovers, spins the casino for fun.
   - About 15% "cute mistakes" (passes on a good tile with a chat line like "hmm I like the other one 😸").

✅ Done when unit-style tests in Node can call `decide()` for every decision type without throwing, and Hard keeps its reserve.

### Phase 3: Bot mode in the client
1. **Mode picker** on the Monopoly start or reset screen (find where `resetMonopolyGame` / "New game" is triggered):
   - 💞 **Play together** (only enabled when the partner is online).
   - 🤖 **vs Captain Whiskers** → 🐣 Easy (free) / 😈 Hard ("Stake 100💎 → win 450💎"). Disabled with a reason if 💎 < stake.
2. **Separate state:** keep `monopolyState.mode = 'couple' | 'bot'` and `monopolyState.bot = { level, role, sessionId }`.
   - The bot takes the **other** seat (`otherRole(me)`). Use the bot's own name and sprite (a cat pilot; generate art with the image tool, transparent PNG, in `public/assets/`).
   - The local save key is **`nook_sky_monopoly_bot_v1`**, so it never touches the couple save.
   - **Do not send `monopoly_action` / `reset_game` while `mode==='bot'`.** Gate `pushState()`, `sendPick()`, `startRoll()`'s send, and the reset send. This keeps `serverMonopolyState` (the couple game) intact.
   - When a couple game exists, opening Monopoly asks which one to resume.
3. **Driving the bot seat:** when `currentTurn === bot.role`, run a small scheduler:
   - Thinking delay of 700–1400 ms, then `preRoll` → `startRoll(d6())`.
   - When a decision opens for the bot, **don't show the decision modal**. Show a "Captain Whiskers is thinking… 🤔" bubble, then apply the action through the **same code path** the modal buttons use. Refactor the modal button handlers into named functions such as `actBuy(tileId)`, `actPayRent()`, `actTakeover()`, so the human UI and the bot share them.
   - Duel: the bot rolls its side automatically. Golden Dice uses the existing golden roll path.
   - Must survive tab background/foreground and refresh: resume the bot loop from saved state.
4. **Vibe Check off in bot mode:** hide or disable the 🎯 option (`Not available vs bot`). Never draw `CARD_DECK` cards. Don't touch `playedCardIds`.
5. **Perks:** the human keeps their costume perk. The bot gets **no perk**. Skip `extraVibePass`.
6. **Personality and juice** (owner cares a lot about feel):
   - Chat bubbles on buy, rent, takeover, win and lose. Easy is sweet; Hard is smug but cute.
   - A small cat-head badge on the bot token. Reuse existing FX (`emitFx` / `MonoFX`).
7. **Victory:** in bot mode, **don't** send `vault_award`. Send `vault_bot_finish` (Phase 5) and show the server-confirmed payout (see Phase 5).

✅ Done when a full Easy and a full Hard game can be played on a 402×874 viewport with zero console errors, the couple save on the server is byte-identical before and after, and the bot never gets stuck in a decision.

### Phase 4: Simulator and tuning (do this **before** finalising 💎)
1. `scripts/sim_monopoly.js` (Node, no DOM): uses `monopoly_rules.js` and `monopoly_bot.js` to run a headless turn loop that mirrors `resolveLanding`, casino, market, arena, duels, items, Final Boarding and the end conditions. **Vibe Check is excluded** (same as bot mode).
2. Policies: `random`, `easy`, `hard`, plus a `human` proxy (medium: sensible buying, uses items about 60% well, no reserve maths).
3. Run ≥ 5,000 games per matchup, alternating who starts: hard-vs-human, easy-vs-human, hard-vs-easy, random-vs-random. Report:
   - win / draw rates;
   - average rounds;
   - end-reason split;
   - estimated real minutes (assume about 12 s per human turn and 3 s per bot turn; refine with a timed manual game).
4. **Parity test:** feed identical scripted dice into the sim and into the real client (puppeteer, bot-vs-bot in the browser with animations sped up) and compare the final state. Any mismatch means the sim diverged from the client.
5. Tune Hard (reserve size, takeover threshold) until **human-proxy vs Hard ≈ 40–45%** and **vs Easy ≈ 70%**.
6. Put final numbers in `ECONOMY.BOT` in costumes.js and write a short table of the results into this plan.

### Phase 5: Server authority (new module `server_monobot.js`)
Follow the server_cats.js pattern and route `vault_bot_*` from `handleVaultMessage`.

- `vault_bot_start {level, reqId}`:
  - Validate the level. For Hard, check `diamonds ≥ stake` (with the comeback discount applied), **deduct the stake now**, and persist.
  - Create `vault[role].botSession = { id, level, stake, startedAt, seed }`.
  - Starting a new session while one is open **forfeits** the old one (log it).
  - Reply `vault_bot_started {sessionId, stake, profiles}`.
- `vault_bot_finish {sessionId, winner:'me'|'bot'|'draw', rounds, reason, reqId}`:
  - Must match the open session. Pay once, then clear the session.
  - **Plausibility checks:**
    - `rounds ≥ 6` unless `reason==='bankrupt'`;
    - `elapsed ≥ rounds × 2 × 2.5s`;
    - `rounds ≤ MAX_ROUNDS`.
    - Failing a check means **no win payout** (treat as a loss, logged), and Easy pays nothing.
  - Payout from `ECONOMY.BOT`, plus the win-streak and comeback state stored in `vault[role].botStats = { played, wins, hardStreak, hardLossStreak, net }`.
  - Call `daily.track(role,'monopoly',1)` if Open #3 is yes.
  - Reply `vault_bot_result {payout, breakdown, profiles}`, `sendToRole(other, …toast)` if Open #4 is yes, then `broadcastVault()`.
- `vault_bot_forfeit {sessionId}`: an explicit quit. The stake is already gone; mark it as a loss.
- **Refresh does not forfeit:** the client resumes the saved bot game, and the session stays open. Sessions older than **24 h** auto-forfeit on the next `vault_bot_start` or check-in.
- `publicProfiles()` should expose `botStats` and whether a session is open (for the UI).
- *Optional hardening:* the server issues `seed` and the client uses a seeded RNG for bot-game dice. The finish message sends the roll log, and the server replays dice counts. Nice to have, not required for v1.

✅ Done when an isolated-server E2E script covers: start Hard with too few 💎 (error), start Hard (stake deducted), finish win (paid once; a duplicate finish is ignored), an implausible finish (rejected), comeback and streak maths, and the 24 h expiry.

### Phase 6: Polish and verify
- The Vault "how to earn" list in vault.js (~L749) gets the bot lines.
- Victory screen for bot mode: the server-confirmed payout, the streak flame, and a "Rematch" button (same level).
- iPhone viewport screenshots of the picker, bot thinking, bot buying, a duel vs the bot, the Hard win and the Hard loss.
- Bump the `?v=` cache strings in [index.html](file:///Users/thanapat/Documents/nookairline/public/index.html) for every changed asset, and add new `<script>` tags (rules → bot → monopoly).

---

## 4. Testing rules (must follow)

> [!CAUTION]
> **Never test against the real `data/` directory or the live server on port 3000.** It holds the couple's real 💎 and saves.

- **Isolated server:**
  ```sh
  rm -rf /tmp/nookbot && mkdir -p /tmp/nookbot && cp server*.js /tmp/nookbot/ && cp -R data /tmp/nookbot/ \
   && ln -s "$PWD/public" /tmp/nookbot/public && ln -s "$PWD/node_modules" /tmp/nookbot/node_modules \
   && (cd /tmp/nookbot && PORT=3998 node server.js)
  ```
- Browser tests: `puppeteer-core` with system Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`), viewport `402×874`, `isMobile`, `hasTouch`, and the URLs `/bkk` and `/dxb`. Collect `pageerror` and console errors; the target is **zero**.
- Run `node -c` on every changed JS file.
- **Production restart:** only after asking the owner. Back up first with `cp -R data data_backups/data_$(date +%Y%m%d_%H%M%S)`. The server runs as `node server.js` on :3000 behind a cloudflared tunnel; the tunnel doesn't need restarting.

## 5. Style constraints
- Vanilla JS/CSS only, matching the existing code style. Keep all existing comments and docstrings.
- Quality bar for the UI: cute and polished, with micro-animations. It must fit 402×874 with no overflow.
- Write small focused modules (`monopoly_rules.js`, `monopoly_bot.js`, `server_monobot.js`) instead of growing monopoly.js further.

## 6. Suggested order and size
| Phase | Size |
|---|---|
| 1. Remove partner-play and add pause | S |
| 2. Rules module and bot brain | M–L (the refactor is the risky part) |
| 3. Client bot mode | M |
| 4. Simulator and tuning | M |
| 5. Server authority | S–M |
| 6. Polish and verify | S |

Report back to the owner after Phase 4 with the measured win rates and proposed 💎 numbers **before** shipping Phase 5's final values.
