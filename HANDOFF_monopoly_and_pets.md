# HANDOFF: 2.5D Sky Monopoly & Pet System (V2 / V2.5 / Soul-Link)

**Project Root:** `/Users/thanapat/Documents/neora-world-v3/neora-world-v2` (Note: No `.git` repo — **always back up files before editing**)

**Relevant Brain Session Transcripts:**
- `49a5381a-52d8-4a2e-be2c-83722f279f45`: Step 4 Core Monopoly Build, Theme-Tag Home Turf, Mobile Vertical Camera, Dopamine Patch (Super Mythics, Pet Soul-Link Combo, Chaos Party Mode), Option A Mockup UI Refactor
- `91ae8e59-027a-4b91-8794-3b534fbdad68`: Pet System V2 ("Soul-Bond Companions"), 16 Painted Ultimate Monuments & Traps, 3-Beat Cast Animation, 13-Mythic Balance Pass
- `d76b8233-ec1c-442f-83a7-707f338bc9f1`: Pet System V2.5 (Lv. 1–30 Companion Level, Milestones, Nyx 3-Stage Redesign, 2-Slot Traits, Hunger & Online EXP Loop, Direct Adoption)
- `753bcef0-ad37-414d-acee-dceff4909f18`: Rim Turf / Cliff Z-Fighting Fix, 6 Painted Event Emblems, 5 Rotating Grand Landscape Courtyard Themes, Match Intro 100% Sync Loading Screen, Composite Hair+Outfit Portraits

---

# PART 1: 2.5D Sky Monopoly System

## 1. Architecture & Completed Features

### A. Deterministic Core Engine & Rules (`shared/`)
- **24-Tile (`6×8` Ring) Board & Economy** ([`shared/monopoly_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_rules.js#L8-L454), [`shared/monopoly_engine.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_engine.js#L38-L747)):
  - 16 property tiles across 6 color zones (`A..F`) + 8 event/corner tiles (`start`, `casino` High/Low/Lucky-7, `airdrop`, `vault`, `warp`, `arena` duel/sabotage).
  - Complete property & rent math: `rentFor` applies `MONO.RENT_MULT = [0.35, 0.80, 1.60, 3.00, 4.50]` across 5 tiers (Land, Cozy Villa, Luxury Hotel, Realm Landmark, Sovereign Monument). Normal building caps at `MAX_BUILD_TIER 3`; hostile takeover is available only at level 0–2 (`TAKEOVER_MAX_TIER 2`) and costs `2×` invested value, offered AFTER rent is auto-paid. Modifiers include Color Monopoly `1.6×`, Home Turf `1.15×`, owner `rent_boost`, `toll_boost`, `rent_cut`, and `globalRentMult`.
  - Auto-liquidation of lowest-value properties at `70%` refund (`raiseFunds`) before bankruptcy elimination (`goBankrupt`).
  - Couple Synergy: `+5%` rent when within 3 tiles of partner (`COUPLE_PROXIMITY_TILES: 3`) + `+25🪙` passing handshake + partner heart burst on Ult cast.
  - Anti-farming human-seat reward scaler (`SEAT_FACTOR`: `1H = 0.25× coins / 0× 💎`, `2H = 0.70×`, `3H = 0.90×`, `4H = 1.00×`) and daily `6 💎` cap (`DAILY_DIAMOND_CAP: 6`).
- **Theme-Tag Home Turf System** ([`shared/monopoly_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_rules.js#L118-L197)):
  - 6 zone themes (`spirit`, `desert`, `ocean`, `fortune`, `frost`, `celestial`). Costumes declare `affinity` tags in [`shared/season_skills.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/season_skills.js); `isHomeTurf(costumeId, tileIdx)` grants `+15%` rent (`MONO.HOME_TURF_RENT = 0.15`), `-15%` upgrade discount (`MONO.HOME_TURF_DISCOUNT = 0.15`), and a gold `🏠` HUD badge without hardcoding costume IDs to tiles.
- **Lego-Block Skill Engine & 15 Mythic / Super-Mythic Ultimates** ([`shared/skill_engine.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/skill_engine.js#L1-L317), [`shared/season_skills.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/season_skills.js#L27-L215)):
  - 13 Season Mythic skills (`s1_naga_sovereign` .. `s11_zeus_olympus`) + 2 Super Mythic skills (`sm_eclipse_dragon`, `sm_aurora_empress`, power-equalized to `powerRarity: 3` in PvP) + 2 Generic skills (`fortune_burst`, `arcane_shield`).
  - Tuned per-Mythic `BASE_CASH` (`1540..2500`) and skill numbers; verified across 3,600 Monte Carlo matches ([`tests/monopoly_sim.mjs`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/tests/monopoly_sim.mjs)) that all 15 costumes stay within the `14%–45%` win-rate band against 3 bots.
- **3-Tier Bot AI** ([`shared/monopoly_bots.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_bots.js#L1-L176)):
  - `easy`, `hard`, and `insane` bots evaluating liquidity reserve (`maxRivalRent`), color-set completion (`zoneInfo`), expected 2d6 landing EV (`expectedRoll`), and optimal target selection.
- **🎉 Chaos Party Mode** ([`shared/monopoly_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_rules.js#L62-L72), [`shared/monopoly_engine.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_engine.js#L417-L462)):
  - Toggleable on private/couple/friend/solo tables (`TableManager.setOption`).
  - 10 rounds, max-evolution pets (`1.0×` rate, `1.0` potency, `50%` start, uncapped casts), `2×` Ult gauge gain, `+30%` Soul-Link combos, random end-of-round Chaos Events (`meteor`, `rent_x2`, `swap`, `gold_rain`), and `0.5× 💎` reward outside the daily cap.

### B. 2.5D Three.js Board, Camera, Themes & VFX (`client/js/minigames/monopoly_25d/`)
- **Mobile Vertical Camera with Off-Axis Lens Shift** ([`board_scene.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L97-L119), [`L2199-L2276`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L2199-L2276)):
  - Preserves straight `6×8` portrait board (`52°` pitch, `32°` FOV).
  - Shifts `camera.projectionMatrix.elements[9] = -ndcY` so the optical center sits inside the safe band between top HUD cards and bottom controls (`setSafeBand`).
  - Gentle inward pull (`INWARD_X: 0.80, INWARD_Z: 0.82`) + 2-stage critically-damped springs (`smoothDamp`).
- **Rim Turf / Cliff Z-Fighting Fix & Mobile Thermal Optimization** ([`board_scene.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L988-L1072)):
  - Explicit vertical separation (`topFloor` at `y = -0.32`, `rimMesh` at `y = -0.310..-0.316` with `polygonOffset(-2,-2)` and `depthWrite: false`, `wallMesh` front cliff at `y = -1.54, z = 4.74` with `alphaTest: 0.35`, extruded tile bases at `y = -0.260..0.000`, tile tops at `y = 0.012`).
  - Shared side materials across all 24 tiles, frozen static matrices (`matrixAutoUpdate = false`), and adaptive FPS quality scaling (`_perfTick`/`setQualityTier`).
- **5 Rotating Grand Landscape Courtyard Themes** ([`board_scene.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L439-L768), [`L880-L944`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L880-L944)):
  - 5 presets (`classic` Royal Starlight Garden, `sakura` Kyoto Sakura Sanctuary, `mirage` Sultan's Mirage Oasis, `atlantis` Atlantis Pearl Lagoon, `aurora` Starlight Aurora Sanctuary).
  - Renders inner courtyard waterways/paths on a **1-quad painted ground medal** (`2 triangles, 1 draw call` at `y = -0.304`) surrounded by symmetrical 2.5D wonders, pavilions, bridges, and biome trees from [`shared/catalog_landmarks.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/catalog_landmarks.js).
  - Random non-repeating theme selected per match (`pickRandomLandscapeThemeIdx`), plus live tap-to-cycle via `.mono-theme` in the top HUD (`cycleLandscapeTheme`).
- **Painted Monuments, Traps, Event Emblems & 3-Beat Cast VFX** ([`board_scene.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L188-L413), [`L1672-L2036`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L1672-L2036)):
  - 18 building sprites (`L1–L3` × 6 themes), 7 tile trap/buff billboard sprites (`modifierProp`), 6 painted event emblems (`EVENT_EMBLEM_MAP`), and 15 Mythic/Super-Mythic spell monuments.
  - 3-Beat `ultVfx` (Cast pose + arcane rings → Center 2.5D Monument pop-up + beam → Target tile shockwaves), full-board `superVfx` (Eclipse corona / Aurora ribbons), and 3.2s `playCombo` fusion cutscene.

### C. HUD, Match Intro 100% Sync Screen & Multiplayer Room (`client/js/`, `shared/universal_room.js`, `server/table_service.js`)
- **Match Intro & 100% Ready Theme Reveal (`showMatchIntro`)** ([`hud.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/hud.js#L166-L262), [`board_scene.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L925-L963), [`monopoly.css`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/css/monopoly.css#L681-L835)):
  - At Round 1 start, holds camera in a high overview swoop (`startIntroSwoop`) while `.mono-intro` displays the Courtyard Theme banner, 4 seated players with their Ultimate badges, per-seat `SYNCING… → ✓ 100%` badges, and a smooth progress bar blending GPU texture load state (`getThemeLoadProgress`) with a 540ms ease curve before transitioning into Round 1.
- **Composite Hair + Outfit Portraits (`portraitBgCss`)** ([`hud.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/hud.js#L13-L34)):
  - Stacks `hair_*_front.png` over outfit + `base_front.png` via multi-layer CSS `background-image` so player avatars in HUD cards, Match Intro, and Podium are never bald.

## 2. Monopoly Known Edge Cases / Next Steps for Inspection
1. **Networked Theme Seed Sync**: `pickRandomLandscapeThemeIdx()` in [`board_scene.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js#L608) is currently local per client. To ensure all 4 human players in a live room see the exact same random theme initially, seed `themeIdx` from `m.seed % MONO_LANDSCAPE_THEMES.length` inside `syncFromMatch` while keeping `.mono-theme` manual cycling local.
2. **TableHub Pre-Match Portrait & Option Path**:
   - [`client/js/table_hub.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/table_hub.js#L9-L15) still uses single-image `portrait(s)` rather than `portraitBgCss(p)` from `hud.js`; applying multi-layer hair+outfit CSS to `.th-seat-ava` will match the in-game HUD.
   - Normalize `const mode = t.options?.matchMode || t.matchMode || 'normal'` in [`table_hub.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/table_hub.js#L57) to match `universal_room.js` serialization (`options: { matchMode }`).
3. **Optional Networked Loading Barrier**: `showMatchIntro` currently resolves locally (~1.0s) well inside the server's `12,000ms` turn timer. If strict server-side clock pause until all clients emit `mono_client_loaded` is desired for slow mobile networks, add a `loading` phase to [`shared/universal_room.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/universal_room.js).

---

# PART 2: Pet System (V2 "Soul-Bond Companions" + V2.5 Progression + Soul-Link)

## 1. Architecture & Completed Features

### A. 4 Canonical Companions, 8-Pose / 8-Emote Contract & Perceptual Scaling (`shared/pet_catalog.js`)
- **4 Bespoke Multi-Tier Companions** ([`shared/pet_catalog.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_catalog.js#L53-L203)):
  1. `pet_ragdoll` (**Princess Ragdoll**) — Family: `cats`, Locomotion: `HOP_WADDLE`, Skill: `royal_charm`, Starter for **Neen (`dxb`)**.
  2. `pet_nyx` (**Nyx, the Midnight Drake**) — Family: `dragons`, Locomotion: `FLY_FLUTTER`, Skill: `plasma_blast`, Starter for **Nook (`bkk`)**. Has **3 distinct sprite tiers** (`nyx_t1`, `nyx_t2`, and dedicated ★3 Radiant `nyx_t3` from `sheet_p2_nyx_radiant.png`, `hasT3Sprite: true`).
  3. `pet_kitsune` (**Sakura Kitsune**) — Family: `kitsune`, Locomotion: `FLOAT_SPIRIT`, Skill: `foxfire`.
  4. `pet_skywhale` (**Baby Sky Whale**) — Family: `skywhale`, Locomotion: `SKY_SWIM`, Skill: `bubble_shield`.
- **Deterministic 18→4 Legacy Migration** ([`shared/pet_catalog.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_catalog.js#L208-L254), [`shared/pet_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_rules.js#L612-L727)):
  - Maps all 18 V1 species (`cat_*`, `pup_*`, `bunny_*`, `dragon_*`, `wisp_*`, `capybara_*`) to the 4 canonical companions and refunds duplicate investment into Universal Starlight Essence (`rpg.pet_essence`).
- **Perceptual Body-Mass Scaling** ([`shared/pet_catalog.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_catalog.js#L32-L51), [`L290-L332`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_catalog.js#L290-L332)):
  - `PET_SPRITE_METRICS` stores `[width, height, perceptualBodyMassFraction]` across all 72 pose sprites so `resolvePetPoseSize` (3D world billboards) and `resolvePetUiScale` (2D DOM `--pet-ui-scale`) keep core body size consistent even when ★2/★3 forms add huge wings or tail halos.

### B. V2.5 Unified Companion Level (Lv. 1–30), Hunger Loop & 2-Slot Traits (`shared/pet_rules.js`, `server/rpg_service.js`)
- **Unified Companion Level (`bond_lv` 1–30, synced to `level`)** ([`shared/pet_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_rules.js#L29-L115), [`L365-L409`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_rules.js#L365-L409)):
  - Linear XP curve `bondXpToNext(lv) = 50 * lv`.
  - **Milestones (`PET_MILESTONES`)**:
    - **Lv. 1**: ★1 Starter & Trait Slot 1
    - **Lv. 5**: 💤 Nap Pose (`sleep`)
    - **Lv. 10**: ★2 Awakened Form, Trait Slot 2 & 😊 Happy Pose (`happy`)
    - **Lv. 15**: 🪄 Cast Pose (`cast`) & 👗 Pet Costume Soul-Link Slot
    - **Lv. 20**: ★3 Radiant Form & Shimmer
    - **Lv. 25**: 🎪 360° Spin-Flip Trick (`flip`)
    - **Lv. 30**: 🌈 Sovereign Ground Ring Aura + Crown `👑` Nameplate prefix
- **Save Reconciliation (`migrateRpg`)** ([`server/rpg_service.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/rpg_service.js#L110-L170)):
  - Enforces `pet.bond_lv >= minLevelForStars(pet.stars)` (`★2 → Lv.10`, `★3 → Lv.20`), syncs `pet.level = pet.bond_lv`, auto-appends unlocked selectable poses (`happy`, `cast`) to `active_poses`, clamps `slots` to `MAX_TRAIT_SLOTS (2)`, and unlocks excess locked slots (`lockedCount <= maxLocks`).
- **Hunger & Online EXP Loop** ([`shared/pet_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_rules.js#L42-L64), [`server/rpg_service.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/rpg_service.js#L972-L1090)):
  - Fullness `0–100` (`+35` per feed for `15 🍓` or `120 🪙`). Zones: `≥70%` Stuffed (`2.0× EXP`), `30–69%` Normal (`1.0× EXP`), `<30%` Hungry (`0.25× EXP`).
  - Client `_startOnlinePetTick()` ([`client/js/gacha_forge_ui.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/gacha_forge_ui.js#L477-L494)) pings `pet_online_tick` every `60s` while active (`+12 * mult` Bond XP, `-2` Hunger). Minigames & Monopoly finish call `grantPetActivityExp`.
- **2 Rollable Trait Slots & Trait-to-Soul-Link Scaling** ([`shared/pet_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_rules.js#L40), [`L512-L574`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_rules.js#L512-L574)):
  - 2 rollable slots (Slot 1 at ★1/Lv.1, Slot 2 at ★2/Lv.10; max 1 locked slot during reroll; Mythic overwrite guard; `1.5×` Couple Harmony bonus when partner equips same species).
  - `slotSoulLinkBonus` & `computePetSoulLinkBonuses` convert traits directly into Monopoly Soul-Link Ultimate bonuses: **⚡ Charge (`rateBonus`)**, **💥 Echo (`potencyBonus`)**, and **🔋 Start (`startBonus`)**.
- **Lv.1 Innate Soul-Link Ultimate + Lv.15 Costume Soul-Echo** ([`shared/monopoly_engine.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_engine.js#L169-L415), [`server/rpg_service.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/rpg_service.js#L1096-L1120)):
  - Lv. 1–14 (or unlinked): Casts innate `"Starlight Blessing"` (`+150G + 15% cash & Shield`).
  - Lv. 15+ with linked costume (`pet_equip_costume`): Casts a Soul-Echo of the linked outfit's Mythic/Season skill in Monopoly and emits that costume's `walkFx` trail in the 3D world ([`client/js/pet_controller.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/pet_controller.js#L581-L589)).
- **Direct Pet Adoption & Mockup 16 Sanctuary UI** ([`client/js/pet_sanctuary_ui.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/pet_sanctuary_ui.js#L1-L844)):
  - Removed `'pets'` pill from Box 1 Gacha UI; unowned pets are adopted directly in the Sanctuary for `2,500 🪙` (`0 🪙` if owning 0 pets) via `pet_adopt`.
  - Zero-scroll 3-block vertical layout: (1) Full-bleed Sakura Sky-Island Nest Stage with Partner Pet, Couple Egg, quick-action pills, and expandable Poses/Emotes/Costume Link drawer; (2) Ornate Parchment Trait & Care Card; (3) 4-Pet Circular Carousel + context-sensitive primary CTA.

## 2. Pet System Known Edge Cases / Next Steps for Inspection
1. **Add `'pet_set_poses'` to `RPG_ACTIONS` in `server/server.js` (Important Bug Fix)**:
   - [`server/server.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/server.js#L481-L485) implements `case 'pet_set_poses':` inside `onAction` and exempts it from the cooldown at `L358`, **but `'pet_set_poses'` is missing from the `RPG_ACTIONS` Set at [`server/server.js#L29-L34`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/server.js#L29-L34)**. Because `L696` checks `if (m.type.startsWith('village_') || RPG_ACTIONS.has(m.type))`, adding `'pet_set_poses'` to `RPG_ACTIONS` is required so multi-select idle pose toggles persist over WebSocket.
2. **Deduplicate `#pet-costume-select` Listener in `client/js/gacha_forge_ui.js`**:
   - [`client/js/gacha_forge_ui.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/gacha_forge_ui.js) binds `#pet-costume-select` `change` twice (`L861-870` sends `pet_equip_costume` immediately, while `L1338-1340` sets `this.previewPetCostumeId` for the Link button). Consolidate into one handler.
3. **Minor `PetController` Micro-Optimizations (`client/js/pet_controller.js`)**:
   - Cache a module-scope `_tmpEuler` instead of allocating `new THREE.Euler().setFromQuaternion(...)` each frame at [`client/js/pet_controller.js#L712`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/pet_controller.js#L712).
   - Update `this.family === 'spirits'` check at [`L623`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/pet_controller.js#L623) to `this.family === 'kitsune'` (currently still works because `locoKey === 'FLOAT_SPIRIT'` is on the same `||` condition).

---

# PART 3: Verification Commands

```bash
# Run unit & integration tests for Monopoly, Room, Table Service, and Pets
node --test tests/monopoly.test.js tests/table_service.test.js tests/universal_room.test.js tests/pet.test.js

# Run 3,600-match Monte Carlo Monopoly balance simulation (all 15 Mythics/Super-Mythics)
node tests/monopoly_sim.mjs

# Run the full test suite
npm test
```

---

## Changelog 2026-10-17

- **`pet_set_poses` added to `RPG_ACTIONS`**: Added `'pet_set_poses'` to the `RPG_ACTIONS` Set in `server/server.js` (after `'pet_adopt'`) so companion multi-select idle pose toggles persist over WebSocket.
- **`table_hub` `matchMode` read from `t.options`**: Added `modeOf(t)` helper (`t?.options?.matchMode || t?.matchMode || null`) near the top of `client/js/table_hub.js` and replaced direct `matchMode` reads across state handlers, chaos toggles, and live table listings.
- **Pet costume select listener dedup**: Deduplicated `#pet-costume-select` change listener in `client/js/gacha_forge_ui.js` by removing the immediate `pet_equip_costume` send; changing the dropdown now updates the preview only, and costume equip is executed explicitly via the "👗 Link Costume" (`#pet-costume-save`) button.
- **Takeover dialog now shows rent paid + 'Keep walking' button**: Takeover UI clearly surfaces the auto-paid rent amount and provides an explicit 'Keep walking' option.
- **Rent preview uses real `rentFor`**: Property and tile rent preview calculations now use the unified `rentFor` rules evaluation.
- **Board theme seeded from match seed**: Board courtyard theme is deterministically seeded from match seed (`m.seed % MONO_LANDSCAPE_THEMES.length`) so all players share the identical initial theme.
