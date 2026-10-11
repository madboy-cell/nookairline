---
name: nook-season-pipeline
description: >-
  Standard end-to-end technical pipeline for implementing new costume gacha seasons (Season X),
  sprite cutouts, pocket-clearing, 300px thumbnail rebuilding, card holographic foil stacking contexts,
  monopoly perk balancing, and cache-busting in Sky Party (Nook Airline).
---

# Sky Party — Master Season & Costume Pipeline Guide

Use this skill whenever implementing a new costume gacha season (`Season X`), adding/modifying costumes, cutting out character sprites, fixing white cardboard boxes, tuning monopoly perks, or configuring trading card foil presentations.

---

## 1. Core Rule: Maximum Reuse, Zero Re-Engineering

The entire gacha, currency, economy, wardrobe, and perk system is **already fully built and automated**. You do **NOT** need to create new gacha mechanics, pity counters, roll animations, shop pages, or monopoly hooks.

### What is ALREADY BUILT and 100% REUSED:
| System | What It Handles Automatically |
|---|---|
| **🎰 Gacha Engine** | `Pull ×1` (100💎), `Pull ×10` (900💎), currency verification, and database sync. |
| **🌟 Pity Mechanics** | 10-pull guaranteed Epic+, 45-pull soft pity, and 60-pull hard Mythic pity. |
| **✨ Stardust Exchange** | Duplicates automatically melt into Stardust (10/40/150). Shop dynamically lists missing pieces. |
| **⏳ Limited-Time Banners** | Server validates `Date.now() <= endsAt`. Expired banners cleanly auto-archive from the Gacha tab while staying in the Codex. |
| **💞 Couple Resonance** | Automatically triggers when both partners equip matching `pair` outfits (`+25 miles each per lap`). |
| **🎲 Monopoly Perks** | Game automatically reads `perks[role]` on character equip (`startMiles`, `startItem`, `lapBonus`, `duelTieWin`, `marketDiscount`, etc.). |
| **📖 Codex Album** | Permanent collection book with completion bars and silhouette inspect sheets. |

---

## 2. The 7-Step Season Implementation Checklist

When creating or modifying a Season `sX` or its costumes:

```
┌────────────────────────────────────────────────────────┐
│               SEASON X IMPLEMENTATION                  │
├──────────────────────────┬─────────────────────────────┤
│ 1. public/costumes.js    │ Add SEASONS[sX], PERKS,     │
│                          │ COSTUMES catalog pairs      │
│ 2. server.js / data      │ Set banner start/end time   │
│ 3. Sprite Assets & Cutout│ Pocket-clearing pipeline    │
│                          │ + make_thumbs.js            │
│ 4. Cabin Scenery         │ 3 empty scenes (no humans)  │
│                          │ + avatar.js + avatar.css    │
│ 5. public/vault.js       │ Add Codex filter tab button │
│ 6. Cache Busting         │ Bump SPRITE_VER (?v=...)    │
│ 7. Verification          │ test_monopoly_comprehensive │
└──────────────────────────┴─────────────────────────────┘
```

---

## 3. The 4 Display Stages & Zero-White-Box Mandate

Every costume sprite is rendered across 4 distinct stages. **Any trapped white cardboard blocks or opaque margins instantly destroy the game's high-polish aesthetic**:

1. **Wardrobe Pedestal (`#wardrobeAvatarStage`)**: Floating pedestal over dynamic gradient backdrops. Requires 100% transparent PNG cutout so the pedestal glow wraps naturally around the character's feet.
2. **Sky Lounge Cabin (`#cabinAvatarStage`)**: Couple avatars sit side-by-side inside empty destination sceneries (`.sky-lounge.theme-*`). No white cardboard between arms, legs, or hair.
3. **Monopoly Board Tokens (`.player-token`)**: Chibi tokens hop across board tiles and particle shockwaves. No opaque boxes obscuring board numbers or property hotel badges.
4. **Vault Codex Cards & Inspect Modal (`.v-card-art`, `.vi-art`)**: Card images must have explicit CSS transparency (`background: transparent !important;`), layered above the radial background and below the animated holographic foil.

---

## 4. The Perfect Pocket-Clearing Cutout Directive

> [!CRITICAL]
> **WHY SIMPLE 4-BORDER FLOOD FILLS FAIL**
> A standard 4-border flood fill (`x=0, w-1`, `y=0, h-1`) only reaches the outer perimeter of the sprite. It **cannot enter enclosed negative spaces created by character poses**:
> - Between separated legs / sandals / heels (e.g. Zeus, Athena, Gladiator).
> - Inside weapon curves, zigzag lightning bolts, or musical staffs (e.g. Zeus lightning, Phantom Wolf baton).
> - Inside tarot card arcs, floating spell tomes, or celestial orbs (e.g. Clockwork Maestro cards).
> - Between cape folds, trailing gown pleats, and dragon tails (e.g. Black Swan dress, Athena dragon tail).
> - Inside monument colonnades or ribbon loops (e.g. Venetian Mask ribbons, Olympus temple pillars).

### The Complete 6-Step Cutout & Delivery Pipeline:
1. **Outer 4-Border Flood Fill**: Flood fill from 4 outer edges with threshold `232` (or `228` for cool-tinted canvas).
2. **Internal Pocket Flood Fill**: Targeted queue flood fill (`clear_pockets(...)`) starting from seed coordinates inside enclosed loops.
3. **1px Anti-Aliased Edge Softening**: Soften 1px boundary pixels adjacent to transparent space (`px[nx, ny][3] == 0`) with `r, g, b > 195` by `0.35` (`int(a * 0.35)`). Eliminates harsh white pixelated contours.
4. **Auto-Crop & Clamp**: Tight crop to `img.getbbox()`, scaling to `max-height: 900px` using Lanczos resampling.
5. **Rebuild 300px Thumbnails**: Execute `node scripts/make_thumbs.js` to create synchronized 300px thumbnails in `public/assets/thumbs/sX/`.
6. **Bust Browser Cache**: Bump `SPRITE_VER` in `public/costumes.js` (e.g. `'20261012v2'`) and query parameters in `public/index.html`.

### Using the Automated CLI Tool:
```bash
# Process single sprite with internal seeds:
python3 scripts/perfect_cutout.py --file public/assets/s10/s10_phantom_m.png --seeds 504,313 146,339

# Run preset for season:
python3 scripts/perfect_cutout.py --season s10
python3 scripts/perfect_cutout.py --season s11
python3 scripts/perfect_cutout.py --all-recent

# Rebuild all 300px card thumbnails:
node scripts/make_thumbs.js
```

---

## 5. Card Stacking Context & Holographic Foil Standard

In `public/vault.css`, cards maintain an isolated stacking context (`isolation: isolate;`). You **must strictly follow this z-index hierarchy**:

```css
.v-card {
  isolation: isolate;
  contain: layout paint style;
}
.v-card-bg   { position: absolute; inset: 0; z-index: 0; }  /* NEVER negative z-index! */
.v-card-art  { position: absolute; inset: 6px 6px 26px; z-index: 1; }
.v-card-art img { background: transparent !important; }
.v-card-foil { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.v-card-name, .v-card-stars, .v-card-count { z-index: 3; }
.v-card-check, .v-card-new { z-index: 4; }
```

### Holographic Foil Animation Classes:
* **⭐ RARE (`.rf-rare .v-card-foil`)**: Subtle crystalline blue gradient sweep (`animation: vSweep 4.5s ease-in-out infinite; mix-blend-mode: screen;`).
* **⭐⭐ EPIC (`.rf-epic .v-card-foil`)**: Radiant magenta-violet sweeping prism (`animation: vSweep 3.2s ease-in-out infinite; mix-blend-mode: screen;`).
* **⭐⭐⭐ MYTHIC (`.rf-mythic .v-card-foil`)**: Multi-layered golden stardust prism with hue rotation (`animation: vSweep 2.6s ease-in-out infinite, vHolo 6s linear infinite; mix-blend-mode: overlay;`).

---

## 6. Monopoly Perk Balancing Table

Perks must be balanced, role-differentiated, and non-gamebreaking:

| Tier | Typical Perks | Values | Role Distribution |
|---|---|---|---|
| **⭐ RARE** | Small passive boost | `startMiles: 200–300`, `marketDiscount: 0.15`, `bankInterest: 0.05` | Simple, reliable comfort perks |
| **⭐⭐ EPIC** | Active utility / tactical | `startItem: 'shield'`, `lapBonus: 100–150`, `duelTieWin: true` | Strategic board mobility |
| **⭐⭐⭐ MYTHIC** | Game-altering signature | Unique tactical trigger (e.g. rent reversal, lightning smite, freeze) | Theatrical centerpiece identity |

---

## 7. The Cache-Busting Protocol

> [!WARNING]
> `server.js` sets aggressive caching headers for static assets:
> ```javascript
> res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
> ```
> If you update or replace an asset on disk without updating the cache query parameter, browsers and mobile WebViews will continue rendering the old cached white-boxed image!

### Mandatory Cache-Busting Checklist:
1. Update `SPRITE_VER` in `public/costumes.js`:
   ```javascript
   const SPRITE_VER = '20261012v2'; // Increment on every asset touch
   ```
2. Verify `thumbOf(src)` in `public/vault.js` appends `?v=${SPRITE_VER}`.
3. Verify `avatar.js` character sprite resolution appends `?v=${SPRITE_VER}`.
4. Update script and stylesheet query parameters in `public/index.html` (e.g. `costumes.js?v=20261012v2`, `vault.js?v=20261012v2`).

---

## 8. Verification Suite

Always run the comprehensive simulation test before concluding work:
```bash
node scripts/test_monopoly_comprehensive.js
```
Guarantees 100% pass rate across 2-player matches, 4-player party matches, bot logic, and extreme interaction matrices.
