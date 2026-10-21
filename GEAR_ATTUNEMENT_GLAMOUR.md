# 🎯👗 Gear Attunement & Glamour — Shared Design Spec
**Status:** Design Spec v1 (applies to all modes: 🎲 Sky Monopoly, 🌙 Moon Defense, ☁️ Sky Cloud Dash)
**Related:** [`CLOUD_DASH_V2.md` §5.5 Dash Builds](./CLOUD_DASH_V2.md)

---

## 0. Why
- Gear stats are **fixed per item** (`shared/catalog_gear_pets.js`, `shared/costumes_catalog.js`). That's good (clear, tradeable, duplicates fuel forging), but it **locks each build to a few "correct" items** and some slots can't help some builds (no face item has Swiftness; no Mythic hat or gloves do).
- Players should be able to **dress for cute** without losing power.

**Design rule:** gear = *choice & steady progress* · pets = *luck & excitement* · looks = *total freedom*.
We do **not** randomize gear stats.

---

## 1. 🎯 Attunement — "choose which stat your item gives"

### 1.1 What it does
Every accessory has a **main stat** (its biggest line) and a **secondary stat**. Attunement lets you **change the secondary stat to any of the other 3 stats** (same value).

```
Roulette Heels +5
Before:  ⚡ Swiftness 38  +  🪙 Fortune 32
Attune → 🍀 Luck
After:   ⚡ Swiftness 38  +  🍀 Luck 32
```

### 1.2 Rules
| Rule | Value |
|---|---|
| Unlock | Item forged to **+5** |
| Which line | **Secondary only** (main stat stays the item's identity) |
| Choice | Player **picks** the stat (no randomness) |
| Can it become the same as the main stat? | **No** (prevents single-stat items; keeps the 45% build gate meaningful) |
| Slots | `hat`, `face`, `gloves`, `boots`, `wings` |
| Not attunable | `{ all: N }` items (Season/Super Mythic outfits, most wings), already balanced across all stats |
| `charm` lines | Normalized first by `normalizeItemStats`, then attunable like any stat |
| Forge level | Kept; attuned value scales with refine as normal |

**Exception, Swiftness gap fill:** an item whose lines have **no Swiftness** can attune its secondary *to* Swiftness. This fixes the face / Mythic hat / Mythic gloves gap without new items.

### 1.3 Cost (soft currency, gold sink)
| Attunement # on this item | Cost |
|---|---|
| 1st | **Free** (lets everyone try it) |
| 2nd | 2,000 🪙 + 50 🍓 |
| 3rd | 4,000 🪙 + 100 🍓 |
| 4th+ | 6,000 🪙 + 150 🍓 (cap) |

No diamonds. Optional **🎐 Attune Scroll** (event / pass reward) = one free re-attune.

### 1.4 UX
- Blacksmith gets an **`🎯 Attune`** tab next to Forge.
- Pick a stat → **live preview** shows the build effect before paying:
  `⚡ Speedster II → 30 more to Tier III` → `⚡ +80 → Tier III unlocked! 🎉`
  `⚠️ Build changes to 🔥⚡ Juggernaut (Hybrid)`
- The Build Card's **"next step" hint** can suggest attunements ("Attune Aurora Glasses → Swiftness").
- Attuned items show a small stat-colored ring on the item icon.

### 1.5 Data
```js
// equipped / inventory item instance
{ id: 'boots_mythic_roulette_heels', refine: 7, attune: { stat: 'luck', count: 2 } }
```
Applied inside the shared `computeUniversalStats()` (see Cloud Dash §5.5 prerequisite): after `normalizeItemStats`, move the secondary line's value to `attune.stat`.
Server validates in `server/rpg_service.js` (new `gearAttune` handler next to `blacksmithForge`).

---

## 2. 👗 Glamour — "look like one item, get stats from another"

### 2.1 What it does
Each of the 6 paperdoll slots (`outfit, hat, face, gloves, boots, wings`) gets an optional **look override**. Stats come from the equipped item; the Chibi **shows** the glamour item.

```
Hat slot
  Equipped (stats):  👑 Jackpot Crown +10   → +95 Fortune
  Glamour (look):    🐰 Bunny Ears          → what everyone sees
```

### 2.2 Rules
| Rule | Value |
|---|---|
| What can be a glamour | Any item **you own** for that slot (any rarity, any forge level) |
| Cost | **Free**, unlimited swaps |
| Slot matching | Same slot only (a hat looks like a hat) |
| Hide option | Existing `👁️ Show/Hide` still works per slot (hide = show nothing) |
| Outfit glamour | Costume look changes, but **the Ultimate comes from the equipped (stat) costume** |
| Ult VFX | Uses the equipped costume's ult; the glamour costume's colors may tint VFX (cosmetic only) |
| Everywhere | Lobby, Town Hall, all 3 modes, podium, profile, Hall of Fame |

### 2.3 Why it's good for the game
- **Players:** strong build *and* cute outfit; no more "ugly but optimal".
- **Monetization:** cosmetic-only / limited-edition items become worth buying, and whales still chase stat items for ✦ Sovereign tiers.
- **Retention:** a **📸 Glamour Wardrobe** with saved looks (3 free slots, more as rewards) and a "Fashion of the Week" vote in Town Hall.

### 2.4 UX
- Each slot in the paperdoll screen shows two small icons: **⚔️ Stats** and **👗 Look**.
- Long-press any owned item → `👗 Use as Look`.
- Loadout Presets (Cloud Dash §5.5) save **stats + looks together**: `⚡ Race` can look totally different from `🪙 Farm`.

### 2.5 Data
```js
profile.glamour = { hat: 'hat_bunny_ears', outfit: null, face: null, gloves: null, boots: null, wings: null }
```
Rendering (`client/js/chibi_rig.js` / `shared/accessory_attach.js`) resolves `glamour[slot] ?? equipped[slot]` for meshes; all stat math ignores `glamour`.
Server validates ownership on set.

---

## 3. Interaction with Dash Builds
- Attunement is the main **"tune toward a tier"** lever besides forging and pet rerolls, giving every player a free first step.
- Max focused stat totals (and therefore tier thresholds in Cloud Dash §5.5) **will rise slightly** once secondary lines can be redirected. Recompute `DASH_BUILDS.thresholds` after Attunement ships.
- Glamour has **zero** stat effect.

## 4. Delivery
| Step | Scope |
|---|---|
| 1 | Shared `computeUniversalStats()` (prerequisite) |
| 2 | **Glamour** (pure cosmetic, low risk): data, render resolve, paperdoll UI |
| 3 | **Attunement**: data, server handler, Blacksmith tab, live build preview, threshold recompute |
