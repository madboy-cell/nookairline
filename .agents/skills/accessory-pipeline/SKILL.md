---
name: accessory-pipeline
description: End-to-end art generation, slicing, crown-anchoring, and 3-view verification pipeline for creating or patching chibi accessories (hats, ears, horns, headsets, glasses/facewear, gloves, held weapons, boots, wings, tails, and shoulder capes) in Neora World V2.
---

# Neora World V2 — Chibi Accessory & Hair Fit Pipeline

Whenever the user asks to create, generate, or patch an accessory (`hat`, `face`, `gloves`, `boots`, `wings` / `tail` / `cape`) or hairstyle in `neora-world-v2`, follow this exact 4-step pipeline.

---

## Step 1: Slot Art Rules & Prompt Engineering (`image-generator`)

All chibi art uses the **Tree of Savior (ToS) 2.5D Storybook Gouache & Warm Ink Outline (`#3a2415`)** style on a **pure flat white `#FFFFFF` background** with generous white margins around every cell so nothing touches cell borders.

> [!IMPORTANT]
> **THE ToS 2.5D THREE-QUARTER (`3/4`) PERSPECTIVE LAW & RARITY HIERARCHY (`Mythic ★3 > Epic ★2 > Rare ★1`)**:
> 1. **ToS 2.5D `3/4` Perspective**: Characters **NEVER** face the camera at a flat `0°` straight-on angle!
>    - **`front` view** is a **~25–30° Three-Quarter (`3/4`) view turned toward the viewer's RIGHT** (near ear/temple on viewer's left at `x ≈ -0.36 * HEAD_H`; nose & far eye shifted right at `x ≈ +0.08..+0.36 * HEAD_H`; far ear tucked behind far cheek).
>    - **`side` view** is a **90° Pure Side Profile facing the viewer's RIGHT** (only the single near ear/temple is visible near `x ≈ -0.06 * HEAD_H`).
>    - **`back` view** is a **~25–30° Three-Quarter (`3/4`) Back view**.
> 2. **Rarity Visual Hierarchy (`Mythic ★3 > Epic ★2 > Rare ★1`)**:
>    - **Rare (`★1`)**: Charming, simple everyday fantasy/cozy silhouettes, 1–2 matte gouache colours, minimal trim (e.g., straw hat, slime rainboots, simple mittens).
>    - **Epic (`★2`)**: Noticeably cooler, more ornate and prestigious mid-high fantasy silhouettes — metallic silver/gold/rose-gold filigree, glowing rune/starlight crystals, feathered or velvet accents, and refined craftsmanship, while staying one tier more compact than Mythic.
>    - **Mythic (`★3`)**: The ultimate apex of beauty and coolness — sovereign/celestial/divine relics with multi-layered luminous auras, floating astral halos, grand multi-wing silhouettes, and intricate royal jewellery.

### A. Headwear (`slot: 'hat'`, Bone: `'HEAD'`)
Requires **3 views**: `<id>` (Front-3/4 facing viewer's right), `<id>_side` (Pure Side Profile facing viewer's right), and `<id>_back` (Back-3/4 view).
1. **Ears & Horns (`hat_wolf_ears`, `hat_dragon_horns`, etc.)**:
   - **CRITICAL BASE RULE**: Must have an **OPEN CONCAVE SKULL-ARCH BASE** (curving upward in the middle like an upside-down `U` to hug a rounded head dome) with **NO closed bulbous bottom and NO dark ink outline along the bottom cut edge**.
   - **3/4 Silhouette**: Sweep **outward from the sides of the crown and then upward** (never inward like bull/garlic horns `( )`), angled ~25° toward the viewer's right in `front` view (near ear/horn on left slightly fuller; far ear/horn on right slightly foreshortened).
2. **Headsets & Ear-Muffs (`hat_cat_headset`, etc.)**:
   - **CRITICAL ToS 2.5D 3/4 RULE**: Because the head is turned ~25–30° to the right in `front` view:
     - The **near (left) ear-cup** sits over the near ear (`x ≈ -0.36 * HEAD_H`), showing its full 3/4 outer shell.
     - The **far (right) ear-cup** must be **foreshortened (narrower) and tucked partially behind the far temple/hair** so it doesn't clamp over the character's right eye/cheek.
     - **Both ear-cups must show their solid outer shell**—**NEVER** draw an ear-cup turned inside-out showing a dark/grey inner speaker cushion hole (`O`).
     - In **`side` profile**, draw **ONLY ONE ear-cup** centered over the side ear (`x ≈ -0.05 * HEAD_H`) with the headband rising to a single profile ear/ornament on top.
3. **Headbands (`hat_glowing_bunny`, tiaras, Alice bands, maid headbands, droopy animal ears)**:
   - **CRITICAL 3/4 PERSPECTIVE ORIENTATION CHECK (Near Ornament on Left, Inner Arch Wall on Right)**: Because the character faces **Front-Right (~25–30°)** in `front` view, any asymmetrical or 3/4-angled headband (`hat_berry_maid_headband`, `hat_honey_bear_ears`, `hat_cloudy_sheep_horns`) MUST have its **foreground/near bow or ornament on the viewer's LEFT (near temple)** and its **visible inner headband arch wall on the viewer's RIGHT (far temple)**. If an AI generator draws the foreground bow on the right and the inner arch wall on the left (facing Front-Left), horizontally flip `<id>.png` and `<id>_back.png` so the 3/4 perspective matches the character!
   - **CRITICAL SIDE-TIP & HORSESHOE PRONG RULE**: The headband arch sits on the **top crown** of the head in 3/4 perspective. Keep the lower left/right side tips **short** (stopping high on the upper crown, above the temples) so the lower prongs never dangle down over the forehead or cover the eye in Side Profile. If an AI generator draws long horseshoe `U`-shaped plastic headband legs extending down below ears/horns/bows, trim the bare lower headband legs during slicing, parabolically round the cut corners, and cap the trimmed bottom edge with a 2px `#3a2415` warm dark-brown ink outline so there is never a flat horizontal razor cut!
   - **Per-View `contactYs` (`{ side, back }`) for Side-Draping Bows / Droopy Ears**: When a crown-anchored headband (`anchor: 'crown'`) has side-draping ribbons, bells, or droopy lamb/fox ears (`hat_crimson_kitsune_ears`, `hat_cloudy_sheep_horns`, `hat_berry_maid_headband`), its `front`/`back` views have a deep hollow arch (`contactY: 0.40..0.55`) while its `side` profile may have a different bottom-to-crown ratio. Use `contactYs: { side: 0.20..0.50, back: ... }` in `shared/accessory_attach.js` so `resolveAccessoryLayout()` anchors all 3 views cleanly at `CROWN_Y`.
4. **Full-Crown Hats (`hat_straw_explorer`, `hat_clover_beret`, witch hats, closed bucket helmets)**:
   - Set `hairCover: 'top'` in `ATTACH`. In `client/js/chibi_rig.js`, this automatically clips the wig along the **physical head-space brim plane** (`hatClipY = 0.81 + 0.24 * xFacing` in `front`/`side` views to follow angled hat brims, and `0.78` in `back` view) so both short twin-buns (`hair_double_buns`) and long waves tuck cleanly inside the hat crown with zero half-sliced buns and zero forehead gap, and ignores `hatFit.lift` so the hat sits snugly on the skull.
5. **Skull-Anchored Open-Top Helms, Circlets & Winged Diadems (`hat_valkyrie_diadem`, `hat_astral_eclipse_crown`, `hat_sylvan_antler_circlet`, forehead bands, tiaras with temple guards)**:
   - **Why `anchor: 'skull'` (NOT `anchor: 'crown'`)**: Unlike top-mounted animal ears (`CROWN_Y = 1.00`), a helm, diadem, or circlet wraps around the **forehead and temples (`RIG_METRICS.SKULL_Y = 0.76 * HEAD_H`)** with `browY` (default `0.29` in `front`/`side`, `0.12` in `back`). Using `anchor: 'skull'` locks the brow gem onto the forehead right above the eyebrows, hugs the left/right temples (`scale: 1.22`), and sets `hairLift = 0` so the helm **never floats into the air** when equipping high twin-buns (`hair_double_buns`).
   - **CRITICAL VISIBLE vs. OCCLUDED PARTS LAW (Across All 20 Hairstyles)**:
     - **In `front` view**: Draw **ONLY the front-facing brow band, center crest/gem, and outer left/right temple guards & wings**. **NEVER** draw the back-strap loop behind the left wing or the dark-grey interior back wall inside the right arch—because the character's head and bangs fill the interior of the helm!
     - **In `side` view**: Draw **ONLY ONE near-side wing** and the side-to-front temple/brow arch (with the front brow gem on the right edge). **NEVER** draw the far-side wing sticking up behind the near wing or the back-strap behind the ear.
     - **In `back` view**: Because our 20 hairstyles include thick flowing waves, high ponytails, back bows, and twin-buns covering the back of the head, **NEVER** draw a downward-curving `U`-shaped metal collar hoop across the middle of the back of the head. Instead, draw **only the backs of the left and right temple wings/mounts** emerging cleanly from the left and right sides of the skull (`browYs.back: 0.12`) so they work seamlessly across every hairstyle!

### B. Facewear (`slot: 'face'`, Bone: `'HEAD'`)
- Front-3/4 view (`views: { front: '<id>', side: null, back: null }`) drawn in **~25° 3/4 perspective facing the viewer's right**:
  - **Level horizontal bridge** sitting over the 3/4 nose (`x ≈ +0.06..+0.08 * HEAD_H, y ≈ 0.48 * HEAD_H`).
  - **Left (near) temple arm** visible extending to the left toward the near ear; **NO temple ear-hook sticking out past the right (far) frame** (since the far temple is behind the head in 3/4 view).
- **CRITICAL POST-SLICE GLASSES CLEANUP (Rim-Outline Tracing & Lens Alpha)**:
  - **Continuous Rim-Outline Tracing When Stripping Far-Side Temple Arms**: When an AI generator draws an occluded far-side (right) temple arm angling up from the right lens frame, find the last column `x_last` containing a transparent gap between the upper temple arm and the lower lens rim, and for `x <= x_last + 1` clear downwards until hitting the continuous dark-brown ink outline (`#3a2415`, `lum < 110`) of the right lens rim. This removes 100% of the temple arm join without notching the top of the right lens frame.
  - **Sheer Semi-Transparent Lens Interior (`alpha = 45..95`)**: Enclosed near-white or pastel lenses on a `#FFFFFF` background are not reached by border flood-fill and remain `alpha = 255` opaque, hiding the character's eyes! Always set enclosed interior lens pixels (away from the `#3a2415` frame outline) to sheer semi-transparent (`alpha = 45..95`) so the character's eyes shine clearly through clear and tinted glasses.
- **CRITICAL FACEWEAR-OVER-HELM Z-LAYERING LAW (`face` > `hat`)**:
  - In both 3D WebGL (`client/js/chibi_rig.js`: `ACC_ORDER = { boots: 1, gloves: 2, hat: 3, face: 4 }`, `ACC_Z.front = { hat: 0.08, face: 0.10 }`) and 2D DOM Paper-Doll (`shared/accessory_attach.js`: `order = { boots: 1, gloves: 2, hat: 3, face: 4 }`), **`face` MUST always render on the top layer above `hat`** (with front hair behind both at `z = 0.06`).
  - Rationale: Skull-anchored helms, tiaras, and circlets (`anchor: 'skull'`) have side temple guards that curve down along the temples; placing `face` (`z = 0.10`) above `hat` (`z = 0.08`) ensures glasses lenses, butterfly frames, and masquerade masks sit cleanly in front of the helm's temple tips rather than being pierced by them.

### C. Gloves, Gauntlets & Held Weapons (`slot: 'gloves'`, Bone: `'ARM'`)
- Single sprite `<id>` mirrored automatically onto left/right arms (or set `singleHand: true` for held wands/weapons so it only equips on the leading hand).
- **Canonical Glove Orientation & Fingerless-Glove Guard**:
  - Drawn **vertically upright** with the **wrist/forearm cuff at the TOP**, **fingers pointing straight DOWN**, and **thumb on the LEFT** (matching `gloves_vorax_cyan.png` and `gloves_cat_mittens.png`). If an AI generator draws a glove at a diagonal angle, rotate it upright and orient thumb-left before slicing!
  - **No Bare Peach Fingertips**: Never leave peach skin-colored fingertips on fingerless gloves; recolor any peach fingertip pixels (`R > 215, G ∈ [155, 210], R - B > 30`) in the bottom 35% of the sprite to cream/white glove fabric so the glove works across all character skin tones.
- **CRITICAL CHIBI HAND & GAUNTLET PROPORTIONS LAW**:
  - **Prompting Rule**: Always prompt for **compact chibi hand proportions with short, cute stubby/rounded fingers** (**NEVER** long adult-proportioned fingers) occupying ~40–48% of the cell height. Normal gloves have a compact wrist cuff (`aspect ratio h/w ≈ 1.35–1.45`); gauntlets have a flared forearm cuff (`aspect ratio h/w ≈ 1.50–1.58`, only **~10% taller** than a normal glove).
  - **Slicing Aspect-Ratio Guard**: If an AI generator draws a gauntlet with elongated fingers (`h / w > 1.60`), apply a smooth piecewise vertical remap (`np.interp`) during slicing that keeps any back-of-hand crystal/emblem `1:1` unstretched while compacting the finger segment so `h / w` lands in the canonical `1.52–1.56` chibi gauntlet range.

### D. Footwear (`slot: 'boots'`, Bone: `'LEG'`)
- Single right-facing 3/4 boot sprite `<id>` (automatically duplicated onto left/right legs and clipped under floor-length gowns when `longHem` is active).
- **Canonical Boot Orientation**: **Heel (and any outer ankle wing/ornament) on the LEFT, toe pointing to the RIGHT** (matching `boots_hermes_greaves.png`). If an AI generator mirrors a boot or glasses cell left-facing, horizontally flip that cell before slicing.

### E. Back Slot (`slot: 'wings'`) — 3 Socket Modes
1. **Flapping Wings (default, `wings_*`)**:
   - Single symmetrical front-facing spread-wing sprite `<id>`. The engine splits it at `x = 0.5` into left/right flapping halves anchored at shoulder height (`WING_Y_FRONT = 0.55`). Both halves meet seamlessly at `x = 0` (`u = 0.5`), or you can place symmetrical ornaments on the left and right wing roots (`x ≈ 0.38..0.44` and `x ≈ 0.56..0.62`, like `wings_berry_cupid`).
2. **Hip Tails (`socket: 'hip'`, `back_*_tail`)**:
   - `<id>` (side/3/4 profile with base on the **RIGHT** and tip curving to the **LEFT** so it trails behind a right-facing character) + `<id>_back` (seen from behind, hanging from top-center at `z = 0.11, renderOrder = 5.5` so it renders cleanly in front of waist-length hair).
3. **Shoulder Capes / Backpacks (`socket: 'shoulders'`)**:
   - Non-flapping back item parented to `TORSO_G` at `SHOULDER_Y`.

> [!TIP]
> **Batch Generation Concurrency Rule (`image-generator`)**: When generating multiple sheets in parallel, invoke `image-generator` subagents in waves of **4 to 6 concurrent subagents max** to avoid hitting the 2-second burst rate limit on `gemini-3.1-flash-image`.

---

## Step 2: Register & Slice (`scripts/art_sheets.json` → `npm run slice-assets`)

1. Add the sheet and cell definitions in `neora-world-v2/scripts/art_sheets.json` (`"pack": "chibi"`).
2. Run:
   ```bash
   npm run slice-assets
   ```
   Verify `0 warnings` (no cell border clipping) and inspect the sliced PNG cutouts in `client/assets/chibi/<id>.png` using `view_file`.
   - **Snow-White Fur / Feather Hole-Knockout Guard**: When slicing snow-white ears/wings (e.g. `hat_crimson_kitsune_ears`), do not set a low `holeMinArea` (`< 350`) across the upper fur/feather region, or pure-white fur highlights (`RGB >= 235`) surrounded by shading may be mistaken for enclosed background holes. Only knock out small enclosed white loops inside lower ribbon bow loops (`y > 0.52 * h`).
   - If you post-process any sliced PNGs (e.g. trimming horseshoe headband legs or stripping occluded far-side temple arms), update `w` and `h` in `client/assets/asset_manifest.json` to match the final PNG dimensions.

---

## Step 3: Catalog & Automatic Crown / Skull / Dual-Eye / Hand Anchoring (`shared/catalog_gear_pets.js` & `shared/accessory_attach.js`)

1. Add the item metadata (`slot`, `rarity`, `name`, `cp`, `set`) in `shared/catalog_gear_pets.js`.
2. **Automatic Crown Anchoring (`anchor: 'crown'` for Top Headwear — Ears, Horns, Headbands, Top-Hats)**:
   - By default, `DEFAULT_SLOT_ATTACH.hat` in `shared/accessory_attach.js` uses `anchor: 'crown'` (`contactY: 0.14`, with optional per-view `contactYs: { side, back }`), which uses `resolveAccessoryLayout()` to automatically place the bottom contact arch of any new hat/ear/horn onto `RIG_METRICS.CROWN_Y` (`1.00 * HEAD_H`) with `offset: [0, 0]`, regardless of how tall the ears/plumes are!
   - Normalized `hatFit` across all 20 hairstyles (`lift: 0.02..0.05`, `grow: 1.03..1.06`) keeps headbands/ears/horns anchored on the skull between twin-buns or in front of high ponytails instead of floating in mid-air.
3. **Automatic Skull / Brow Anchoring (`anchor: 'skull'` for Helms, Circlets & Diadems)**:
   - Set `anchor: 'skull'`, `browY: 0.29`, `browYs: { back: 0.12 }` in `ATTACH`. `resolveAccessoryLayout()` automatically places the inner brow arch onto `RIG_METRICS.SKULL_Y` (`0.76 * HEAD_H`) with `hairLift = 0` so the helm locks onto the forehead and temples across all 20 hairstyles without lifting on buns.
4. **2-Point Dual-Eye Lens-Opening Anchoring & Auto-Tilt Leveling (`anchor: 'eyes'`, `leftEye: [uL, vL]`, `rightEye: [uR, vR]`)**:
   - **Never estimate eye centers from the outer bounding box** (which shifts horizontally depending on whether the sprite has a long left temple arm, a side cloud/flower charm, or no temple arm at all, and fails if the AI draws the glasses at a 3/4 tilt angle).
   - Instead, detect the **two largest enclosed semi-transparent lens openings** via connected components on the sliced PNG to obtain the exact lens centroids `leftEye: [uL, vL]` (`u` in `0..1` from left, `v` in `0..1` from bottom) and `rightEye: [uR, vR]`.
   - When `leftEye` and `rightEye` are provided on `anchor: 'eyes'`, `resolveAccessoryLayout()` solves a full **4-DOF 2D Similarity Transform** (`effScale`, `ox`, `effOy`, and counter-tilt rotation `rotZ = clamp(-atan2(dv, du), -0.24, 0.24)`), locking **Left Lens $\to$ `LEFT_EYE_X` (`-0.067`)** and **Right Lens $\to$ `RIGHT_EYE_X` (`+0.300`)** at `EYE_Y` (`+0.529`) with `offset: [0, 0]`, `scale: 1.0`—100% invariant to temple-arm length, side charms, or AI drawing tilt!
5. **Automatic Hand & Gauntlet Anchoring (`anchor: 'hand' | 'gauntlet'` for Gloves & Gauntlets)**:
   - Never rely on raw width-only `scale` for gloves/gauntlets—otherwise a tall gauntlet (`aspect = 1.83`) at the same width scale balloons +33% in height and hangs down past the thighs.
   - Use `anchor: 'hand'` for normal gloves/mittens (target height `RIG_METRICS.GLOVE_TARGET_H = 0.49 * HEAD_H`) or `anchor: 'gauntlet'` for armored gauntlets/bracers (target height `RIG_METRICS.GAUNTLET_TARGET_H = 0.54 * HEAD_H`, **~10% larger than a normal glove**) with `offset: [0, 0]`, `scale: 1.0`.
   - `resolveAccessoryLayout()` automatically normalizes the height, caps max width (`GLOVE_MAX_W = 0.36`), and locks the bottom fingertips onto `RIG_METRICS.HAND_TIP_Y` (`-0.71 * HEAD_H`), so a gauntlet's extra cuff length always extends **up the forearm toward the elbow** rather than hanging below the fingertips.

---

## Step 4: Visual 3-View Verification (`scripts/shoot_dressup.mjs` + `view_file`)

Always verify every new or patched accessory across **Front-3/4, Side Profile, and Back-3/4** on both Long Hair (`hair_girl_waves`) and Updo/Buns (`hair_double_buns`) or Short Boy Hair (`hair_boy_fluffy`):

```bash
node scripts/shoot_dressup.mjs /tmp/check_item.png "lineage=girl&hair=hair_girl_waves&item=<item_id>"
```

Inspect `/tmp/check_item.png` with `view_file`, or open `http://localhost:4000/?dev=1&dressup=1&item=<item_id>` to nudge with Arrow keys (`← ↑ → ↓`), resize with `+ / -`, and press `S` to save directly to `shared/accessory_attach.js`. Finally, run `npm test`.

