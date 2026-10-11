# Nook Airline — Costume Season Design Guide

This guide documents the standardized process for creating new costume gacha seasons (**Season X**) in Nook Airline. It serves as both human developer documentation and agent guidelines.

---

## 1. Core Rule: Maximum Reuse, Zero Re-Engineering

The entire gacha, currency, economy, wardrobe, and perk system is **already fully built and automated**. You do **NOT** need to create new gacha mechanics, pity counters, roll animations, shop pages, or monopoly hooks.

### What is ALREADY BUILT and 100% REUSED:
* **🎰 Gacha Engine:** `Pull ×1` (100💎), `Pull ×10` (900💎), currency verification, and database sync.
* **🌟 Pity Mechanics:** 10-pull guaranteed Epic+, 45-pull soft pity, and 60-pull hard Mythic pity.
* **✨ Stardust Exchange:** Duplicates automatically melt into Stardust (10/40/150). Shop dynamically lists missing pieces.
* **⏳ Limited-Time Banners:** Server validates `Date.now() <= endsAt`. Expired banners cleanly auto-archive from the Gacha tab while staying in the Codex.
* **💞 Couple Resonance:** Automatically triggers when both partners equip matching `pair` outfits (`+25 miles each per lap`).
* **🎲 Monopoly Perks:** Game automatically reads `perks[role]` on character equip (`startMiles`, `startItem`, `lapBonus`, `duelTieWin`, `marketDiscount`, etc.).
* **📖 Codex Album:** Permanent collection book with completion bars and silhouette inspect sheets.

---

## 2. What Changes for Season X

When creating a new Season `sX`:
1. `public/costumes.js`: Add `SEASONS[sX]`, add `PERKS`, add `COSTUMES` catalog pairs.
2. `server.js` & `data/banner_schedules.json`: Set banner `startsAt` and `endsAt` duration.
3. Assets Generation: Generate banner art (`assets/ui/banner_sX.jpg`) and sprite pairs (`assets/sX/...`).
4. `public/vault.js`: Add Codex filter button for `sX`.
5. Verify on 402×874 mobile viewport.
