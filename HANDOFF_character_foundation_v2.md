# HANDOFF: Character Foundation v2 (Step 3.5), Neora World v2

**Project root:** `/Users/thanapat/Documents/neora-world-v3/neora-world-v2` (no git, so **back up any file before editing it**)

**Previous conversations:**
- `d76b8233-ec1c-442f-83a7-707f338bc9f1`: Step 3, design, prototype start
- `996e5f7f-9cd1-4720-af2e-d898ccd752a9`: this one

**Design (must read):** [character_foundation_v2.md](file:///Users/thanapat/.gemini/antigravity/brain/d76b8233-ec1c-442f-83a7-707f338bc9f1/character_foundation_v2.md). The spec is `NEORA_WORLD_V2_IMPLEMENTATION_PLAN.md`, Section 23.

## 0. User expectations (important)
- **Shipping to real users, so attention to detail is everything.** The user rejected a prototype because the bunny ears didn't turn in the side view (the front art was reused). Before showing anything, **zoom into every item in all 3 views (front/side/back) on BOTH bodies** and ask: does this look like the same object turned?
- **Save tokens:** delegate low-risk work (numeric calibration, slicing, docs, renders) to cheaper subagents (`self` with `Model: flash`, or `image-generator` for art). Keep risky rig/engine code and final visual review for yourself.
- Subagents **cannot copy files**: image-generator saves into a brain dir, so you `cp` the result into `art_src/`.
- Reply concisely. The user is non-technical-ish and prefers plain explanations and short option lists.

## 1. Locked design (summary)
- Two bald base bodies, `boy` and `girl`. Costume = body sprite. Hair is a separate tinted grey wig: ONE sprite per view, drawn twice in front/side (a full copy behind the body + a copy in front clipped at the neck), once in the back view.
- Slots stay 6. Ears and horns go in the **hat** slot; tails go in the **wings/back** slot (hip socket). Hair is NOT a slot; it lives in `profile.appearance = { body, hair, hairColor }`.
- Hair tiers:
  - **Classic:** pick for 3,000 🪙; 12 at launch.
  - **Royal:** gacha, 120 💎 or a coupon; 6 at launch (Season 1); pity 10; duplicate = +25 🌟; 2–3 new per season.
  - **Celestial:** 0.5% per pull, hard pity at 150, separate counter, duplicate = +150 🌟; **2 at launch** (`hair_celestial_seraph` "Astral Seraph Cascade" and `hair_celestial_empress` "Solar-Lunar Sovereign"); ~1 every 6 months; animated + gold name + its own reveal + bundled Celestial Prismatic dyes. **Must look super cool and worth it.**
- Launch Hair Batch: **20 hairstyles total: 12 Classic + 6 Royal (Season 1) + 2 Celestial**.
- Hair Studio "Fluffé's Hair Studio" (poodle stylist). Opens from the Wardrobe 💇 tab until the Town Hall (Phase 5). Free hair closet.
- Hair Colour & Dye Closet:
  - All purchased dyes (`500 🪙` Basic Salon Dyes and `50 💎` Ombre Glow Dyes) are **permanently unlocked** in the player's Hair Closet (free to switch back anytime).
  - Full palette = **20 swatches**: 4 Free Starter (`chestnut`, `midnight`, `honey`, `silver`) + 8 Basic (`500 🪙`: `sakura`, `coral`, `lavender`, `mint`, `azure`, `crimson`, `ginger`, `snow`) + 6 Ombre (`50 💎` two-tone vertical gradient + sheen: `ombre_sunset`, `ombre_mermaid`, `ombre_nebula`, `ombre_matcha`, `ombre_bloodmoon`, `ombre_aurora`) + 2 Celestial Prismatic (`celestial_astral` and `celestial_solarlunar`, bundled & permanently unlocked with the 2 Celestial hairs, featuring multi-stop animated aurora wave + twinkling starlight micro-glints).
  - Ornament Preservation in `accFragShader`: only low-saturation neutral-grey hair pixels are dyed, while coloured ornaments (ribbons, pearls, gold star clips, flowers, halos) keep their crisp original colours.
- Save migration: `bkk` → boy + silver hair + wolf ears/tail; `dxb` → girl + peach long hair + horns/tail.

## 2. Done so far
| Area | State |
|---|---|
| Bald bodies, 3 wigs (`hair_boy_fluffy`, `hair_girl_waves`, `hair_bob_blunt`), ears/horns/tails | Sliced and registered (`scripts/art_sheets.json`, `npm run slice-assets`) |
| Rig `client/js/chibi_rig.js` | `setHair` / `layoutHair` (tint + neck clip); `hairHatFit` lift/grow for hat-slot items per wig; per-view `scales` for accessories; tails use per-view sprites and **sway around their root** via `this.tail.pivot` (`roots` per view, default front/side `[0.42, 0.18]`, back `[0, 0.42]`) |
| `shared/hair_catalog.js` | `HAIRSTYLES` with attach + `hatFit`; `hairHatFit()`; `STARTER_HAIR_COLORS` (4) |
| `shared/accessory_attach.js` | Hats re-based on reference wig `hair_girl_waves`; the 5 headwear items now point to `<id>_side` / `<id>_back`; tails point back view to `<id>_back` |
| New art | `art_src/sheet_v2e_headwear_views.jpg` (straw/cat headset/bunny × side, back; the bunny side cell was composited in) and `art_src/sheet_v2f_ears_tails_views.jpg` (wolf ears, horns × side, back + wolf/dragon tail back; the horn side cell was composited in). All are registered with `faces: right` |
| Dress-up dev page (`?dev=1&dressup=1`, `client/js/dressup.js`) | Params `lineage`, `hair`, `item`, `back`, `outfit`, `color`, `target=hair`. **+/- now edits per-view `scales` when the offset mode is a single view.** Server `/api/dev/attach` persists `scales` |
| Docs | Celestial tier + release policy added to the design doc §4/§8 and spec §23.C |
| Tests | `npm test`: 59/59 pass (after the rig changes) |

## 3. In flight when this conversation ended (check their results; revive or redo if lost)
1. **Turnaround Calibrator** (subagent `60f6573c-ab80-4464-a18d-e7b09392b958`). Adds `offsets.side/back` + `scales.side/back` to the 5 headwear items + 2 tails in `shared/accessory_attach.js`. Acceptance criteria are in its prompt (same apparent height as the front ±5%, cat cup over the ear, horns/ears toward the back of the crown, tails centred on the lower back, not below the knees, checked on boy + girl).
2. **Face calibrator** (subagent `60b628d8-65bd-41c4-af71-813b38d32d5a`). `face_rosegold_shades`, `face_cyber_visor`, `face_oracle_monocle` sat over the MOUTH on the v2 bodies; they must sit on the eyes ±3px, checked on boy + girl. Front view only.

**→ When they report: re-render and review personally** (crops of each item: front/side/back, boy + girl, plus a walk pose). Don't trust their "pass".

## 4. Remaining steps (in order)
1. **Finish the prototype review.** Accept or fix the calibrations above, then check:
   - Walk pose: inject the uniforms via the 3rd arg of the shoot script, e.g. `for (const r of window.__dressupRigs){const u=r.material.uniforms;u.uHead.value=0.14;u.uTorso.value=0.06;u.uLegL.value=0.3;u.uLegR.value=-0.3;r.HIP.position.y=0.08}`.
   - Tail sway at the extremes: set `r.tail.pivot.rotation.z = ±0.26`. The root must stay attached.
   - Hair over hats on all 3 wigs.
   - Also test **in the real game** (walk + pop-turn), not only the dress-up page.
2. **Show the user** before/after composites, then wait for approval.
3. **Hair Spec Sheet:** silhouette envelope around the head template, grey palette, line weight. Then generate the launch batch in one consistent session: **20 hairstyles total: 12 Classic + 6 Royal (Season 1) + 2 Celestial** (`hair_celestial_seraph` "Astral Seraph Cascade" and `hair_celestial_empress` "Solar-Lunar Sovereign"). Prototype the Celestials first (animated shimmer/strands/aurora wave; needs a shader or FX work) and show the user.
4. **Automated hair × headwear matrix QA script:** every wig × every hat-slot item × 3 views → a contact sheet. It must pass review before any style ships.
5. **Redraw the 19 costumes** on the boy/girl bald bodies (the prompts exist in the d76b8233 conversation; the pipeline is `autoHead` head paste). Rename `bkk_*`/`dxb_*` → `boy_*`/`girl_*`.
6. **Gameplay:**
   - `profile.appearance` + save migration (§5 of the design doc).
   - Onboarding becomes Boy/Girl + hair + 4 colours.
   - Wardrobe 💇 Hair tab: Classic Cut, Royal/Celestial gacha with separate pity counters, dyes (permanent 20-swatch closet unlocks, accFragShader ornament preservation), free closet.
   - Server validation + unit tests + a QA script (follow the existing Step 2/3 QA scripts in `scripts/`/`tests/`).
7. **Hat-cover rule:** big hats declare `hairCover: 'top'` (not implemented yet).

## 5. Known art issues (batch with the redraw)
- `hair_girl_waves`: a stray curl near the chin/nape in the side view.
- Old front `back_dragon_tail` has a cut/open root (hidden behind the body in front/side; the back view now uses the new art).
- Gloves and boots reuse the front art in the side view (acceptable so far, but re-check with the detail bar above).
- Face items are hidden in side/back by design. Consider side art for sunglasses later.
- Hat sprites are small (sheet cells ~424 px); fine at game scale.

## 6. Tools and commands
```bash
# render the dress-up page (FRONT/SIDE/BACK at x≈310/750/1190 of a 1500x760 png)
node /Users/thanapat/.gemini/antigravity/brain/d76b8233-ec1c-442f-83a7-707f338bc9f1/scratch/shoot_dressup.mjs OUT.png \
  "lineage=girl&hair=hair_girl_waves&item=hat_dragon_horns&back=back_dragon_tail&color=e8b86a" ["<js to eval>"]
npm run slice-assets        # after editing art_sheets.json / art_src (expects "0 warnings")
npm test                    # unit tests
```
- Composite cells into a sheet with PIL: white-fill the cell, trim the new art by bbox, scale it to the old content height, centre it. See this conversation's transcript.
- Useful recent renders are in `/Users/thanapat/.gemini/antigravity/brain/d76b8233-ec1c-442f-83a7-707f338bc9f1/scratch/` (`tv_grid.png` = first turnaround pass before calibration, `audit_grid.png` = gloves/boots/face audit).

## 7. Pitfalls
- `faces` on hair/accessory cells controls mirroring. The boy fluffy side wig needed `faces: 'right'` per cell.
- Hat calibration is relative to the **reference wig `hair_girl_waves`**. Other wigs only change `hatFit`. Never calibrate a hat on a non-reference wig.
- The accessory `scale` = sprite **width** in head-heights. Side drawings are narrower or wider than the front ones, so always use `scales.side/back`, never reuse the front scale.
- Tail `offset` locates the sprite **centre**; the sway pivot is derived from `roots`. If a back-view tail root drifts while swaying, tune `roots.back`.
