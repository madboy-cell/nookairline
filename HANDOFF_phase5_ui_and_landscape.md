# HANDOFF: Phase 5 UI & Town Landscape

> Engineering handoff for the **(A) UX/UI Specialist** and **(B) Town Landscape Builder** agents.
> Covers Phase 5 modules: 5A Grand Starlight Casino, 5B Town Hall & Hall of Fame, 5C Owl Gifting / VIP / Passport / Founder, and 5D WebRTC Voice Calls.

---

## 0. Status & How to Run

### Test Suite Status
- **Current Passing Tests**: `173 / 173 passing` (0 fail, 0 skipped, run time ~1.6s).
- **Run command**:
  ```bash
  cd /Users/thanapat/Documents/neora-world-v3/neora-world-v2
  npm test
  ```

### Development Server
- **Start command**:
  ```bash
  npm start
  # Defaults to PORT=4000 (or specify PORT=4005 npm start)
  ```
- **Default Port**: `4000` (`http://localhost:4000`)
- **Seeded Login Credentials**:
  - `nook` / `1234` (Boy avatar, Nyx Drake pet, Castle Lv.30, equipped with Sovereign titles)
  - `beam` / `1234` (Girl avatar, Capybara pet, bound partner to Nook)
  - Other seeded test profiles: `neen`, `mochi`, `leo`
- **One-Click Dev Login URL**:
  - `http://localhost:4000/?dev=1&user=nook&pass=1234`

### Smoke Verification Script & QA Artifacts
- **Automated Smoke Test**:
  ```bash
  node scripts/smoke_phase5.js
  ```
  Spawns an isolated server instance on port 4005, runs headless Chrome via Puppeteer (390×844 mobile viewport), executes the full lifecycle (Town Hall switch, Fountain trigger, Hall of Fame worship, Solo Pok-Deng hand, Solo Roulette spin, Bag Passport inspection, and Founder Heritage claim).
- **Recorded QA Screenshots**:
  - [01_townhall_fountain.png](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/qa_artifacts/phase5/01_townhall_fountain.png) — Town Hall dock switch, 3D scene active, radar visible, proximity prompt at Fountain.
  - [02_hall_of_fame_worshipped.png](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/qa_artifacts/phase5/02_hall_of_fame_worshipped.png) — Hall of Fame modal, 5 statue cards, leaderboard rows, worship button state.
  - [03_pokdeng_result.png](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/qa_artifacts/phase5/03_pokdeng_result.png) — Pok-Deng table felt, dealer hand, player seats, settled hand payout.
  - [04_roulette_result.png](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/qa_artifacts/phase5/04_roulette_result.png) — Zeus Lightning Roulette felt, strikes banner, betting grid, history badges.
  - [05_passport_card.png](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/qa_artifacts/phase5/05_passport_card.png) — Bag tab Daily Passport quests, couple streak badge, stamp count.
  - [06_founder_claimed.png](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/qa_artifacts/phase5/06_founder_claimed.png) — Founder Pack modal with 4 reward tiles and claimed confirmation.

---

## 1. Architecture Map (Modules 5A – 5D)

Protocol specifications are documented in [PHASE5_PROTOCOL.md](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/PHASE5_PROTOCOL.md). The architecture is cleanly divided into deterministic shared math, server-authoritative state services, and client presentation controllers:

| Module | File | Layer | Responsibility |
| :--- | :--- | :--- | :--- |
| **5A** | [shared/casino_rules.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/casino_rules.js) | Shared Math | Pure card mechanics, Pok/Deng evaluations, roulette payouts, lightning strikes, RNG |
| **5A** | [server/casino_service.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/casino_service.js) | Server | Casino table lifecycle, betting phase timers, gold escrow & settlement, chest rolls |
| **5A** | [client/js/table_hub.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/table_hub.js) | Client | Table Hub lobby, mode switching (`monopoly`/`casino`), 4-seat room selection |
| **5A** | [client/js/minigames/casino/casino_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/casino/casino_ui.js) | Client | Fullscreen Pok-Deng & Roulette game screen, chip selection, betting grid, timers |
| **5A** | [client/css/casino.css](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/css/casino.css) | Client Style | Styling for casino felts, cards, chips, roulette betting cells, voice widgets |
| **5B** | [shared/phase5_rules.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/phase5_rules.js) | Shared Math | Constants for `TOWNHALL` (size 36m, 14 landmarks), `HALL_CATEGORIES`, `CHEER` |
| **5B** | [server/daily_service.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/daily_service.js) | Server | Hall of Fame rankings, daily worship, global cheer broadcasts, passport sync |
| **5B** | [client/js/town_hall_scene.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/town_hall_scene.js) | Client 3D | Three.js 36m×36m plaza scene graph (`townhall_root`), landmark proxies, raycast pick |
| **5B** | [client/js/town_hall_radar.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/town_hall_radar.js) | Client | 64×64 mini-radar canvas, full map modal, off-screen partner wayfinder edge pill |
| **5B** | [client/js/hall_of_fame_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/hall_of_fame_ui.js) | Client | 5 Champion statue cards, 5 leaderboard tabs, player inspect modal, worship button |
| **5B** | [client/js/main.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/main.js) | Client | Town Hall dock routing, landmark action dispatcher, jackpot cheer ticker listener |
| **5B** | [client/css/phase5.css](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/css/phase5.css) | Client Style | CSS for prompt pill, mini-radar, town map modal, hall of fame cards, cheer banner |
| **5C** | [shared/phase5_rules.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/phase5_rules.js) | Shared Math | Constants for `OWL` delivery, `VIP_CARDS`, `QUESTS`, `PASSPORT`, `FOUNDER` |
| **5C** | [server/daily_service.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/daily_service.js) | Server | Owl parcel dispatch/claim, VIP cards purchase/use, daily quest bumps, founder unbox |
| **5C** | [client/js/gacha_forge_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/gacha_forge_ui.js) | Client | Bag tab Phase 5 cards: VIP calling cards, passport quests, owl wrapper & inbox, founder |
| **5D** | [shared/phase5_rules.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/phase5_rules.js) | Shared Math | `CALL` constants (15 min ticker, diamond rewards, ring/grace timeouts, max signal) |
| **5D** | [server/voice_call_service.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/voice_call_service.js) | Server | WebRTC 1-on-1 signaling relay, permission checks, glare resolution, 15m diamond reward |
| **5D** | [client/js/voice_call_client.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js) | Client | WebRTC audio connection, VAD detection, audio ducking, `#incoming-call-banner`, `#voice-call-pill` |

---

## 2. FOR THE UX/UI SPECIALIST

### Core Rules for UI Development
1. **Keep All Existing IDs and `data-*` Action Hooks Stable**: Backend listeners, socket event handlers, and smoke tests attach directly to these exact attributes.
2. **Style via CSS & Markup Wrappers**: Wrap existing controls in your styled containers, decorative parchment borders, and flex/grid layouts. Do not remove or rename action attributes.
3. **Art Slicing Pipeline**:
   - Processed sprite assets belong in `client/assets/<category>/`.
   - The standalone Sky Monopoly slicer [scripts/slice_pack_4a.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/scripts/slice_pack_4a.js) **MERGES** into `client/assets/monopoly/manifest_4a.json` without overwriting existing entries.
   - For general assets, use `scripts/process_art_assets.js`.

---

### Screen 05: Town Hall Plaza & Mobile HUD
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/town_hall_hud_style2_prototype_1792008817600.jpg`
- **Condensed Checklist**:
  - Top header HUD (Avatar left with level/XP, currency pills right: gold, berries, diamonds).
  - Floating On-Call pill attached to header or floating top-center (`📞 On Call 32:10 • +20 💎`).
  - Circular mini-radar top-right (64×64).
  - Proximity speech prompt when near POIs (`🎰 [2/4] Casino Pok-Deng — Tap to Sit!`).
  - Bottom-left virtual joystick pad; bottom-right quick action buttons (`🪑 Create Table`, `💖 Sync Pose`).
  - Docked 5-tab bottom navigation bar (`Village`, `Town Hall` [Active], `Play`, `Wardrobe`, `Gacha`).
- **Exact Existing DOM Containers**:
  - Header: `<header class="hud-top">` in [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html#L29-L46)
  - Radar: `<canvas id="hud-mini-radar" class="hud-mini-radar" width="64" height="64" hidden>`
  - Proximity Prompt: `<div id="landmark-prompt" class="landmark-prompt" hidden>` in [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html#L49)
  - Bottom Dock: `<nav id="bottom-dock">` in [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html#L181-L187)
  - Virtual Joystick: `<div id="joystick" class="joystick-pad">` in [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html#L54-L56)
- **DOM Hooks & Action Attributes**:
  - `data-dock="village"` / `data-dock="townhall"` / `data-dock="play"` / `data-dock="wardrobe"` / `data-dock="gacha"`
  - Proximity prompt: `#landmark-prompt[data-landmark="<id>"]`, button `.prompt-btn`
  - Radar: `#hud-mini-radar` (click opens `#town-map-modal`)
- **State Payload Fields Driving Screen 05**:
  - `instance_snapshot`: `{ instanceId, layout:{ kind:'townhall', size:36 }, players:[...] }`
  - Profile currencies: `p.gold`, `p.berries`, `p.diamonds`, `p.level`, `p.cp`
- **What is Built vs Placeholder**:
  - Built: 5-tab dock navigation with instance switching, proximity prompt `#landmark-prompt`, 64×64 canvas radar, profile currencies.
  - Unbuilt / Placeholder: Floating bottom-right quick pills (`🪑 Create Table`, `💖 Sync Pose`) on the Town Hall overlay are not yet added to HTML.

---

### Screen 06: Hall of Fame 5 Statues & Cheer Ticker
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/proto_11_hall_of_fame_statues_cheer_ux_png_1792010117504.jpg`
- **Condensed Checklist**:
  - Server Jackpot cheer ticker banner floating below HUD with live countdown and claim button.
  - 5 Golden champion pedestals / statue cards (V-formation preview or grid).
  - Leaderboard parchment card with 5 category filter tabs (`Architect`, `Gear`, `Arcade`, `Tycoon`, `Couples`).
  - Top 10 rank rows with laurels (🥇, 🥈, 🥉), player name, title, score, and action buttons (`🔍 Inspect`, `🏠 Visit`).
  - Full-width gold footer action button (`🙏 Worship the 5 Champions`).
- **Exact Existing DOM Containers**:
  - Cheer Banner: `<div id="global-cheer-banner" class="global-cheer-banner" hidden>` in [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html#L47)
  - Hall Modal: `<div id="hall-of-fame-modal" class="modal-wrap hall-of-fame-modal" hidden>` in [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html#L179)
- **DOM Hooks & Action Attributes**:
  - Cheer banner claim: `[data-act="cheer-claim"][data-cheer-id="..."]` (dispatches `cheer_claim`)
  - Statue cards: `[data-hall-cat="architect|gear|arcade|tycoon|couple"]`
  - Category tabs: `[data-cat-tab="architect|gear|arcade|tycoon|couple"]`
  - Leaderboard rows: `[data-inspect-user="<uid>"]` (inspect dossier), `[data-visit-user="<uid>"][data-visit-name="..."]` (visit island)
  - Worship button: `[data-act="hall-worship"]` (dispatches `hall_worship`)
  - Dossier close: `[data-act="close-inspect"]`
- **State Payload Fields Driving Screen 06**:
  - `hall_list` response: `{ ok:true, day, worshippedToday:boolean, categories:[ { key, label, icon, rows:[ { rank, userId, username, value, title, cp, worship_count } ] } ] }`
  - `global_cheer_banner` broadcast: `{ cheerId, winnerName, achievement, expiresAt }`
- **What is Built vs Placeholder**:
  - Built: Full data flow, category tabs, statue cards, leaderboard ranking, worship claim (disables and saves to server profile), inspect dossier modal, live cheer countdown ticker.
  - Placeholder: `data-visit-user` displays a temporary toast ("Visiting <name>'s kingdom coming soon!").

---

### Screen 08: Bag, VIP Calling Cards & 2-Slot Owl Gift Wrapper
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/proto_8_bag_vip_gift_wrap_ux_1792010112508.jpg`
- **Condensed Checklist**:
  - Upper VIP Calling Cards showcase grid (Day-Pass 300💎, Communicator 2500💎, Telelink 4500💎, Black VIP 9900💎) with Buy, Gift, and Use buttons.
  - Inventory items grid with count badges (`streak_freeze`, `vip_call_day_pass`, etc.).
  - 2-slot Owl Gift Wrapper with recipient dropdown, Slot 1 (gear transfer/dupe or decor), Slot 2 (bag item or berries ≤200), note input (max 80 chars), ribbon selector, dynamic postage calculator (25 berries for partner, 50 for friends), and dispatch button.
- **Exact Existing DOM Containers**:
  - Bag Tab Container: Rendered inside Gacha/Forge UI (`#rpg-body`) when opening Wardrobe -> Bag tab.
  - VIP Showcase: `<div class="s2-vip-showcase-row">`
  - Owl Wrapper: `<div class="rpg-card s2-owl-gift-card">` in [client/js/gacha_forge_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/gacha_forge_ui.js#L1892)
- **DOM Hooks & Action Attributes**:
  - VIP cards: `[data-vip-card="call_day_pass|vip_communicator|telelink_box|black_vip"]`
  - VIP actions: `[data-act="vip-buy"]`, `[data-act="vip-gift"]`, `[data-act="vip-use"]`
  - Owl inputs: `#owl-to`, `#owl-slot1`, `#owl-slot2`, `#owl-note`, `[data-ribbon="pink|gold|sky|mint"]`
  - Owl postage preview: `#owl-postage-amount`, `#owl-postage-hint`
  - Owl dispatch button: `[data-act="owl-send"]`
- **State Payload Fields Driving Screen 08**:
  - `p.vip`: `{ call_until:number, communicator:boolean, black:boolean, telelinks:string[] }`
  - `p.bag_items`: inventory count dictionary
  - `p.partner_id`, `p.friends`
- **What is Built vs Placeholder**:
  - Built: Full server validation (level 10 gate, partner discount, dupe vs transfer refine preservation, 3 parcels/day limit).
  - Unbuilt: Styling can be elevated to match the mockup's parchment layout with custom owl mascot frames.

---

### Screen 09: Universal 4-Seat Table Hub
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/proto_2_universal_4seat_table_hub_ux_1792009174509.jpg`
- **Condensed Checklist**:
  - Modal title `🎮 PLAY & 4-SEAT TABLE HUB` with close button `✕`.
  - 4 game category tabs (`🎲 Sky Monopoly`, `🎰 Grand Casino`, `🌙 Moon Bunny`, `☁️ Cloud Dash`).
  - 4-seat table stage with 2.5D chairs (Host seat, partner/guest seats, bot seats with AI selector, empty chair to invite/sit).
  - Sub-mode casino picker when in Casino tab (`Pok-Deng` vs `Zeus Lightning Roulette`).
  - Live open tables list with occupancy badges (`🪑 2/4 Seats`) and join buttons.
  - Dual footer buttons: `⚡ Play Solo Now (Instant)` and `🚀 Launch 4-Player Match!`.
- **Exact Existing DOM Containers**:
  - Table Hub Root: `<div class="hub-wrap">` in [client/js/table_hub.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/table_hub.js#L60)
- **DOM Hooks & Action Attributes**:
  - Close button: `[data-act="close"]`
  - Game tabs: `[data-tab="monopoly|casino|bunny|dash"]`
  - Casino game toggle: `[data-casino-game="pokdeng|roulette"]`
  - Table chairs: `[data-seat="0..3"]`
  - Bot difficulty selector: `select[data-act="botdiff"]` (options `easy`, `hard`, `insane`)
  - Invite friend: `[data-act="invite"]`
  - Live tables list join: `[data-join="<tableId>"]`
  - Solo start: `[data-act="solo"]`
  - Multi start / ready: `[data-act="launch"]`
- **State Payload Fields Driving Screen 09**:
  - `table_state`: `{ table:{ id, num, mode, status, seats:[ { kind:'human'|'bot'|'empty', userId, name, diff, ready } ], options:{ casinoGame } } }`
  - `table_list`: array of open tables
- **What is Built vs Placeholder**:
  - Built: Monopoly & Casino modes fully functional; public table list updates; solo match against 3 bots; difficulty settings.
  - Locked: Moon Bunny & Cloud Dash tabs are locked with friendly tooltip ("opens in a later phase").

---

### Screen 12: Casino Pok-Deng
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/casino_pokdeng_style2_prototype_1791988738303.jpg`
- **Condensed Checklist**:
  - Immersive portrait casino screen (table header, table ID, round badge, phase timer bar, exit button).
  - Center green felt area with Dealer cat station (dealer cards, Pok indicator, speech bubble).
  - 4 player stations around the table (seat name, bet gold badge, cheer indicator 🥂, 2-3 cards, hand info label, outcome settle overlay).
  - Bottom chip rack (100, 500, 1000, MAX 5000).
  - Bottom 3-button action tray: `🃏 HIT / DRAW`, `👑 STAY / STAND`, `🥂 CHEER (+5% Luck)`.
- **Exact Existing DOM Containers**:
  - Fullscreen Casino Root: `<div id="casino-root" class="casino-fullscreen" data-casino-game="pokdeng">` in [client/js/minigames/casino/casino_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/casino/casino_ui.js#L63)
- **DOM Hooks & Action Attributes**:
  - Phase countdown & bar: `#casino-phase`, `#casino-phase-fill`
  - Dealer station: `#casino-dealer`, `#casino-dealer-cards`, `#casino-dealer-info`
  - Seats: `.casino-seat[data-seat="0..3"]`
  - Chip selection: `.casino-chip[data-chip="100|500|1000|5000"]`
  - Action buttons: `[data-act="hit"]`, `[data-act="stay"]`, `[data-act="cheer"]`, `[data-act="exit"]`
- **State Payload Fields Driving Screen 12**:
  - `casino_state`: `{ tableId, game:'pokdeng', phase:'betting'|'deal'|'action'|'dealer', phaseEndsAt, seats:[CasinoSeat], dealer:{ cards:[{r,s}], info:{ points, pok, mult, label, deng } } }`
  - `casino_result`: `{ game:'pokdeng', round, dealer, seats:[ { seat, cards, info, settle:{ outcome:'win'|'lose'|'push', profit, returned, extraLoss }, chest:boolean } ] }`
- **What is Built vs Placeholder**:
  - Built: Pure deterministic math engine; full 12s hand cycle (`betting 4s -> deal 2s -> action 4s -> dealer 2s`); Sunken Dupe Chest rolling on bets ≥ 500 (capped 5/day); Cheer +5% luck toggle. Fully operational.

---

### Screen 13: Zeus Lightning Roulette
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/proto_3_casino_zeus_roulette_ux_png_1792009174532.jpg`
- **Condensed Checklist**:
  - Top header with Table badge, Round badge, and Phase timer.
  - Lightning strikes banner (`⚡ #7 RED = 100x LIGHTNING!`).
  - History ticker badges (last 12 winning spins with strike multipliers) & countdown timer (`⏱️ Spin in 04s...`).
  - Interactive green felt betting grid:
    - Crown `0` spot (straight 30×).
    - Numbers grid 1 to 36.
    - Columns (`Col 1..3`, 3×) & Dozens (`1st/2nd/3rd 12`, 3×).
    - Outside bets (`RED 2×`, `BLACK 2×`, `EVEN 2×`, `ODD 2×`).
  - Bottom chip rack (100, 500, 1000, MAX 5000) & Bet Summary (`🪙 <total> / 25,000`).
  - Betting action buttons: `🔄 Re-Bet`, `✖2 Double`, `🗑️ Clear`.
- **Exact Existing DOM Containers**:
  - Casino Root: `<div id="casino-root" class="casino-fullscreen" data-casino-game="roulette">`
  - Strikes Banner: `#roulette-strikes`
  - History & Countdown: `#roulette-history`, `#roulette-countdown`
  - Betting Grid Container: `.roulette-grid-container` in [client/js/minigames/casino/casino_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/casino/casino_ui.js#L503)
- **DOM Hooks & Action Attributes**:
  - Betting cell clicks: `[data-bet-type="straight|dozen|column|red|black|even|odd"]` (with optional `data-n="0..36"` or `1..3`)
  - Chips: `.casino-chip[data-chip="..."]`
  - Action tray: `[data-act="rebet"]`, `[data-act="double"]`, `[data-act="clear"]`, `[data-act="exit"]`
- **State Payload Fields Driving Screen 13**:
  - `casino_state`: `{ game:'roulette', phase:'betting'|'spin'|'result', phaseEndsAt, strikes:[ { n, mult } ], history:[ { number, color, strikes } ] }`
  - `casino_result`: `{ game:'roulette', round, number, color, strikes, seats:[ { seat, total, returned, profit, wins, bigHit } ] }`
- **What is Built vs Placeholder**:
  - Built: 15s spin cycle (`betting 8s -> spin 5s -> result 2s`); multi-spot betting (up to 20 spots, max 5,000/spot, max 25,000 total); BigHit (≥100×) triggers global server jackpot cheer banner. Fully operational.

---

### Screen 17: Couple Bridge, Call Switchboard & Friends
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/proto_5_couple_bridge_social_hub_ux_1792009175480.jpg`
- **Condensed Checklist**:
  - Upper Rainbow Bridge scene with quick partner actions (`💧 Bless Partner's Land +15%`, `⚡ Teleport to Partner`).
  - Center Call Switchboard card with live audio visualizer waveform, Mute, Auto-Duck toggle, 1-Tap Polaroid, and End Call buttons.
  - Lower Social Directory with 3 tabs (`💖 Couple Sanctuary`, `🤝 Friends Online (14/200)`, `🎟️ VIP Call Cards`).
  - Friend list rows with status dots and direct action buttons (`Visit`, `Call`, `Gift`, `Sit at Table`, `Bless`).
- **Exact Existing DOM Containers**:
  - Floating Call Pill: `<div id="voice-call-pill">` in [client/css/casino.css](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/css/casino.css#L517)
  - Remote Audio: `<audio id="voice-remote-audio" autoplay playsinline hidden>`
  - Village actions container: `<div id="village-actions">` in [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html#L59) (`#act-bless` button)
- **DOM Hooks & Action Attributes**:
  - In-call pill buttons: `[data-call="mute"]`, `[data-call="hangup"]`
  - Speaking indicator: `#voice-call-pill[data-speaking="local|remote|both"]`
  - Bless button: `#act-bless` (calls `village_bless_partner`)
- **State Payload Fields Driving Screen 17**:
  - Voice call messages: `call_connected`, `call_reward`, `call_ended`
  - Profile friends and partner: `p.partner_id`, `p.friends`, `p.vip`
- **What is Built vs Placeholder**:
  - Built: WebRTC 1-on-1 voice client ([client/js/voice_call_client.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js)), VAD audio level events (`voice:speaking`, `voice:duck`), floating status pill, 15-minute uncapped diamond rewards (+20💎 / +30💎 black VIP), partner blessing logic.
  - **UNBUILT / PLACEHOLDER**: The unified Screen 17 dialog modal (Center Call Switchboard card with pulsing waveform canvas, Auto-duck button, 1-Tap Polaroid, and the Lower 3-tab Social Directory with friend rows `Visit`/`Call`/`Gift`) has **NOT** yet been constructed. Only the underlying voice engine and separate floating pills exist today.

---

### Screen 18: Couple Passport, Call Ticker & Owl Inbox
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/couple_passport_gift_style2_prototype_1791989042067.jpg`
- **Condensed Checklist**:
  - Romantic balcony header with Couple Streak counter (`💖 42-Day Couple Streak!`).
  - Floating translucent call bar with timer, participants, and diamond incentive.
  - Royal Owl Postbox container with pending gifts (`🎁 Gift from Partner`) and Claim button.
  - Daily Passport stamp progress and Day 7 milestone parcel claim (`📜 Day 7 Passport Stamp: Summon Tickets 🎟️ x2 + 100 💎`).
  - Dual bottom action buttons: `🎁 Send Fashion / Gift to Partner` and `🫶 Trigger Couple Sync Pose (+25% Village Bonus)`.
- **Exact Existing DOM Containers**:
  - Passport Card: `<div class="rpg-card s2-passport-card" id="passport-card">` in [client/js/gacha_forge_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/gacha_forge_ui.js#L1804)
  - Owl Inbox: `<div class="rpg-card s2-owl-inbox-card" id="owl-inbox">` in [client/js/gacha_forge_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/gacha_forge_ui.js#L1947)
- **DOM Hooks & Action Attributes**:
  - Passport quest claim buttons: `[data-act="passport-claim"][data-quest="play|harvest|pet|bonus"]`
  - Mail claim buttons: `[data-act="owl-claim"][data-mail-id="<id>"]`
- **State Payload Fields Driving Screen 18**:
  - `passport_state` response: `{ passport:{ day, stamps, progress, claimed }, quests:[ { key, label, goal, progress, reward, claimed } ], bonus:{ reward:30, claimed } }`
    *(Progress is clamped to goal via `Math.min(progress, goal)`)*
  - `p.mailbox`: array of mail objects `{ id, from, fromName, sentAt, items:[MailItem], note, ribbon, claimed }`
- **What is Built vs Placeholder**:
  - Built: Complete Daily Passport quest system, progress clamping, bonus diamond claims, automatic 7th stamp parcel delivery to mailbox, mail claim unpacking into inventory/currencies.
  - Location Note: Currently lives as separate cards inside the Bag tab of Gacha/Forge UI. The dedicated Balcony full-screen wrapper from the mockup can be styled around them.

---

### Screen 25: Incoming Call Banner & Founder Unbox
- **Mockup Path**: `/Users/thanapat/Documents/neora-world-v3/neora_world_v2_export/assets/proto_14_incoming_call_founder_unbox_ux_v2_png_1792010143266.jpg`
- **Condensed Checklist**:
  - Floating top incoming voice call alert banner with caller avatar, VIP badge, diamond reward subtext, and vertical action buttons: `📞 [Accept & Unmute]` and `[Busy]`.
  - Founder Unbox celebration modal (`WELCOME HOME, SKY PARTY V1 VETERAN!`).
  - 4 reward item tiles: Title (`'Sky Party Founder'`), `1,000 Diamonds`, `Mythic Outfit Selector Box`, `40 Star Essence`.
  - Secret founder code input (`SKYPARTY-V1`).
  - Gold claim button: `[CLAIM FOUNDER'S PACK & EQUIP TITLE!]`.
- **Exact Existing DOM Containers**:
  - Incoming Call Banner: `<div id="incoming-call-banner">` in [client/css/casino.css](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/css/casino.css#L457)
  - Founder Modal: `<div id="founder-modal" class="modal-wrap founder-modal" hidden>` in [client/js/gacha_forge_ui.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/gacha_forge_ui.js#L1972)
- **DOM Hooks & Action Attributes**:
  - Call actions: `[data-call="accept"]` (accepts & unmutes mic), `[data-call="decline"]` (declines call)
  - Founder code input: `<input id="founder-code">`
  - Founder claim: `[data-act="founder-claim"]` (dispatches `founder_claim`)
  - Founder modal triggers: `[data-act="open-founder"]` (Bag tab banner button), `[data-act="close-founder"]` (close button)
- **State Payload Fields Driving Screen 25**:
  - `call_incoming`: `{ callId, from, fromName, vip }`
  - `founder_claim` response: `{ ok:true, granted:{ title, diamonds, box, essence } }`
  - Profile state: `p.founder_claimed` (boolean)
- **What is Built vs Placeholder**:
  - Built: Both the top incoming call banner and the Founder Unbox modal are 100% wired to the server and functional.

---

### Minimap / Radar
- **Exact Existing DOM Containers**:
  - Mini-Radar Canvas: `<canvas id="hud-mini-radar" class="hud-mini-radar" width="64" height="64" hidden>`
  - Town Map Modal: `<div id="town-map-modal" class="modal-wrap town-map-modal" hidden>`
  - Wayfinder Edge Pill: `<button type="button" class="wayfinder-edge-pill" hidden>`
- **DOM Hooks & Action Attributes**:
  - Mini-radar click: opens `#town-map-modal`
  - Town map walk targets: `.town-map-row[data-walk-x="<x>"][data-walk-z="<z>"]` (calls `world.walkTo(x, z)`)
  - Wayfinder edge pill click: auto-walks player toward off-screen partner
- **What is Built**:
  - 10 Hz canvas rendering showing crosshairs, landmark gold dots, player white dot, partner pink dot, friend green dots. Off-screen partner direction arrow (↑ ↗ → ↘ ↓ ↙ ← ↖) and distance indicator.

---

## 3. FOR THE TOWN LANDSCAPE BUILDER

### Plaza Dimensions & Coordinate Space
- **Plaza Size**: Exactly **36m × 36m** square.
- **Coordinate Bounds**: `x ∈ [-18, 18]`, `z ∈ [-18, 18]`.
- **Spawn Point**: `(0, 6)` (facing north towards the Starlight Fountain and Statue colonnade).

### Three.js Scene Graph Hierarchy
The Town Hall plaza is managed by [client/js/town_hall_scene.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/town_hall_scene.js). Its root is added directly to `world.scene`:

```
world.scene
  └── townhall_root (THREE.Group, toggled visible by instance switch)
        ├── th_ground      (THREE.Group: ground plane & border ring)
        ├── th_landmarks   (THREE.Group: 14 landmark groups named by landmark id)
        └── th_decor       (THREE.Group: currently EMPTY — RESERVED FOR YOU!)
```

### Landmark Anchors & Trigger Radii
Every landmark child group inside `th_landmarks` is named with its exact `landmarkId` and populated with `userData: { landmarkId, action, label, icon }`.

> [!IMPORTANT]
> The server, radar, proximity trigger system (`TRIGGER_R = 2.4m`), and raycaster depend strictly on these landmark IDs, positions, and group names.
> If a landmark MUST be moved, update **`TOWNHALL.LANDMARKS` in [shared/phase5_rules.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/phase5_rules.js) ONLY**, which serves as the single source of truth.

| Landmark Group Name | Coordinates (x, z) | Proximity Trigger | Click / Prompt Action | Target Subsystem |
| :--- | :--- | :--- | :--- | :--- |
| `fountain` | `(0, 0)` | 2.4 m | `gacha_shard_shop` | Opens Gacha & Shard Shop |
| `statue_1` | `(-8, -13)` | 2.4 m | `hall_of_fame` (architect) | Hall of Fame #1 Empire Architect |
| `statue_2` | `(-4, -14)` | 2.4 m | `hall_of_fame` (gear) | Hall of Fame #1 Gear Sovereign |
| `statue_3` | `(0, -14.5)` | 2.4 m | `hall_of_fame` (arcade) | Hall of Fame #1 Arcade Defender |
| `statue_4` | `(4, -14)` | 2.4 m | `hall_of_fame` (tycoon) | Hall of Fame #1 Monopoly Tycoon |
| `statue_5` | `(8, -13)` | 2.4 m | `hall_of_fame` (couple) | Hall of Fame #1 Couple Harmony |
| `casino_palace` | `(-10.5, -5.5)` | 2.4 m | `table_hub_casino` | Opens Table Hub (Casino tab) |
| `monopoly_arch` | `(10.5, -5.5)` | 2.4 m | `table_hub_monopoly` | Opens Table Hub (Monopoly tab) |
| `forge` | `(10, 4.5)` | 2.4 m | `forge` | Opens Blacksmith Forge |
| `owl_postbox` | `(-5, 2.5)` | 2.4 m | `owl_postbox` | Opens Wardrobe -> Bag Owl Inbox |
| `vip_table_1` | `(-6, 8)` | 2.4 m | `table_hub_sit` | Opens Table Hub (Seat 1) |
| `vip_table_2` | `(6, 8)` | 2.4 m | `table_hub_sit` | Opens Table Hub (Seat 2) |
| `vip_table_3` | `(-11, 2)` | 2.4 m | `table_hub_sit` | Opens Table Hub (Seat 3) |
| `vip_table_4` | `(11, 10)` | 2.4 m | `table_hub_sit` | Opens Table Hub (Seat 4) |

### Building Guidelines for `th_decor`
1. **Walkable Space**: Maintain at least 2.0m clearance around each landmark anchor and a clear walking thoroughfare from spawn `(0, 6)` to the fountain and statue colonnade.
2. **Mobile Performance Budget**:
   - Limit total scene draw calls. Prefer merged geometry (`BufferGeometryUtils.mergeGeometries`) for static plaza architecture, benches, fences, and cobblestones.
   - For foliage and trees, reuse the 2.5D billboard sprite pipeline from [client/js/village_plaza.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/village_plaza.js).
   - Pixel ratio on touch devices is capped at 1.5. Avoid heavy fragment shaders or complex dynamic lighting.
3. **Where Existing Art Assets Live**:
   - Landmark definitions & props: [shared/catalog_landmarks.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/catalog_landmarks.js) (`WONDERS`, `DECOR`, `ENV_PROPS_25D`).
   - Village & nature textures: `client/assets/village/`
   - Wonder and monument sprites: `client/assets/landmarks/`
   - UI badges & icons: `client/assets/ui/`

---

## 4. Key Gameplay Decisions & Caveats

1. **Cheer Mechanics**:
   - Toggling 🥂 Cheer in Pok-Deng costs **5% of the bet (min 10 🪙)**. It pays an extra **+5% of profit** on a win and increases Sunken Dupe Chest drop chance by **+5%**.
2. **Sunken Dupe Chest**:
   - Requires a minimum bet of **≥ 500 🪙**; capped at **5 chests per UTC day** per player to prevent micro-bet farming.
3. **Pok-Deng Economy**:
   - House takes a **5% commission on profit** on player wins (offset by Cheer).
   - When a player loses to a dealer Deng hand (e.g. 2 Deng, 3 Deng, 5 Deng), the **loser pays the dealer's Deng multiplier**.
4. **Roulette RTP & Odds**:
   - Payout multipliers: Straight 30×, Dozens/Columns 3×, Even/Odd/Red/Black 2×.
   - RTP is calibrated to **~96% Pok-Deng**, **~97% Roulette outside bets**, and **~92% Roulette straight bets**.
5. **Mid-Hand Disconnects & Leaving**:
   - Leaving a casino table while a hand is active settles the bet immediately according to the final outcome. Escrowed bets are **not refunded** after the betting phase closes.
6. **Founder Heritage Code**:
   - `SKYPARTY-V1` is universally claimable once per account when `FOUNDER.CODE_ENABLED` is true in `shared/phase5_rules.js`. Seeded accounts (`nook`, `neen`, `beam`, `mochi`, `leo`) are eligible by default without entering a code.
7. **Owl Parcel Transfer Rules**:
   - Sender must be **Level ≥ 10**. Deliveries permitted only to bound partner or friends.
   - Limit: **3 parcels per UTC day**. Postage is 50 🍓 (discounted to **25 🍓** for partner).
   - Gear transfer requires `dupes === 0` and item must not be equipped. Preserves existing refine level.
8. **Placeholder Metrics**:
   - `p.arcade_best` is a reserved placeholder field for Phase 6 minigames (Moon Bunny / Cloud Dash).
9. **WebRTC Production Requirements**:
   - For production networks with symmetric NATs, configure TURN server environment variables: `TURN_URL`, `TURN_USER`, `TURN_PASS`. Falls back to Google STUN in local development.
10. **State of Local Dev Database**:
    - The automated smoke test ran against the real local dev database. Consequently, the local `nook` profile has **already claimed** the Founder Pack and worshipped champions for today's UTC date.
11. **Monopoly Engine Updates**:
    - Monopoly board, pet movement, and dice skin changes developed in parallel are documented in [HANDOFF_monopoly_and_pets.md](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/HANDOFF_monopoly_and_pets.md).

---

## 5. Do-Not-Break Checklist

- [ ] **Protocol Message Names**: Never rename messages in [PHASE5_PROTOCOL.md](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/PHASE5_PROTOCOL.md) (`casino_bet`, `casino_hit`, `casino_stay`, `casino_cheer`, `casino_roulette_bets`, `hall_list`, `hall_worship`, `cheer_claim`, `owl_send_gift`, `owl_claim_mail`, `vip_card_buy`, `vip_card_use`, `passport_claim`, `founder_claim`, `call_invite`, `call_accept`, `call_hangup`, `call_signal`).
- [ ] **DOM IDs & Action Selectors**: Keep IDs (`#casino-root`, `#hud-mini-radar`, `#landmark-prompt`, `#town-map-modal`, `#hall-of-fame-modal`, `#passport-card`, `#owl-inbox`, `#founder-modal`, `#incoming-call-banner`, `#voice-call-pill`) and `data-*` attributes (`data-act`, `data-dock`, `data-tab`, `data-chip`, `data-bet-type`, `data-call`, `data-quest`, `data-vip-card`, `data-hall-cat`, `data-cat-tab`) stable.
- [ ] **Town Hall Landmark Group Names**: Keep group names in `th_landmarks` matching the 14 IDs in `TOWNHALL.LANDMARKS`.
- [ ] **Casino Phase Timings**: Do not alter `CASINO.POKDENG.PHASE_MS` (4s / 2s / 4s / 2s) or `CASINO.ROULETTE.PHASE_MS` (8s / 5s / 2s) without updating both client timer animations and server ticks.
- [ ] **Automated Test Suite**: Always run `npm test` after changes; all 173 tests must continue to pass.
