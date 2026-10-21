# ☁️ Sky Cloud Dash V2: Handover (as of 2026-10-19)

Project root: `/Users/thanapat/Documents/neora-world-v3/neora-world-v2` (ES modules, Node server + Three.js client).
Mode id: `cloud_dash` (`MODES.cloud_dash` in `shared/universal_room.js`). It is a 4-racer 3D curved-track party race with a *Tales Runner × Mario Kart × Cookie Run* feel.

---

## 1. Read these first
| File | Why |
|---|---|
| `CLOUD_DASH_V2.md` | Full v2.1 design spec. Remaining work is described in §5.4, §5.5 and §9. |
| `GEAR_ATTUNEMENT_GLAMOUR.md` | Spec for 🎯 Attunement and 👗 Glamour (shared gear systems). |
| `shared/cloud_dash_rules.js` | Authoritative sim (`DASH_TUNING`, `stepRunner`, `PET_RIDES`, `ULT_ARCHETYPES`, `COSTUME_DASH_ULTS`, items). |
| `shared/cloud_dash_track.js` | `buildTrack(seed)` returns items, pits, `deck`, `bends`. |
| `shared/cloud_dash_patterns.js` | 30 validated obstacle/pickup patterns plus `validatePattern`. |
| `shared/universal_stats.js` | `computeUniversalStats(profile)` is the single stat formula for client and server, with `attune` support. |
| `shared/dash_builds.js` | `detectBuild`, `BUILD_THRESHOLDS`, `DASH_CAPS`, `dashModsFromStats`. Covers 4 builds × Tiers I–IV (IV = ✦ Sovereign), 6 Hybrids and Balanced. |
| `server/cloud_dash_service.js` | Server adapter (`createCloudDashAdapter`): bots, item and ULT routing, rewards. |
| `client/js/minigames/cloud_dash_ui.js` | Client scene, HUD, VFX and juice (~1900 lines). **Use small, targeted edits only. Never rewrite this file.** |
| `client/js/minigames/cloud_dash_coach.js` | 🐾 Pet Coach: aesthetic in-race onboarding tips, with mastery retirement and a results-screen toggle. |
| `client/js/minigames/cloud_dash_ult_skins.js` | `ULT_SKINS` for 18 costumes, `DEFAULT_SKIN` and `ultSkinFor()`. |

## 2. What is DONE ✅
- **6B-1 Core run:** lanes, jump/glide, perfect dash-jumps, Rhythm Chain, dual scoreboard (Placement + ✨Style), Pet Rescue instead of respawn, speed pads, pits and clouds.
- **6B-2 Party layer:**
  - slipstream
  - Mystery Prism item boxes: mega_mount, shrink, grapple, mochi, shield, jelly_rain
  - 5 ULT archetypes with Synergy Burst
  - shared stat formula, which also fixed 3 old client stat bugs
  - Dash Builds with a Build Card on the results screen
- **6B-3 Showcase and polish:**
  - ☁️ Upper Cloud Deck: golden ring at s=327, lane 0, leads to a deck from s=330 to 400 at y=4.
  - 👟 Hop-Over Vault, 🏎️ Corner Apex Carve and 💞 Couple Heart Slingshot. Heart requires a `partner_id` or `friends` in the race.
  - 4 per-family Pet Rides, each with unique animation and VFX:
    - 🐱 Ragdoll *pounce*
    - 🐉 Nyx *flight* with plasma breath
    - 🦊 Kitsune *blink*
    - 🐋 Sky Whale *surf*
  - Pet balance: average finish times of the 4 pets are within 0.58% of each other over 40 seeds.
  - 18 bespoke costume ULT skins: sprite aura, trail, banner, vignette and sfx. Super Mythics (`sm_*`) use the `.sovereign` banner.
  - Slipstream flash fix: the overlay is now an edge vignette plus side swooshes, and only ramps in after `df > 0.25`.
  - Shield bubble scales up during a ride, sky dome clamped to a horizon band, and Town Hall Statue #3 now reads "🏆 #1 Sky Sprinter".
  - CPU fix: the `.cd-draft` CSS animation is paused unless `.cd-draft.on` is set.
- **Assets:** 57 PNGs in `client/assets/cloud_dash/`. Converter scripts are in `~/.gemini/antigravity/brain/981da782-26a6-44d8-aa87-d7a6a0aab0f3/scratch/convert_cd_art*.py`.
- **Tests:** `npm test` gives **243 passing and 0 failures**. Cloud Dash & Gear test files:
  - `tests/cloud_dash_*.test.js`
  - `tests/universal_stats.test.js`
  - `tests/cloud_dash_showcase.test.js`
  - `tests/cloud_dash_pet_rides.test.js`
  - `tests/cloud_dash_meta_retention.test.js`
  - `tests/gear_attune_glamour.test.js`
- **Browser QA scripts** (Puppeteer, port 4317, login `nook` / `1234`): `scripts/qa_cloud_dash*.mjs`. The variants are `_items`, `_showcase`, `_pets` and `_ults`.

## 3. Completed Buckets A, B & C ✅

### Bucket A: Build UX & Meta (`CLOUD_DASH_V2.md` §5.5) — ✅ COMPLETE
1. **Live Build Preview toast** (`diffBuilds` in `shared/dash_builds.js`, `checkBuildDiscovery` in `server/rpg_service.js`, and `.rpg-build-toast-banner` / inspector preview in `client/js/gacha_forge_ui.js`) when equipping gear, forging, attuning, switching presets, or evolving/rerolling a pet.
2. **Tier-Up Celebration** and **Secret Hybrid Discovery** (`+50 💎` granted server-side on first discovery and tracked in `profile.dash_builds_found` & `profile.dash_build_tiers`).
3. **📖 Build Collection Book** (`ALL_BUILDS` — 11 builds with unlocked perks & `+50 💎` hints on locked hybrids) and **🎒 3 Loadout Presets** (`⚡ Speed`, `🪙 Farm`, `🍀 Chaos` via `dash_preset_save` / `dash_preset_equip`) in the Play Hub (`client/js/table_hub.js`).
4. **🌦️ Weekly Sky Weather** modifier (`SKY_WEATHERS` & `getWeeklyWeather()` in `shared/dash_builds.js`): Storm Week, Jelly Festival, Tailwind, and Prism Party deterministically rotate by ISO week and apply to `buildTrack(seed, { weather })` and `dashModsFromStats(bonus, { weather })`.

### Bucket B: Retention, Ranked & Ghost (`CLOUD_DASH_V2.md` §5.4, §9) — ✅ COMPLETE
1. **Daily First-3 Sky Chest pips** (`0..3/day`, 3rd pip = Grand Sky Chest), **Post-Race Chest Progress Bar** (`0..100 pts`), **Win Streak Flame** (`🔥 ×N`), and **3 Rotating Dash Missions** (`DASH_MISSION_POOL` & `ensureDashDaily`) tracked authoritatively in `server/cloud_dash_service.js` and rendered in Play Hub & Results (`client/js/table_hub.js`, `client/js/minigames/cloud_dash_ui.js`).
2. **🏆 Cloud League** ranked mode (`dashMode: 'league'`): 50% raw stats + 100% build perks, 5 tiers (`Bronze` → `Sovereign`), LP delta (`+35 / +18 / +5 / -10` with floor protection), and `+25 💎` promotion bonus.
3. **👻 Ghost Trial** solo mode (`dashMode: 'ghost'`): `noPrisms: true` pure skill track, records compact `[t, s, lane, y]` trace onto `profile.dash_ghost` on new PB, and renders a translucent **👻 PB Ghost** runner (`this.ghostRig`) in-race.

### Bucket C: Shared Gear Systems (`GEAR_ATTUNEMENT_GLAMOUR.md`) — ✅ COMPLETE
1. **🎯 Attunement:** `inspectItemAttune` & `attuneCostFor` in `shared/universal_stats.js`, `gearAttune` in `server/rpg_service.js` (`gear_attune` WS action), and the Blacksmith `🎯 Stat Attune (+5 Gear)` sub-tab in `client/js/gacha_forge_ui.js` (locks Main Stat, lets player pick Secondary Stat with live Dash Build preview, 1st attune FREE).
2. **👗 Glamour:** `profile.glamour` per-slot visual override synced in `server/rpg_service.js` (`wardrobe_glamour` WS action), resolved automatically in `visibleSlotId` (`shared/accessory_attach.js`) for both 3D `ChibiRig` and 2D Paper-Doll while keeping stats & ULTs on `equipped[slot].id`, plus the `⚔️ Equip (Stats)` / `👗 Glamour (Look Only • 0🪙)` toggle in `client/js/gacha_forge_ui.js` and `👗` slot badges in `client/js/ui_components.js`.

## 4. Working conventions (user preferences: follow these)
- **Delegate low-risk work to cheap (`flash`) subagents** to save tokens, then review their output yourself. Low-risk work includes:
  - research
  - art generation (`image-generator`)
  - art keying and conversion
  - client-only VFX
  - QA scripts
  - unit tests

  Keep shared/server gameplay logic for yourself.
- **Art style:** pastel kawaii, glossy cel-shading, thick soft outlines. Generate on a flat `#FF00FF` background, then key it with the existing converter scripts. Never put text in sprites.
- **Design goals:**
  - Maximum dopamine and frictionless flow.
  - Teach players with aesthetic in-race Pet Coach tips, not text walls.
  - "Soft pay-to-win" builds that reward experimentation.
- **Cache busters:** `client/js/main.js` imports `./minigames/cloud_dash_ui.js?v=cd16`, which imports `cloud_dash_coach.js?v=cd9` and `cloud_dash_ult_skins.js?v=cd14`. Bump the version whenever you edit a module.
- **Dirty worktree:** about 100 modified files existed before this work. **Never revert unrelated files.**
- Use clickable `file://` links when reporting to the user.

## 5. Environment gotchas
- Start the dev server with `npm start` from the project root (http://localhost:4000). It may already be running as a background task.
- **Puppeteer QA leaks headless Chrome.** SwiftShader-rendered instances once used about 10 cores and drove the user's CPU to 80%. After any QA run, check and clean up with:
  ```sh
  ps aux | grep puppeteer_dev_chrome_profile | grep -v grep
  pkill -9 -f puppeteer_dev_chrome_profile
  ```
  This only targets the QA profiles, not the user's own Chrome.
- Verification loop:
  1. Run `node --check <file>` on every edited file.
  2. Run `npm test 2>&1 | grep -E '^# (tests|pass|fail)|^not ok'`.
  3. Run the relevant `scripts/qa_cloud_dash_*.mjs` and **look at the screenshots**.
- The client render loop goes through `world.activeScene` (`world_engine.js` `start()`), and the village pauses while Cloud Dash is open.
