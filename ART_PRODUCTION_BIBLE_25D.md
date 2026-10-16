# 🏡 Neora World V2 — Official 2.5D Village & Sky Monopoly Art Production Bible

> [!TIP]
> **✅ 100% Complete — All 111 Assets Generated, Inspected, Alpha-Matted, Wired & Verified (`55/55` QA Passed)**
> - **All 13 Master 2.5D Art Sheets** (`sheet_2a_buildings.jpg` through `sheet_2m_new_decor_2.jpg` + `sheet_4b_monopoly_25d_tiles.jpg`) have been generated, visually audited for text/halo/shadow defects, flood-fill alpha-matted + interior-hole cleared (`holeTolerance: 42`, `coreInset: 2`), tight-cropped, and registered in [`client/assets/asset_manifest.json`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/assets/asset_manifest.json) (**528 total sprites, 0 warnings**).
> - **Live Three.js Village Plaza & Sky Monopoly Wired**:
>   - **Sunlit Golden-Meadow Ground & 2.5D Road Curbs**: Fixed the floating island `lip` Y-offset (`y = -0.22`) so `ground_classic` renders with zero Z-fighting, added `THREE.RepeatWrapping` on first GPU upload in [`client/js/assets.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/assets.js), and added raised cream-stone curbs (`#F3E5D0`), overhanging grass/clover/daisy tufts (`decal_grass_clover_a`, `decal_grass_daisies_b`), and a 4-way cobblestone garden medallion (`tile_plaza_cobble_medallion_4way`) in [`client/js/village_plaza.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/village_plaza.js).
>   - **2.5D Canal Bridge, Riverbank Boulders & Cliff Waterfalls**: Framed the canal crossing with carved cream-stone curbs and 4 spherical-finial stone pillars (`env_bridge_pillar_cap`), lined the North/South canal banks with mossy stone ledges, river boulders (`env_river_boulders_a/b`), cattails (`env_river_cattails`), and water-lilies/pink lotuses (`decal_water_lily_white`, `decal_water_lotus_pink`), and added cascading cliff waterfalls (`cliff_waterfall_strip` + `env_waterfall_mist`) at the island edges.
>   - **Expanded Catalog & Sky Monopoly Diorama**: Added all 4 new buildings (`windmill_bakery`, `flower_greenhouse`, `owl_post_office`, `starlight_lighthouse`), 12 new decorations (`dec_wooden_bench` through `dec_owl_mailbox`), and 30 environment props in [`shared/catalog_landmarks.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/catalog_landmarks.js), and wired the 2.5D grass, terracotta cliffs, trees, flower bushes, fences, and iron streetlamps into the **Sky Monopoly (`8×6` board)** Center Park Diorama in [`client/js/minigames/monopoly_25d/board_scene.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/minigames/monopoly_25d/board_scene.js).

````carousel
![Live 2.5D Sky Monopoly (Overview Camera — Zero Flashing, 2 Merged Cliff/Rim Draw Calls): 8x6 floating island with single-quad faceted terracotta cliff wall, merged 4-side scalloped wildflower grass rim, and 2.5D Center Park Diorama](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/live_25d_monopoly_fixed_overview.png)
<!-- slide -->
![Live 2.5D Sky Monopoly (Follow Camera): Crisp 3D perimeter tiles, zero Z-fighting against the scalloped grass rim and terracotta cliff wall, and mobile-hardened Ultimate VFX](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/live_25d_monopoly_fixed_follow.png)
<!-- slide -->
![Live 2.5D Floating Island Bottom-Right Cliff Edge (Fixed!): Scalloped flower-dotted overhanging meadow grass rim blending seamlessly into the lawn above chiseled 2.5D terracotta-sandstone cliff rock strata and golden-hour clouds](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/live_25d_bottom_edge_cliff_v6.png)
<!-- slide -->
![Live 2.5D Village (Nook's Sky-Island): Sunlit golden-meadow grass with clover blossoms, warm honey-sandstone cobble avenues with raised cream-stone curbs and overhanging grass/wildflower tufts, carved stone bridge pillars, mossy river boulders & water-lilies, and 2.5D landmarks on integrated cobble + flower-bush bases](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/live_25d_village_nook_v5.png)
<!-- slide -->
![Live 2.5D Village (Neen's Sky-Island): Grand Castle, Cat Boba Patisserie, Couple Heart Ferris Wheel, Sakura Swing, Cattails & River Boulders, and 2.5D Storybook Oak/Sakura/Golden Maple trees](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/live_25d_village_neen_v5.png)
<!-- slide -->
![Live 2.5D Couple Rainbow Bridge & Scalloped Island Rim: Nook visiting Neen's island across the Rainbow Heart Bridge, with the 2.5D scalloped grass-and-rock rim running cleanly along the entire island perimeter](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/live_25d_bridge_crossed_v5.png)
<!-- slide -->
![Dark-Checkerboard Cutout Audit (Buildings, Wonders, Decor & Trees): Verified zero white halos, zero flat green oval discs, and clean interior cutouts (including under the Sakura Swing and inside the Ferris Wheel spokes)](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_cutouts_clean_v2.png)
<!-- slide -->
![Dark-Checkerboard Cutout Audit (All Remaining Props, Fences, Lamps, Decals, Cliffs & Monopoly Tiles): Verified 100% clean alpha mattes across every generated sheet](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_cutouts_all_props_v2.png)
````

> [!IMPORTANT]
> **Instructions for the Autonomous Art-Generation Agent**
> This document is the **single source of truth** for generating every 2.5D terrain tile, road transition, bridge module, river bank, floating sky-island cliff/waterfall block, tree, bush, fence, streetlamp, placeable decoration (**20 total — 8 existing + 12 new**), landmark/wonder (**15 total — 11 existing + 4 new**), and **Sky Monopoly (`8×6` board)** asset (**111 assets total**) piece-by-piece.
> 1. **Before generating any asset**, view the 4 Master Visual Reference files listed in **Section 1** using `view_file` so your visual context is locked to the exact linework, shading, and proportions.
> 2. **Prepend the exact Universal Master Style Preamble** from **Section 2.1** (`Master Sprite Preamble` for upright sprites on `#FFFFFF`, or `Master Terrain Swatch Preamble` for seamless tiles) to the asset's **Ready-to-Use Prompt**.
> 3. **Run the Post-Processing Alpha-Matting & Tight-Crop CLI Command** in **Section 2.4** immediately after generating each sprite so it is flood-fill alpha-matted, de-haloed, tight-cropped to its bottom-center ground contact line, and registered in `client/assets/asset_manifest.json`.

---

## 1. 🎨 Master 2.5D Design Language & Reference Sheets (View First!)

Every asset generated by an agent **MUST** match the exact 2.5D hand-painted storybook design language established in these 4 reference sheets:
- **Primary Visual Target (`1:1` Style Benchmark)**: `/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/.user_uploaded/media_1792120873167_f87cecd5.jpg`
- **Master `12×12` Starter Sky-Island & 4-Part Design Language Sheet**: `/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_design_language_1792121064642.jpg`
- **14-Piece Modular 2.5D Tile, Bridge, River, Cliff & Foliage Master Kit**: `/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_master_kit_1792121395990.jpg`
- **6 Isolated Hand-Painted 2.5D Environment Sprites Sheet (`#FFFFFF`)**: `/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_sprites_sheet_1792121379114.jpg`

````carousel
![Neora World V2 — 2.5D Starter Sky-Island & Design Language Sheet: Cozy 12x12 floating island with Castle, Waterwheel Mint, Goddess Shrine, Gramophone & Sakura Swing, organic rounded sandstone cobbles with raised stone curbs, carved cream-stone bridge with twin glowing streetlamps, mossy river boulders & waterfall cliff](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_design_language_1792121064642.jpg)
<!-- slide -->
![Neora World V2 — 14-Piece Modular 2.5D Master Kit: (Row 1) Seamless Meadow Grass, Straight Cobble Road with Stone Curb & Flower Overhang, 90° Curved Road with Bush, 4-Way Garden Medallion Plaza, Stepping Stones; (Row 2) Carved Stone Bridge + Lamps, Mossy Boulder River Module, 3D Floating Cliff & Waterfall Blocks; (Row 3) Storybook Oak Tree, Sakura Tree, Rose/Daisy Hedge Cluster, Wooden Split-Rail Fence with Stone Pillars, Vintage Iron Streetlamp](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_master_kit_1792121395990.jpg)
<!-- slide -->
![Neora World V2 — 6 Isolated Hand-Painted 2.5D Environment Sprites: Extracted directly into our live Three.js engine](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_sprites_sheet_1792121379114.jpg)
<!-- slide -->
![Your Reference Target (media_1792120873167_f87cecd5.jpg): For 1:1 comparison](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/.user_uploaded/media_1792120873167_f87cecd5.jpg)
<!-- slide -->
![Live Three.js Engine (Full Plaza with Real 2.5D Sprites): Seamless sunlit meadow grass, staggered warm sandstone cobbles with bevelled stone curbs, carved stone bridge parapets + twin glowing streetlamps, mossy river boulders & cattails, and 2.5D oak trees + rose/daisy bushes framing the Castle, Shrine & Swing](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_real_sprites_plaza.png)
<!-- slide -->
![Live Three.js Engine (1:1 Crop Under Nook & Nyx): Clean staggered warm sandstone cobbles under Nook's boots, flanked by the 2.5D carved stone bridge parapets, glowing iron streetlamps, and flowering bushes](/Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_real_sprites_crop.png)
````

---

## 2. 🧭 Global Style Bible, Palette & Post-Processing Pipeline

### 2.1 Universal Master Style Preambles (Prepend Verbatim to Prompts)

#### A. For All 2.5D Isometric Upright Sprites (Buildings, Wonders, Decor, Foliage, Bridges, Cliffs, Monopoly Tokens)
> **Master Sprite Preamble (Prepend Verbatim):**
> `"Masterpiece 2.5D isometric game art asset in the exact hybrid aesthetic of Tree of Savior and Cookie Run: Kingdom, hand-painted storybook gouache and warm watercolor illustration. Crisp, consistent warm dark sepia-brown ink outlines (#3a2415) with subtle line-weight variation framing every silhouette and internal architectural detail. Bathed in warm, diffused top-left golden-hour sunlight with soft creamy-amber highlights and warm violet-taupe contact shadows. Lush, toy-like chunky proportions with tactile hand-painted brushwork: multi-tiered emerald and chartreuse leaf clusters (#d9e650, #82c341, #488e35, #285826), warm honey-sandstone cobblestones (#f8cf95, #f4c78e, #e9c088), carved cream-ivory limestone masonry (#f7ecd5, #e3d1b0), warm cedar woodwork (#c67d3b, #8c5528), and pastel fairytale accents (strawberry-blossom pink #f48fb1, slate-sky blue #79a6d2, burnished brass-gold #f2b749). Strictly 3/4 isometric top-down camera pitch (~30°–35° elevation), no perspective distortion, isolated on a 100% flat, solid pure white (#FFFFFF) background with generous clean white margin on all four sides, zero cast shadows bleeding onto the white background, no ground plane square, no text, no watermarks, no UI."`

#### B. For Seamless Ground & Terrain Swatches (`client/assets/terrain/`)
> **Master Terrain Swatch Preamble (Prepend Verbatim):**
> `"Masterpiece top-down orthographic 2.5D seamless tileable game texture swatch in the exact hybrid aesthetic of Tree of Savior and Cookie Run: Kingdom, hand-painted storybook gouache and warm watercolor illustration. Warm top-left golden-hour lighting, soft painterly brushwork, high character readability on top, fill 100% of the square canvas edge-to-edge with zero borders, zero margins, and uniform illumination so repeating 4×4 or 1×1 UV wraps show no visible tiling seams, no text, no watermarks."`

#### C. Universal Negative Prompt (Apply to All Generations)
> `"flat green oval base, green circle cutout, square turf slab underneath sprite, plastic 3D CGI render, pixel art, pure black outlines #000000, harsh high-contrast mortar grid, photorealistic noise, gritty dark fantasy, neon cyberpunk, blurry airbrushing, cropped roof or canopy, text, watermark, UI elements"`

---

### 2.2 Master Color Palette Table (11 Core Material Systems)

| Material / Surface Category | Tier 1: Sunlit Highlight | Tier 2: Primary Midtone | Tier 3: Core Shadow | Tier 4: Deep Underside / Outline / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **1. Sepia Ink Outlines (Mandatory)** | `#5A3921` (Warm Chestnut Inner) | **`#3A2415` (Primary Sepia Ink)** | `#24150B` (Deep Crevice Ink) | **Never use `#000000` black**; `3.5–4.5px` outer contour, `1.5–2px` inner detail. |
| **2. Sunlit Meadow Grass (`ground_classic`)** | `#F1E562` / `#DED957` (Sunlit Lime) | **`#B9C54F` / `#7CC546` (Meadow Base)** | `#82A74A` (Soft Olive Moss) | `#4E7938` (Under-curb / tuft contact shadow). |
| **3. Sandstone Cobbles (`road_cobble`)** | `#FBD9A7` / `#F8CF95` (Sunlit Buff) | **`#F4C78E` / `#E9C088` (Honey Stone)** | `#CEA978` (Toasted Terracotta-Tan) | **Mortar Line:** `#BC9C65` (low-contrast warm sandy-taupe — calm under feet!). |
| **4. Cream Stone Curbs & Parapets** | `#FFF7E6` / `#FBF0DF` (Sunlit Ivory) | **`#F2E5C9` / `#EAD6BC` (Cream Stone)** | `#D4C09B` / `#C2A887` (Travertine Shade) | `#9E8264` (Recessed panel groove); used on castle, shrine, bridge parapets & fence posts. |
| **5. Crystal Canal Water (`water_canal`)** | `#F0FCFF` (Foam) / `#B8F0FF` (Glint) | **`#48B8E8` / `#73D7F7` (Cerulean Aqua)** | `#2A94C8` (Deep Canal Trough) | `#1B6E9A` (Internal water ripple line — never brown inside water). |
| **6. River Boulders & Moss** | `#A39B8B` (Lit Stone) / `#A8DC5A` (Moss) | **`#847B6E` (Grey-Taupe Boulder)** | `#61584E` (Wet Base Rock) | `#2D231E` (Rock crack ink); `#F0FCFF` water foam collar at base. |
| **7. Floating Cliff Earth & Rock Strata** | `#C98C64` (Sunlit Terracotta Ledge) | **`#A66A46` (Mid Ochre-Sienna Strata)** | `#7D4B2F` (Deep Earth Fissure) | Cool slate rock variant: `#96847A` → `#75645C` → `#52433D`. |
| **8. Foliage (4-Tier Gouache Puffs)** | **`#D9E650` (Golden-Lime Crown)** | **`#82C341` (Meadow Green Mid)** | **`#488E35` (Forest Green Shade)** | **`#285826` (Deep Emerald Underside)** — chunky scalloped cloud clusters. |
| **9. Sakura & Floral Accents** | `#FFF0F5` (Blush) / `#FFFDF7` (Daisy) | **`#FFB5C9` / `#F48FB1` (Sakura Pink)** | `#E67F9B` (Warm Rose) | `#B54E6B` (Berry Mauve); flower centers `#F9C846`; hydrangea `#73B3F5`. |
| **10. Honey-Oak Timber & Bark** | `#D9924C` (Sunlit Honey Oak) | **`#C67D3B` / `#B36A2E` (Cedar Plank)** | `#82471B` (Warm Umber) | `#592D10` (Dark Espresso Bark). |
| **11. Wrought Iron & Lantern Glow** | `#7D6858` (Warm Bronze Rim) | **`#4C3C33` (Forged Iron Body)** | `#FFF7B8` (Lantern Core Glow) | `#FFA826` (Warm Golden-Amber Halo); brass trim `#F2B749`. |

---

### 2.3 Three.js Engine & `asset_manifest.json` Rules

1. **Output Folders**:
   - **Seamless Terrain/Water/Road Tiles (`pack: "terrain"`)**: `/Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/assets/terrain/<asset_id>.png`
   - **All 2.5D Upright Sprites, Transitions & Decals (`pack: "village"`)**: `/Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/assets/village/<asset_id>.png`
2. **Bottom-Center Grounding Invariant (`anchorX: 0.5, anchorY: 0`)**:
   - In [`client/js/village_plaza.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/village_plaza.js), `addSprite()` builds `new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)` with `alphaTest: 0.5, depthWrite: true` and `userData.lean = true`.
   - Because `v = 0` sits directly on the ground plane (`y = 0`), **every upright sprite MUST be tight-cropped to its opaque bottom pixel (+2px pad)** so it sits flush on the ground with zero floating gap.

---

### 2.4 Piece-by-Piece Alpha-Matting & Manifest Registration CLI Pipeline

After generating any isolated sprite on `#FFFFFF` (saved to e.g. `art_src/<asset_id>.png` or `.jpg`), the agent **MUST** run this exact command in `/Users/thanapat/Documents/neora-world-v3/neora-world-v2` to perform border-seeded flood-fill alpha matting, enclosed white hole removal, 2px edge un-mixing, tight bounding-box cropping, and automatic registration in `client/assets/asset_manifest.json`:

```bash
node --input-type=module -e '
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { matteCell } from "./scripts/process_art_assets.js";

// Usage: node ... <srcFile> <pack:village|terrain> <spriteName> [holeMinArea=250]
const [srcFile, pack, name, holeMin = "250"] = process.argv.slice(1);
const buf = fs.readFileSync(srcFile);
const img = /\.png$/i.test(srcFile)
  ? PNG.sync.read(buf)
  : jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });

const res = matteCell(img.data, img.width, img.height, {
  holeMinArea: Number(holeMin),
  minIslandRatio: 0.004,
});
if (!res) throw new Error(`Matte failed (empty output) for ${srcFile}`);

const rel = `${pack}/${name}.png`;
const outPath = path.join("client", "assets", rel);
const png = new PNG({ width: res.width, height: res.height });
png.data = Buffer.from(res.data.buffer, res.data.byteOffset, res.data.byteLength);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(png));

let opq = 0;
for (let i = 3; i < res.data.length; i += 4) if (res.data[i] > 32) opq++;
const coverage = +(opq / (res.width * res.height)).toFixed(3);

const mfPath = path.join("client", "assets", "asset_manifest.json");
const mf = JSON.parse(fs.readFileSync(mfPath, "utf8"));
mf.generatedAt = new Date().toISOString();
mf.sprites[name] = {
  file: rel,
  w: res.width,
  h: res.height,
  anchorX: 0.5,
  anchorY: 0,
  coverage,
};
fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2));
console.log(`✓ Wrote ${outPath} (${res.width}x${res.height}, coverage=${coverage})`);
' art_src/<asset_id>.png village <asset_id> 250
```

> [!TIP]
> **Batch `2×3` or `3×3` Sprite Sheet Mode**: You can also generate 6 sprites at once in a clean `2×3` grid on `#FFFFFF` (like [`neora_25d_sprites_sheet_1792121379114.jpg`](file:///Users/thanapat/.gemini/antigravity/brain/753bcef0-ad37-414d-acee-dceff4909f18/neora_25d_sprites_sheet_1792121379114.jpg)), add the sheet entry to [`scripts/art_sheets.json`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/scripts/art_sheets.json), and run `node scripts/process_art_assets.js` to slice and matte all cells in one shot!

---

## 3. 🌿 Category 1 — Ground, Lawn, Road & Edge Transition Tiles (19 Assets)

### 3.1 Summary Table & Autotiling Rules

- **Grass-on-Stone Overhang Rule**: Always paint soft clusters of grass blades (`#82A74A`, `#B9C54F`) and tiny white/pink wildflowers **overlapping the outer edge of the stone curb by `6–14px`** to integrate roads organically into the meadow.
- **Calm Mortar Under Characters Rule**: Interior cobblestone mortar lines MUST be **warm, wide, and low-contrast (`#BC9C65`)** — never dark brown/black (`#3A2415` or `#000000`) inside the walkable road bed — so Chibi boots and dark pets like **Nyx** pop cleanly.
- **Curb Line Alignment Invariant**: On every `256×256` edge/corner transition tile, the **raised sandstone curb strip** occupies the exact band between **`42%` and `55%` (`108px–140px`)** from the grass edge toward the road edge so straight edges, outer `90°` corners, and inner corners lock together seamlessly.

| # | Asset ID | Pack / Folder | Size (`px`) | Format | Purpose |
| :-: | :--- | :---: | :---: | :---: | :--- |
| 1 | `tile_grass_meadow_a` | `terrain` | `512×512` | Opaque Seamless | Primary sunlit meadow grass tile (~70% of terrain). |
| 2 | `tile_grass_meadow_b` | `terrain` | `512×512` | Opaque Seamless | Secondary lush clover/moss tuft grass variant. |
| 3 | `tile_grass_sunlit_c` | `terrain` | `512×512` | Opaque Seamless | Sun-drenched golden clearing grass with micro-daisies (Master Kit Row 1.1). |
| 4 | `decal_grass_clover_a` | `village` | `256×256` | Alpha Decal | Ground-hugging 3-leaf clover & soft grass blade cluster. |
| 5 | `decal_grass_daisies_b` | `village` | `256×256` | Alpha Decal | White 5-petal meadow daisies & pastel pink blossom scatter. |
| 6 | `decal_grass_blossom_c` | `village` | `256×256` | Alpha Decal | Fallen sakura petals & golden buttercup florets scatter. |
| 7 | `road_cobble` | `terrain` | `512×512` | Opaque Seamless | Primary staggered rounded honey-sandstone cobblestone road. |
| 8 | `road_sakura` | `terrain` | `512×512` | Opaque Seamless | Pastel rose-quartz & blush sandstone cobble road with fallen petals. |
| 9 | `road_cream` | `terrain` | `512×512` | Opaque Seamless | Royal warm ivory & buttermilk limestone cobble courtyard road. |
| 10 | `ground_classic` | `terrain` | `512×512` | Opaque Seamless | Default Sunlit Golden Meadow biome skin. |
| 11 | `ground_sakura` | `terrain` | `512×512` | Opaque Seamless | Spring Blossom biome skin (pastel spring-mint grass + pink petals). |
| 12 | `ground_vanilla` | `terrain` | `512×512` | Opaque Seamless | Cozy Cream/Pistachio pastel meadow biome skin. |
| 13 | `ground_aurora` | `terrain` | `512×512` | Opaque Seamless | Enchanted Celadon-Teal & Starlight Lavender meadow biome skin. |
| 14 | `tile_edge_cobble_straight` | `village` | `256×256` | Modular Transition | Straight cobble road edge + raised cream-stone curb + grass/flower overhang (Master Kit Row 1.2). |
| 15 | `tile_edge_cobble_corner_outer` | `village` | `256×256` | Modular Transition | Outer 90° convex curved cobble corner + stone curb + grass/daisies (Master Kit Row 1.3). |
| 16 | `tile_edge_cobble_corner_inner` | `village` | `256×256` | Modular Transition | Inner 90° concave cobble corner cradling a flowering corner bush pocket (Master Kit Row 1.3). |
| 17 | `tile_plaza_cobble_medallion_4way` | `village` | `512×512` | Hero Plaza Tile | 4-way cobble intersection with circular center flowerbed medallion (Master Kit Row 1.4). |
| 18 | `decal_path_stepping_stones` | `village` | `256×256` | Alpha Decal | 6–7 organic oval 2.5D sandstone stepping stones with grass tufts (Master Kit Row 1.5). |
| 19 | `decal_soil_flowerbed_patch` | `village` | `256×256` | Alpha Decal | Warm terracotta-cocoa garden soil patch ringed by grass blades & sprouts. |

### 3.2 Piece-by-Piece Prompts — Ground & Path Tiles

1. **`tile_grass_meadow_a` (`512×512`, `terrain/tile_grass_meadow_a.png`)**
   > `Seamless 512x512 2D game terrain texture tile of cozy sunlit meadow grass, orthodontic 2.5D top-down oblique view. Hand-painted gouache clusters of soft grass blades in warm mid yellow-green (#B9C54F) with gentle sunlit chartreuse highlights (#DED957) and soft olive-moss shadow pockets (#82A74A). Smooth painterly transitions, low visual frequency so characters stand out clearly on top, zero hard black outlines inside the tile, edges wrap seamlessly on X and Y axes. Style: 2.5D cozy storybook fantasy game art (Neora World V2), hand-painted Ghibli-inspired gouache texture, warm golden-hour top-left lighting.`

2. **`tile_grass_meadow_b` (`512×512`, `terrain/tile_grass_meadow_b.png`)**
   > `Seamless 512x512 2D game terrain texture tile of cozy meadow grass variation B, 2.5D top-down oblique view. Hand-painted soft clover patches and lush rounded grass tuft brushstrokes in warm meadow green (#B9C54F) and mossy shadow green (#82A74A) with subtle golden-green highlights (#DED957). Matches edges strictly to #B9C54F base tone for seamless blending with tile_grass_meadow_a. Soft storybook gouache finish, no dark outlines.`

3. **`tile_grass_sunlit_c` (`512×512`, `terrain/tile_grass_sunlit_c.png`)**
   > `Seamless 512x512 2D game terrain texture tile of a sunlit meadow clearing, 2.5D top-down oblique view. Warm glowing golden-yellow grass center (#F1E562 and #DED957) softly radiating outward into mid meadow green (#B9C54F) and olive-moss edges (#82A74A), sprinkled with 5 to 7 tiny hand-painted 5-petal white wildflowers with golden centers. Soft gouache brushstroke tufts, seamless border edges.`

4. **`decal_grass_clover_a` (`256×256`, `village/decal_grass_clover_a.png`, isolate on `#FFFFFF`)**
   > `Isolated 256x256 2.5D game ground decal on a solid pure white (#FFFFFF) background: a cozy hand-painted cluster of rounded green three-leaf clovers and soft grass tufts in #B9C54F and #82A74A with sunlit #DED957 tips and delicate warm umber (#3A2415) outer ink accents. Flat ground-hugging perspective, centered with 24px white padding on all sides.`

5. **`decal_grass_daisies_b` (`256×256`, `village/decal_grass_daisies_b.png`, isolate on `#FFFFFF`)**
   > `Isolated 256x256 2.5D game ground decal on a solid pure white (#FFFFFF) background: a charming storybook cluster of small white 5-petal meadow daisies with warm yellow centers (#F1E562) and two tiny pastel rose-pink blossoms (#F7A8B8) nestled in a bed of soft green grass tufts (#82A74A, #B9C54F). Delicate #3A2415 ink linework, cozy gouache shading, centered with generous white padding.`

6. **`decal_grass_blossom_c` (`256×256`, `village/decal_grass_blossom_c.png`, isolate on `#FFFFFF`)**
   > `Isolated 256x256 2.5D game ground decal on a solid pure white (#FFFFFF) background: a compact cluster of pastel cherry blossom petals (#F9B8C6, #FFEBF0), tiny golden buttercup florets (#F1E562), and delicate clover leaves resting flat on a small tuft of meadow grass (#82A74A). Hand-painted storybook style with #3A2415 ink line accents.`

7. **`road_cobble` (`512×512`, `terrain/road_cobble.png`)**
   > `Seamless 512x512 2D game texture tile of a cozy rounded sandstone cobblestone road, 2.5D top-down oblique view. Organic staggered running-bond rounded-rectangular and oval flagstones in 5 warm sunlit tones (#FBD9A7, #F8CF95, #F4C78E, #E9C088, #CEA978) separated by low-contrast warm sandy-taupe mortar lines (#BC9C65). Subtle creamy top-left bevel highlights on each stone, no harsh black outlines between inner stones, calm flat surface for character sprites to walk on, 4-way seamless tiling.`

8. **`road_sakura` (`512×512`, `terrain/road_sakura.png`)**
   > `Seamless 512x512 2D game texture tile of a cozy pastel rose-sandstone cobblestone path, 2.5D top-down oblique view. Smooth rounded interlocking stones in warm blush and rose-cream tones (#FCE4E8, #F7CED7, #EBB8C4, #DF9FB0) with soft rose-taupe mortar (#C98A9B) and a few tiny fallen pink sakura petals tucked into mortar crevices. Low internal contrast, seamless 4-way repeat.`

9. **`road_cream` (`512×512`, `terrain/road_cream.png`)**
   > `Seamless 512x512 2D game texture tile of an elegant sunlit cream limestone cobblestone courtyard, 2.5D top-down oblique view. Smooth rounded rectangular flagstones in warm ivory, buttermilk, and oatmeal tones (#FFF6E5, #FBEAD1, #F2DEC0, #E6CCA8) with soft bisque mortar lines (#CBB08C). Gentle gouache brushwork, calm low-contrast surface, 4-way seamless tiling.`

10. **`ground_classic` (`512×512`, `terrain/ground_classic.png`)**
    > `Seamless 512x512 2D game ground skin texture (ground_classic), 2.5D cozy storybook meadow. Warm golden-green grass (#B9C54F base, #DED957 sunlit patches, #82A74A soft moss shadows) with subtle hand-painted blade tufts and occasional tiny white clover dots. Calm low-frequency gouache finish, 4-way seamless.`

11. **`ground_sakura` (`512×512`, `terrain/ground_sakura.png`)**
    > `Seamless 512x512 2D game ground skin texture (ground_sakura), 2.5D cozy storybook spring meadow. Fresh pastel spring-green grass (#B8D46B base, #E5EC9B sunlit highlights, #84AE56 soft shadows) lightly dusted with tiny fallen pastel pink cherry blossom petals (#F9B8C6, #FFEBF0). Soft gouache brushstrokes, calm low-contrast surface, 4-way seamless.`

12. **`ground_vanilla` (`512×512`, `terrain/ground_vanilla.png`)**
    > `Seamless 512x512 2D game ground skin texture (ground_vanilla), 2.5D cozy storybook pastel meadow. Soft creamy pistachio and sage-lime grass (#C2D168 base, #DCE384 warm light, #FAF3C0 buttercream sun dabs, #92B055 gentle shadow) with tiny cream-white chamomile buds. Dreamy storybook gouache texture, 4-way seamless.`

13. **`ground_aurora` (`512×512`, `terrain/ground_aurora.png`)**
    > `Seamless 512x512 2D game ground skin texture (ground_aurora), 2.5D cozy storybook enchanted twilight meadow. Soft celadon-jade and teal-green grass (#56B3A8 base, #7ED6C1 luminous mint light, #3B8788 deep teal moss shadow) with tiny glowing pastel aqua (#B8F2E6) and soft lavender (#D4B8FF) star-florets. Calm painterly texture, 4-way seamless.`

14. **`tile_edge_cobble_straight` (`256×256`, `village/tile_edge_cobble_straight.png`)**
    > `256x256 2D game modular path transition tile (straight edge), 2.5D top-down oblique view. Bottom half is seamless warm sandstone cobblestone road (#F8CF95, #F4C78E, #E9C088 with #BC9C65 mortar). Across the middle (y: 108..140px) runs a raised chiseled cream-sandstone curb border (#F9DFB5 top, #D4AC76 side bevel, #3A2415 outer ink line). Top half is lush meadow grass (#B9C54F, #82A74A) with soft grass tufts and tiny white/pink wildflowers organically overhanging and overlapping the outer edge of the stone curb. Left and right edges align seamlessly with adjacent straight edge tiles.`

15. **`tile_edge_cobble_corner_outer` (`256×256`, `village/tile_edge_cobble_corner_outer.png`)**
    > `256x256 2D game modular path transition tile (outer 90-degree convex corner), 2.5D top-down oblique view. A smooth 90-degree curved sandstone cobblestone road quadrant (#F8CF95, #F4C78E, #BC9C65 mortar) with radially fanned cobbles bordered on its outer convex arc by a raised chiseled sandstone curb (#F9DFB5) and lush meadow grass (#B9C54F, #82A74A) with overhanging grass blades and tiny white daisies. Warm #3A2415 ink linework on the curb edge, seamless connection points at bottom and left tile midpoints.`

16. **`tile_edge_cobble_corner_inner` (`256×256`, `village/tile_edge_cobble_corner_inner.png`)**
    > `256x256 2D game modular path transition tile (inner 90-degree concave corner), 2.5D top-down oblique view. Most of the tile is warm sandstone cobblestone road (#F8CF95, #F4C78E, #BC9C65 mortar) wrapping around a tight 90-degree inner corner in the top-left quadrant, bordered by a curved raised sandstone curb (#F9DFB5) and filled with a cozy lush tuft of meadow grass (#82A74A, #B9C54F) and pastel pink/white wildflowers overhanging the curb. Warm #3A2415 ink linework on curb and foliage.`

17. **`tile_plaza_cobble_medallion_4way` (`512×512`, `village/tile_plaza_cobble_medallion_4way.png`)**
    > `512x512 2.5D game hero path tile: a 4-way sandstone cobblestone plaza intersection with a circular raised cream-stone curb ring in the center containing a lush rounded bed of meadow grass (#B9C54F, #82A74A) and blooming pink and white storybook flowers. Concentric rings of warm sandstone cobblestones (#FBD9A7, #F8CF95, #F4C78E, #E9C088) with calm #BC9C65 mortar radiate around the central garden medallion and branch into four orthogonal paths bordered by raised sandstone curbs (#F9DFB5) and grassy corners. Clean #3A2415 ink outlines on curbs and flowers.`

18. **`decal_path_stepping_stones` (`256×256`, `village/decal_path_stepping_stones.png`, isolate on `#FFFFFF`)**
    > `Isolated 256x256 2.5D game ground decal on a solid pure white (#FFFFFF) background: a charming cohesive cluster of 6 flat, rounded oval sandstone stepping stones in warm golden-peach and buff tones (#FBD9A7, #F8CF95, #E9C088) with visible 2.5D front thickness (#D4AC76) and warm #3A2415 ink outlines, connected by lush tufts of soft meadow grass (#82A74A, #B9C54F) and tiny white daisies sprouting between and around the stones.`

19. **`decal_soil_flowerbed_patch` (`256×256`, `village/decal_soil_flowerbed_patch.png`, isolate on `#FFFFFF`)**
    > `Isolated 256x256 2.5D game ground decal on a solid pure white (#FFFFFF) background: an organic rounded garden soil patch of warm cozy terracotta-cocoa earth (#9E7356 light center, #825B40 mid soil, #66452F soft inner edge shadow) ringed by overlapping lush green grass tufts (#B9C54F, #82A74A) and 3 tiny white/pink sprout blossoms along the rim. Warm #3A2415 ink line accents on the outer grass tufts.`

---

## 4. 🌊 Category 2 — Water, River Banks, Bridges & Floating Sky-Island Cliffs (22 Assets)

### 4.1 Summary Table

| # | Asset ID | Pack | Size (`px`) | Anchor | Purpose |
| :-: | :--- | :---: | :---: | :---: | :--- |
| 20 | `water_canal` | `terrain` | `256×256` | `(0.5, 0.5)` | Seamless cerulean-aqua water surface texture with diagonal sunlit caustics. |
| 21 | `river_bank_straight` | `village` | `256×256` | `(0.5, 0.5)` | Straight riverbank transition: overhanging grass/flowers + mossy boulders + white foam line. |
| 22 | `river_bank_corner_outer` | `village` | `256×256` | `(0.5, 0.5)` | 90° outer convex riverbank corner with mossy stones & foam collar. |
| 23 | `river_bank_corner_inner` | `village` | `256×256` | `(0.5, 0.5)` | 90° inner concave riverbank bend with nestled boulders & wildflowers. |
| 24 | `decal_water_lily_white` | `village` | `128×128` | `(0.5, 0.5)` | Floating green lily pads + blooming creamy-white water lily + ripple ring. |
| 25 | `decal_water_lotus_pink` | `village` | `128×128` | `(0.5, 0.5)` | Floating lily pads + glowing pastel rose-pink lotus blossom + bud. |
| 26 | `decal_water_ripples` | `village` | `128×128` | `(0.5, 0.5)` | Crisp white/cyan S-curve current streaks, oval ripples & 4-point sparkles. |
| 27 | `env_river_boulders_a` | `village` | `192×160` | `(0.5, 0.0)` | Large 3-rock mossy river boulder cluster with white water-foam collar. |
| 28 | `env_river_boulders_b` | `village` | `128×128` | `(0.5, 0.0)` | Medium emerging mossy river stone + wet pebble + ripple ring. |
| 29 | `env_river_cattails` | `village` | `128×160` | `(0.5, 0.0)` | Aquatic green reed fan + 3 velvety brown cattail spikes + base ripple. |
| 30 | `bridge_stone_deck` | `village` | `256×256` | `(0.5, 0.5)` | Cambered warm cream-and-honey flagstone bridge roadway deck + side arch fascia. |
| 31 | `env_bridge_parapet_side` | `village` | `256×192` | `(0.5, 0.0)` | Carved cream-stone low bridge parapet wall with scroll panels & end-pillars (Master Kit 2.1). |
| 32 | `env_bridge_pillar_cap` | `village` | `128×192` | `(0.5, 0.0)` | Square carved cream-stone terminal bridge pillar with spherical stone finial cap. |
| 33 | `bridge_wood_deck` | `village` | `256×256` | `(0.5, 0.5)` | Cozy honey-cedar plank footbridge module with timber posts & double handrails. |
| 34 | `bridge_rainbow_arch` | `village` | `512×384` | `(0.5, 0.0)` | Couple Zone centerpiece: cream-stone arch bridge with heart cutouts & pastel rainbow pavers. |
| 35 | `dec_love_pavilion` | `village` | `512×512` | `(0.5, 0.0)` | Couple Love Pavilion: fluted cream-stone columns, pink tiled canopy, golden heart crest & rose vines. |
| 36 | `cliff_grass_lip_strip` | `village` | `256×96` | `(0.5, 0.25)` | Horizontally tileable overhanging scalloped meadow-grass rim for floating islands (Master Kit 2.3). |
| 37 | `cliff_side_strata_strip` | `village` | `256×384` | `(0.5, 0.0)` | Horizontally tileable chiseled terracotta & rock cliff wall for Village & Sky Monopoly (Master Kit 2.3). |
| 38 | `cliff_waterfall_strip` | `village` | `256×384` | `(0.5, 0.08)` | Cascading cerulean waterfall spilling over mossy cliff shoulders (Master Kit 2.4). |
| 39 | `env_waterfall_mist` | `village` | `256×160` | `(0.5, 0.5)` | Billowing scalloped white-and-aqua cloud-foam collar at waterfall base (Master Kit 2.4). |
| 40 | `env_cloud_fluffy_a` | `village` | `512×320` | `(0.5, 0.5)` | Large billowing golden-hour cumulus sky cloud (`#FFF9F2` crown, `#FAD8C6` peach mid, `#7E6266` plum ink). |
| 41 | `env_cloud_fluffy_b` | `village` | `320×160` | `(0.5, 0.5)` | Medium flat-bottomed drifting storybook sky cloud for parallax layers. |

### 4.2 Piece-by-Piece Prompts — Water, River, Bridges & Cliffs

20. **`water_canal` (`256×256`, `terrain/water_canal.png`)**
    > `Seamless tileable 2.5D cozy storybook game water texture, vibrant cerulean and turquoise-aqua river surface (#2A94C8 to #73D7F7), hand-painted Ghibli-meets-Tree-of-Savior style, soft diagonal sunlit caustic ribbons in pale cyan (#B8F0FF), delicate crisp white water sparkles (#F0FCFF), no shoreline, no rocks, no dark brown outlines, seamless edge-to-edge tiling on all 4 sides, flat uniform lighting, 256x256.`

21. **`river_bank_straight` (`256×256`, `village/river_bank_straight.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric modular straight riverbank edge strip on a solid pure white (#FFFFFF) background. Upper half shows lush scalloped green meadow grass (#74BD43, #A8DC5A) dotted with tiny white daisies and pastel pink wildflowers overhanging chunky rounded grey-taupe river boulders (#847B6E) with velvety green moss caps. Lower edge of boulders meets a crisp scalloped white-and-aqua water foam collar (#F0FCFF, #73D7F7). Crisp warm dark espresso-brown outlines (#3A2415), top-left golden sunlight, seamless left-to-right horizontal continuity.`

22. **`river_bank_corner_outer` (`256×256`, `village/river_bank_corner_outer.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric 90-degree outer convex corner riverbank module on a solid pure white (#FFFFFF) background. A rounded grassy promontory (#74BD43) with tiny white and pink wildflowers curves around a cluster of mossy grey-brown river stones (#847B6E, #A8DC5A moss) with a crisp white-and-aqua water-foam collar (#F0FCFF) at the base. Warm dark brown linework (#3A2415), matches river_bank_straight seam endpoints.`

23. **`river_bank_corner_inner` (`256×256`, `village/river_bank_corner_inner.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric 90-degree inner concave corner riverbank module on a solid pure white (#FFFFFF) background. Lush green meadow grass (#74BD43) wraps two sides of an inner river bend, stepped down with mossy rounded river boulders (#847B6E), tiny white/pink flowers, and a white-and-aqua water-foam edge (#F0FCFF). Warm dark brown linework (#3A2415), matches river_bank_straight seam endpoints.`

24. **`decal_water_lily_white` (`128×128`, `village/decal_water_lily_white.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook floating water lily decal on a solid pure white (#FFFFFF) background. Two overlapping notched round green lily pads (#74BD43, #42822B shadow) floating flat in 35-degree perspective, topped with one full-bloom creamy-white multi-petal water lily (#FFFDF5) with a warm golden-yellow center (#F7C844), rimmed by a subtle aqua-and-white water ripple border (#73D7F7). Warm dark brown outline (#3A2415).`

25. **`decal_water_lotus_pink` (`128×128`, `village/decal_water_lotus_pink.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook floating pink lotus decal on a solid pure white (#FFFFFF) background. Three overlapping notched green lily pads (#74BD43) in 35-degree isometric perspective with a glowing pastel rose-pink lotus blossom (#FF9EBB to #FFE6EE petal tips, #FFD147 center) and one small unopened pink bud. Crisp warm dark brown ink outlines (#3A2415).`

26. **`decal_water_ripples` (`128×128`, `village/decal_water_ripples.png`)**
    > `2.5D cozy storybook water surface ripple and sparkle decal on transparent background. Crisp hand-drawn S-curve water current lines, oval ripple rings, and tiny 4-point star sparkles in pure white (#F0FCFF) and pale cyan (#B8F0FF), foreshortened at a 35-degree isometric angle. Zero dark outlines, clean alpha transparency.`

27. **`env_river_boulders_a` (`192×160`, `village/env_river_boulders_a.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric river boulder cluster on a solid pure white (#FFFFFF) background. Three overlapping chunky, softly faceted grey-taupe boulders (#847B6E, #A39B8B) capped with thick cushiony bright-green moss (#74BD43, #A8DC5A) and tiny white wildflowers. The flat bottom base is rimmed with a crisp aqua-and-white water foam collar (#73D7F7, #F0FCFF). Crisp warm dark espresso-brown outlines (#3A2415), top-left sunlight.`

28. **`env_river_boulders_b` (`128×128`, `village/env_river_boulders_b.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric small emerging river rocks on a solid pure white (#FFFFFF) background. One medium rounded grey-brown stone (#847B6E) with a patch of lush green moss (#74BD43) on its crown, paired with a smaller smooth wet pebble beside it, encircled at the base by a turquoise-and-white water ripple collar (#73D7F7, #F0FCFF). Warm dark brown linework (#3A2415).`

29. **`env_river_cattails` (`128×160`, `village/env_river_cattails.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric river cattails and reed clump on a solid pure white (#FFFFFF) background. Graceful fan of sword-like green aquatic reed blades (#74BD43, #42822B) with three velvety warm-brown cylindrical cattail spikes (#7A4B2A, #A66A46 highlight) emerging from a small mossy river stone and aqua water-ripple base. Crisp warm dark brown outlines (#3A2415).`

30. **`bridge_stone_deck` (`256×256`, `village/bridge_stone_deck.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric stone bridge deck module on a solid pure white (#FFFFFF) background. Gently cambered paving of warm golden-cream rounded rectangular flagstones (#F5E6D0, #E5CEB1, #C9AD8D mortar bevels) bordered by raised cream-stone curb beams along the left and right edges, with a visible low carved stone arch side-fascia. Crisp warm dark brown ink outlines (#3A2415), top-left golden lighting.`

31. **`env_bridge_parapet_side` (`256×192`, `village/env_bridge_parapet_side.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric carved cream-stone bridge parapet balustrade section on a solid pure white (#FFFFFF) background (matching Sprites Sheet bottom-left). Gently arched low cream-limestone wall (#F5E6D0 top coping, #DFC5A5 body, #B59676 recessed relief) flanked by two square carved stone end-pillars topped with smooth round stone sphere finials, featuring recessed rectangular panels with classical scroll carvings and warm dark brown outlines (#3A2415).`

32. **`env_bridge_pillar_cap` (`128×192`, `village/env_bridge_pillar_cap.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric cream-stone bridge terminal pillar on a solid pure white (#FFFFFF) background. Sturdy square cream-sandstone column (#F5E6D0, #DFC5A5) with molded base plinth, recessed vertical side panel (#B59676), cornice cap, and a smooth round cream-stone sphere finial resting on top, with tiny grass and flower tufts at the foot. Crisp warm dark espresso-brown outlines (#3A2415).`

33. **`bridge_wood_deck` (`256×256`, `village/bridge_wood_deck.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric wooden plank footbridge on a solid pure white (#FFFFFF) background. Warm honey-cedar transverse wood planks (#DCA064 highlight, #BA783C base, #8C5220 wood grain & side fascia) supported by timber stringers, flanked by sturdy square wooden corner posts and double horizontal timber handrails. Crisp warm dark espresso-brown outlines (#3A2415), golden-hour lighting.`

34. **`bridge_rainbow_arch` (`512×384`, `village/bridge_rainbow_arch.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric romantic Rainbow Heart Arch Bridge on a solid pure white (#FFFFFF) background, in the exact art style of Neora World V2 (#3A2415 warm dark brown outlines, cream sandstone #F5E6D0 and pastel palette). A gracefully arched cream-stone footbridge with four square terminal pillars topped with pastel-pink heart finials (#FF9EBB) and glowing golden streetlamps. The arched stone parapets feature carved heart cutouts, and the flagstone walkway transitions smoothly through soft pastel rainbow hues (rose pink #FFB5C8, peach #FFD4B2, buttercup #FFF0A8, mint #B8F2C8, sky aqua #A8E4FF, lavender #D8C2FF).`

35. **`dec_love_pavilion` (`512×512`, `village/dec_love_pavilion.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric romantic Love Pavilion gazebo on a solid pure white (#FFFFFF) background, matching the classical cream-stone pavilion in Neora World V2. Stepped cream-marble base (#F5E6D0, #DFC5A5) with a glowing aqua-blue heart-shaped fountain basin in the center, four fluted cream-stone columns supporting a sculpted pediment and pastel rose-pink tiled canopy (#FF9EBB, #E07A98) crowned with a golden heart emblem (#FFD147). Climbing pink cherry-blossom and rose vines (#74BD43, #FFB5C8) wrap the columns and base bushes. Crisp warm dark espresso-brown outlines (#3A2415).`

36. **`cliff_grass_lip_strip` (`256×96`, `village/cliff_grass_lip_strip.png`, isolate on `#FFFFFF`)**
    > `Seamless horizontal tiling 2.5D cozy storybook overhanging grass cliff lip strip on a solid pure white (#FFFFFF) background. Thick, puffy scalloped edge of lush meadow turf (#9CD654 top highlight, #6BB33B mid body, #3B7024 lower overhanging fringe) with tiny white/pink wildflower specks and a warm dark brown jagged bottom contour (#3A2415). Seamless left-to-right tileability.`

37. **`cliff_side_strata_strip` (`256×384`, `village/cliff_side_strata_strip.png`, isolate on `#FFFFFF`)**
    > `Seamless horizontal tiling 2.5D cozy storybook floating island cliff wall strip on a solid pure white (#FFFFFF) background (matching Master Kit 2.3). Chiseled, faceted vertical rock and terracotta-ochre earthen strata (#C98C64 sunlit clay ledges, #A66A46 mid ochre-brown rock, #7D4B2F deep vertical crevice shadows, and #8C7A70 cool stone facets) capped at the top with a lush overhanging scalloped green grass lip (#74BD43), tapering slightly inward toward a natural broken-rock bottom silhouette. Crisp warm dark espresso-brown hand-inked outlines (#3A2415). Seamless left-to-right tiling.`

38. **`cliff_waterfall_strip` (`256×384`, `village/cliff_waterfall_strip.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook isometric waterfall cliff module on a solid pure white (#FFFFFF) background (matching Master Kit item 2.4). A vibrant cerulean-aqua river channel (#48B8E8, #5CD0F5) spills over a notched mossy cliff lip (#847B6E wet stone, #74BD43 overhanging grass tufts on left and right shoulders) into a vertical cascading curtain of streaked turquoise water (#38A7DC) and crisp white foam ribbons (#D6F6FF, #F0FCFF) terminating in a billowing frothy cloud-foam collar at the base. Warm dark brown outlines (#3A2415) on flanking rock/grass, water-blue outlines (#1B6E9A) on waterfall.`

39. **`env_waterfall_mist` (`256×160`, `village/env_waterfall_mist.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook waterfall base mist and foam cloud collar on a solid pure white (#FFFFFF) background. Billowing, scalloped U-shaped cushion of frothy creamy-white water foam (#F5FDFF) with soft pastel-aqua undersides (#CBE9F7, #73D7F7) and rising water droplets, drawn with crisp cyan-blue outlines (#1B6E9A).`

40. **`env_cloud_fluffy_a` (`512×320`, `village/env_cloud_fluffy_a.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook large fluffy cumulus sky cloud on a solid pure white (#FFFFFF) background, matching neora_25d_design_language. Voluminous, rounded scalloped puffs with warm creamy-ivory sunlit tops (#FFF9F2), soft golden-peach midtones (#FAD8C6), and gentle lavender-rose underside shadows (#D6C2DA), inked with crisp muted plum-brown outlines (#7E6266).`

41. **`env_cloud_fluffy_b` (`320×160`, `village/env_cloud_fluffy_b.png`, isolate on `#FFFFFF`)**
    > `2.5D cozy storybook drifting sky cloud on a solid pure white (#FFFFFF) background. Flat-bottomed, three-puff storybook cloud with warm creamy-ivory top (#FFF9F2), warm pastel peach belly (#FAD8C6), and soft lavender base line (#D6C2DA), outlined in crisp muted plum-brown (#7E6266).`

---

## 5. 🌳 Category 3 — 2.5D Trees, Bushes, Fences, Lamps & 20 Placeable Decorations (43 Assets)

### 5.1 (A) 2.5D Trees (7 Assets — `512×640 px`, Anchor `(0.5, 0)`)

| # | Asset ID | Name | Footprint | Visual Hook |
| :-: | :--- | :--- | :---: | :--- |
| 42 | `env_tree_oak_a` | **Lush Meadow Oak Tree (Full Crown)** | `1×1` | Broad 5-clump scalloped canopy (`#d9e650` → `#285826`), warm brown trunk, 3 white daisies at roots. |
| 43 | `env_tree_oak_b` | **Twin-Bough Meadow Oak Tree** | `1×1` | Asymmetrical Y-forked trunk with 3 bouncy foliage puffs & pink/white root wildflowers. |
| 44 | `env_tree_sakura_a` | **Blooming Sakura Cherry Tree (Grand)** | `1×1` | Full cloud-like pastel pink blossom canopy (`#fff0f5` → `#b54e6b`), cherry-wood trunk & fallen petals. |
| 45 | `env_tree_sakura_b` | **Breezy Winding Sakura Tree** | `1×1` | Graceful curved trunk leaning right, 3 layered cotton-candy blossom tiers & drifting petals. |
| 46 | `env_pine` | **Cozy Alpine Evergreen Pine** | `1×1` | 4 stacked scalloped conical tiers of chartreuse-to-spruce needles, short trunk & tiny daisies. |
| 47 | `env_tree_fruit_apple` | **Honeycrisp Apple Orchard Tree** | `1×1` | Lush oak canopy dotted with 9 glossy ruby-red apples (`#e63946`) with gold highlights & 1 fallen apple. |
| 48 | `env_tree_golden_maple` | **Sunlit Golden Autumn Maple** | `1×1` | 4-tier sunburst-gold to tangerine-amber & cinnamon-rust canopy with fallen golden leaves at roots. |

#### Ready-to-Use Prompts — (A) 2.5D Trees

42. **`env_tree_oak_a`**
    > `2.5D cozy storybook game sprite of a lush meadow oak tree, isometric 30-degree top-down view, hand-painted gouache illustration style matching Klaipeda fairytale village. Bold warm dark sepia ink outlines (#3a2415). Plump overlapping scalloped cloud-like leaf clusters shaded in 4 distinct gouache tiers: sunlit golden-lime crown on top-left (#d9e650), vibrant meadow green midtone (#82c341), rich forest green shadow (#488e35), and deep emerald underside on bottom-right (#285826). Sturdy warm honey-brown tree trunk (#8b5a2b) with organic vertical bark linework and flaring roots, grounded with tiny green grass tufts and three small white five-petal daisies at the bottom-right root base. Warm top-left golden-hour sunlight, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile rectangle, no text.`

43. **`env_tree_oak_b`**
    > `2.5D cozy storybook game sprite of a charming twin-bough meadow oak tree, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Asymmetrical Y-shaped warm brown wooden trunk (#8b5a2b) supporting three distinct, bouncy scalloped foliage puffs shaded in 4 gouache tiers from top-left golden-chartreuse highlight (#d9e650) through meadow green (#82c341) to deep forest green bottom-right shadow (#285826). Base of the trunk is tucked into lush little grass blades and two tiny pastel pink and white wildflowers. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

44. **`env_tree_sakura_a`**
    > `2.5D cozy storybook game sprite of a full blooming sakura cherry blossom tree, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Billowy, scalloped cloud-like blossom canopy shaded in 4 gouache tiers: pale blush-cream top-left sunlit crown (#fff0f5), soft cotton-candy pink midtone (#ffb5c9), warm rose shadow (#e67f9b), and deep berry-mauve bottom-right underside (#b54e6b), accented with tiny 5-petal cherry blossom silhouettes inside the puffs. Graceful warm reddish-brown timber trunk (#7a4930) with flared roots, surrounded by fallen petals on tiny green grass tufts at the base. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

45. **`env_tree_sakura_b`**
    > `2.5D cozy storybook game sprite of a breezy curved sakura blossom tree, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A gently curving warm brown trunk (#7a4930) branching into three airy, layered tiers of scalloped pink cherry blossom clouds shaded from top-left creamy blush (#fff0f5) and pastel pink (#ffb5c9) to deep rose shadow (#b54e6b) on the bottom-right. Fallen pink petals rest on small grass tufts and a tiny white daisy at the root base. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

46. **`env_pine`**
    > `2.5D cozy storybook game sprite of a cute fairytale evergreen pine tree, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Conical silhouette formed by four stacked, soft scalloped skirts of pine boughs with rounded tips, shaded in 4 gouache tiers: warm chartreuse-green sunlit top-left edges (#9ad14b), vibrant emerald midtone (#539e3a), deep spruce shadow (#2f6e2e), and dark forest teal underside (#1b4222). Short, sturdy warm brown trunk peeking out at the bottom, nestled in tiny green grass tufts and two small white daisies. Warm top-left golden-hour light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

47. **`env_tree_fruit_apple`**
    > `2.5D cozy storybook game sprite of a lush honeycrisp apple orchard tree, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Full rounded canopy of scalloped gouache leaf clusters shaded from top-left golden-lime (#d9e650) and meadow green (#82c341) to deep forest green shadow (#285826), nestled with 9 plump, glossy ruby-red apples (#e63946) featuring warm golden-orange highlights (#ffb703) and a few tiny white apple blossoms. Warm striated brown oak trunk (#8b5a2b) with rooted base, tiny grass tufts, and one fallen red apple resting beside white daisies at the roots. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

48. **`env_tree_golden_maple`**
    > `2.5D cozy storybook game sprite of a sunlit golden autumn maple tree, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Plump, layered cloud-like foliage clusters with softly scalloped maple-leaf silhouettes along the edges, shaded in 4 rich gouache tiers: glowing sunburst gold on the top-left crown (#ffe156), warm tangerine-amber midtone (#f79d36), cinnamon-rust core shadow (#d95926), and deep claret-brown bottom-right underside (#8f2d19). Warm dark umber trunk (#6e3b1b) with root flare, surrounded by tiny grass tufts and fallen golden-orange maple leaves at the base. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

---

### 5.2 (B) 2.5D Bushes, Hedges & Flower Clusters (8 Assets — `512×512 px`, Anchor `(0.5, 0)`)

| # | Asset ID | Name | Footprint | Visual Hook |
| :-: | :--- | :--- | :---: | :--- |
| 49 | `env_bush_roses_pink` | **Pink Cabbage-Rose Bush Cluster** | `1×1` | Two plump green foliage mounds studded with 8 chunky spiral pastel-pink roses. |
| 50 | `env_bush_daisies_white` | **White Meadow Daisy Bush** | `1×1` | Rounded sunlit shrub dotted with 7 crisp 5-petal white daisies with golden centers. |
| 51 | `env_bush_mixed_large` | **Grand Triple Garden Flower Bush** | `2×2` / `1×1` | Three overlapping bush mounds (Sprites Sheet top-center) mixing pink roses & white daisies. |
| 52 | `env_bush_hydrangea_blue` | **Pastel Blue & Lavender Hydrangea Bush** | `1×1` | Emerald shrub topped with 6 fluffy spherical puffballs of sky-blue & lilac florets. |
| 53 | `env_hedge_boxwood_straight` | **Trimmed Topiary Boxwood Hedge (Straight)** | `1×1` | Rectangular isometric hedge block (`26.57°`) with scalloped leaves & base daisies. |
| 54 | `env_hedge_boxwood_corner` | **Trimmed Topiary Boxwood Hedge (L-Corner)** | `1×1` | 90° isometric L-corner manicured hedge with pink/white corner blossoms. |
| 55 | `env_flowerbed_planter` | **Timber-Framed Cozy Flowerbed Planter** | `1×1` | Low honey-oak & cream-stone planter box overflowing with roses, daisies & buttercups. |
| 56 | `env_sunflower_clump` | **Radiant Golden Sunflower Clump** | `1×1` | Cluster of 5 cheerful tall sunflowers with brown quilted seed centers & broad green leaves. |

#### Ready-to-Use Prompts — (B) 2.5D Bushes, Hedges & Flower Clusters

49. **`env_bush_roses_pink`**
    > `2.5D cozy storybook game sprite of a blooming pink rose bush cluster, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Two overlapping plump, scalloped green foliage mounds shaded in 4 gouache tiers from top-left golden-lime (#d9e650) and meadow green (#82c341) to deep forest green bottom-right shadow (#285826). Adorned with 8 chunky, readable pastel-pink cabbage roses (#ff9ebb) featuring warm rose spiral centers (#d9536f) and soft cream highlights. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

50. **`env_bush_daisies_white`**
    > `2.5D cozy storybook game sprite of a cheerful white daisy bush, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Plump rounded shrub with scalloped cloud-like leaf puffs shaded in 4 gouache tiers from top-left golden-lime (#d9e650) to deep emerald underside (#285826), generously dotted with 7 crisp five-petal white daisies (#fffdf7) with warm golden-amber button centers (#f5a623) and tiny yellow buds. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

51. **`env_bush_mixed_large`**
    > `2.5D cozy storybook game sprite of a lush triple-mound garden flower bush cluster, isometric 30-degree top-down view, hand-painted gouache illustration style matching Klaipeda village reference. Bold warm dark sepia ink outlines (#3a2415). Three overlapping round scalloped green bush mounds shaded in 4 gouache tiers (top-left golden-lime #d9e650, mid meadow green #82c341, shadow forest green #488e35, underside #285826). The left and rear mounds bloom with plump pastel-pink spiral roses (#ff9ebb), while the front-right mound blooms with crisp five-petal white daisies (#fffdf7) with golden centers. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

52. **`env_bush_hydrangea_blue`**
    > `2.5D cozy storybook game sprite of a pastel blue and lavender hydrangea bush, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Lush rounded shrub of deep emerald scalloped leaves (#488e35 to #285826) crowned with 6 large, fluffy spherical blossom clusters made of tiny four-petal florets shaded in powder blue (#b8e2ff), cornflower blue (#73b3f5), and soft periwinkle-lilac (#9b8bf4). Tiny grass tufts at the base. Warm top-left golden-hour light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

53. **`env_hedge_boxwood_straight`**
    > `2.5D cozy storybook game sprite of a manicured straight boxwood hedge segment, aligned to a 2:1 isometric axis (26.57 degrees), 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A neat, plush rectangular topiary hedge with softly scalloped leafy edges, shaded in 4 gouache tiers: bright golden-lime top face (#d9e650), sunlit meadow-green front-left face (#82c341), and rich forest-green shaded front-right face (#3b7a2e). Dotted along the bottom ground edge with tiny grass tufts and three miniature white daisies. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

54. **`env_hedge_boxwood_corner`**
    > `2.5D cozy storybook game sprite of an L-shaped 90-degree isometric corner boxwood hedge, aligned to 2:1 isometric axes, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Manicured plush topiary corner hedge with rounded scalloped leaf puffs, shaded in 4 gouache tiers with a sunlit golden-lime top surface (#d9e650), meadow-green left outer wall (#82c341), and deep emerald-green right shaded wall (#285826). Accented at the base corner with a small cluster of pink roses and white daisies. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

55. **`env_flowerbed_planter`**
    > `2.5D cozy storybook game sprite of a low isometric wooden and stone flowerbed planter box, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A low rectangular planter framed by warm honey-oak timber planks (#c67d3b) and small cream limestone corner caps (#ead6bc), overflowing with a dense, cheerful mound of scalloped green leaves, pastel pink spiral roses, white five-petal daisies, and sunny yellow buttercups. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

56. **`env_sunflower_clump`**
    > `2.5D cozy storybook game sprite of a cheerful clump of golden sunflowers, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Five plump, sturdy sunflowers of varying heights with broad, scalloped emerald-green leaves at the base, big warm chocolate-brown quilted seed centers (#5c3818), and rings of vibrant golden-yellow petals (#ffd13b to #f59c1a) tilted toward the top-left sun, surrounded by tiny white daisies and grass tufts at the roots. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

---

### 5.3 (C) 2.5D Fences, Walls & Gates (4 Assets — `512×512 px`, Anchor `(0.5, 0)`)

| # | Asset ID | Name | Footprint | Visual Hook |
| :-: | :--- | :--- | :---: | :--- |
| 57 | `env_fence_wood_stone_straight` | **Stone-Pillar & Oak-Rail Fence (Straight)** | `1×1` | 2 carved cream stone pillars + 2 horizontal honey-oak rails + center post (Sprites Sheet bottom-center). |
| 58 | `env_fence_wood_stone_corner` | **Stone-Pillar & Oak-Rail Fence (L-Corner)** | `1×1` | 3 cream stone pillars forming a 90° isometric corner with twin wooden rails (Master Kit Row 3.4). |
| 59 | `env_fence_wood_stone_gate` | **Cozy Arched Garden Gate & Stone Pillars** | `1×1` | 2 sphere-capped cream stone pillars flanking an arched double honey-oak picket gate with rose vine. |
| 60 | `env_wall_stone_low` | **Carved Cream Limestone Balustrade Wall** | `1×1` | Low cream stone wall with scroll relief panels & spherical ball finials (Sprites Sheet bottom-left). |

#### Ready-to-Use Prompts — (C) 2.5D Fences, Walls & Gates

57. **`env_fence_wood_stone_straight`**
    > `2.5D cozy storybook game sprite of a straight stone-pillar and wooden-rail fence segment, aligned to a 2:1 isometric axis (bottom-left to top-right), 30-degree top-down view, hand-painted gouache illustration style matching Klaipeda village reference. Bold warm dark sepia ink outlines (#3a2415). Two sturdy square cream-limestone end pillars (#f3e5d0 beveled cap, #ead6bc sunlit face, #c2a887 shaded face) with recessed vertical panel grooves, connected by two horizontal warm honey-oak wooden rails (#c67d3b lit, #965622 shaded) and a single vertical wooden center post. Tiny green grass tufts and miniature white/pink flowers hug the base of the stone pillars. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

58. **`env_fence_wood_stone_corner`**
    > `2.5D cozy storybook game sprite of an L-shaped 90-degree isometric corner fence made of cream stone pillars and honey-oak rails, 30-degree top-down view, hand-painted gouache illustration style matching Master Kit Row 3 (4). Bold warm dark sepia ink outlines (#3a2415). Three square beveled cream-limestone pillars (#f3e5d0 cap, #ead6bc lit side, #c2a887 shadow side) positioned at the two ends and the front corner vertex, linked by two horizontal warm honey-oak timber rails (#c67d3b) and middle wooden posts on each wing. Small tufts of green grass and tiny white daisies at the pillar bases. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

59. **`env_fence_wood_stone_gate`**
    > `2.5D cozy storybook game sprite of a charming arched wooden garden gate between two cream limestone pillars, aligned to a 2:1 isometric axis, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Two square cream-stone pillars (#f3e5d0) topped with smooth spherical stone finials, framing a low double-leaf honey-oak wooden picket gate (#c67d3b) with a gentle scalloped arch top, dark wrought-iron hinges, and a heart-shaped latch. Draped on one pillar with a small cluster of pink roses and green leaves. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

60. **`env_wall_stone_low`**
    > `2.5D cozy storybook game sprite of a low carved cream limestone balustrade wall, aligned to a 2:1 isometric axis (bottom-left to top-right), 30-degree top-down view, hand-painted gouache illustration style matching Sprites Sheet bottom-left reference. Bold warm dark sepia ink outlines (#3a2415). Two square cream-stone end pedestals topped with smooth round stone ball finials (#fbf0df highlight, #ead6bc midtone, #c2a887 shadow), connected by a gently curved low stone parapet wall featuring recessed decorative floral-scroll relief carvings. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

---

### 5.4 (D) 2.5D Streetlamps & Signposts (4 Assets — `384×640 px` or `512×512 px`, Anchor `(0.5, 0)`)

| # | Asset ID | Name | Footprint | Visual Hook |
| :-: | :--- | :--- | :---: | :--- |
| 61 | `env_streetlamp_iron` | **Classic Wrought-Iron & Stone Streetlamp** | `1×1` | Cream stone pedestal base, dark bronze post, glowing 4-pane golden-amber lantern (Sprites Sheet top-right). |
| 62 | `env_streetlamp_double` | **Twin-Arm Boulevard Floral Streetlamp** | `1×1` | Scrolled double-arm iron post on stone plinth with 2 hanging amber lanterns & flower baskets. |
| 63 | `env_string_lights_post` | **Cozy Wooden Festoon String-Light Post** | `1×1` | Honey-oak post in octagonal daisy planter with golden fairy bulb cords & hanging lantern. |
| 64 | `env_signpost` | **Fairytale Wooden Crossroads Signpost** | `1×1` | Chamfered oak post with 3 icon arrow boards, hanging brass lantern & base roses/daisies. |

#### Ready-to-Use Prompts — (D) 2.5D Streetlamps & Signposts

61. **`env_streetlamp_iron`**
    > `2.5D cozy storybook game sprite of a classic fairytale streetlamp, isometric 30-degree top-down view, hand-painted gouache illustration style matching Sprites Sheet top-right reference. Bold warm dark sepia ink outlines (#3a2415). A sturdy square cream-limestone pedestal base (#fbf0df top bevel, #ead6bc lit left face, #c2a887 shaded right face) with recessed panel trim, supporting a cylindrical dark bronze wrought-iron post (#4c3c33 with warm metallic highlight #7d6858) and a four-sided glass lantern housing at the top. The lantern glows warmly from within with a bright buttery-yellow core (#fff7b8) transitioning to golden-amber edges (#ffa826) and a soft warm halo. Bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

62. **`env_streetlamp_double`**
    > `2.5D cozy storybook game sprite of an ornate twin-arm boulevard streetlamp, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Beveled cream-limestone pedestal base (#ead6bc) with tiny pink roses at its foot, rising into a fluted dark bronze-iron post (#4c3c33) that splits at the top into two graceful S-scrolled iron arms. Two warm glowing golden-amber glass lanterns (#fff7b8 to #ffa826) hang from the arms, with two small hanging moss baskets blooming with trailing pink blossoms just below the crossbar. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

63. **`env_string_lights_post`**
    > `2.5D cozy storybook game sprite of a cozy festival string-light timber post, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A warm honey-oak wooden post (#b36a2e) anchored in a low octagonal cream-stone planter base brimming with white daisies and green leaves. Near the top, a horizontal wooden peg arm holds a glowing warm-amber lantern and festive draped cords of glowing golden fairy bulbs (#ffe875) wrapped around the upper post with a pastel pink ribbon bow. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

64. **`env_signpost`**
    > `2.5D cozy storybook game sprite of a fairytale wooden crossroads signpost, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A sturdy chamfered honey-oak wooden post (#c67d3b) with a peaked cap, featuring three angled wooden directional arrow signs pointing along isometric axes, painted with cute miniature icons (a pink heart, a crown, and a teacup, no text). A small warm-glowing brass lantern hangs from a curved iron hook near the top, and the base is nestled in lush green grass tufts, pink roses, and white daisies. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

---

### 5.5 (E) Placeable Decor Props — Existing 8 + 12 NEW Cozy Decor Props (20 Assets)

| # | Asset ID | Name | Status | Size (`w×h`) | Canvas (`px`) | Gameplay Buff (`catalog_landmarks.js`) |
| :-: | :--- | :--- | :---: | :---: | :---: | :--- |
| 65 | `dec_swing` | **Sakura Couple Swing-Bench** | Existing | `2×2` | `640×640` | `buff: { goldPct: 2 }, seats: 2` (`+2% Gold/hr`) |
| 66 | `dec_picnic` | **Strawberry Tart Picnic Mat** | Existing | `2×2` | `640×640` | `buff: { berriesPct: 2 }, seats: 3` (`+2% Berries/hr`) |
| 67 | `dec_gramophone` | **Golden Gramophone Jukebox** | Existing | `1×1` | `512×512` | `buff: { petMoodPct: 2 }` (`+2% Pet Mood • BGM`) |
| 68 | `dec_tent` | **Starlight Glamping Tent & Campfire** | Existing | `2×2` | `640×640` | `buff: { storagePct: 5 }` (`+5% Storage Cap`) |
| 69 | `dec_cat_cushion` | **Giant Cat-Paw Cushion & Tree** | Existing | `1×1` | `512×512` | `buff: { traitLuckPct: 3 }` (`+3% Trait Luck`) |
| 70 | `dec_balloon_cart` | **Cotton-Candy Balloon Cart** | Existing | `1×1` | `512×512` | `buff: { swiftnessPct: 2 }` (`+2% Swiftness`) |
| 71 | `dec_mushroom_ring` | **Glowing Fairy Mushroom Ring** | Existing | `1×1` | `512×512` | `buff: { fortunePct: 2 }` (`+2% Fortune`) |
| 72 | `dec_birdbath_lamp` | **Rose-Gold Birdbath & Streetlamp** | Existing | `1×1` | `512×512` | `buff: { luckPct: 2 }` (`+2% Luck`) |
| 73 | `dec_wooden_bench` | **Cozy Carved Park Bench** | **NEW** | `2×1` | `512×512` | `buff: { goldPct: 1, petMoodPct: 1 }, seats: 2` |
| 74 | `dec_flower_cart` | **Pastel Blossom Wheel-Cart** | **NEW** | `2×1` | `512×512` | `buff: { berriesPct: 2 }` (`+2% Star-Berries/hr`) |
| 75 | `dec_boba_stand` | **Strawberry-Cat Boba Tea Cart** | **NEW** | `2×2` | `640×640` | `buff: { goldPct: 2, swiftnessPct: 1 }` |
| 76 | `dec_wishing_well` | **Fairytale Stone Wishing Well** | **NEW** | `2×2` | `640×640` | `buff: { luckPct: 3 }` (`+3% Luck`) |
| 77 | `dec_honey_beehive` | **Golden Meadow Honey Beehive** | **NEW** | `1×1` | `512×512` | `buff: { berriesPct: 3 }` (`+3% Star-Berries/hr`) |
| 78 | `dec_cat_bakery_sign` | **Croissant-Cat Bakery Sandwich Board** | **NEW** | `1×1` | `512×512` | `buff: { goldPct: 2 }` (`+2% Village Gold/hr`) |
| 79 | `dec_couple_hammock` | **Blossom-Draped Couple Hammock** | **NEW** | `2×2` | `640×640` | `buff: { petMoodPct: 3 }, seats: 2` (`+3% Pet Mood`) |
| 80 | `dec_koi_barrel_pond` | **Mini Oak-Barrel Lotus & Koi Pond** | **NEW** | `1×1` | `512×512` | `buff: { fortunePct: 2, luckPct: 1 }` |
| 81 | `dec_painter_easel` | **Sunlit Storybook Painter's Easel** | **NEW** | `1×1` | `512×512` | `buff: { traitLuckPct: 2 }` (`+2% Trait Luck`) |
| 82 | `dec_berry_wheelbarrow` | **Star-Berry Harvest Wheelbarrow** | **NEW** | `1×1` | `512×512` | `buff: { storagePct: 3 }` (`+3% Storage Cap`) |
| 83 | `dec_starlight_telescope` | **Brass Starlight Stargazer Telescope** | **NEW** | `1×1` | `512×512` | `buff: { fortunePct: 3 }` (`+3% Fortune`) |
| 84 | `dec_owl_mailbox` | **Sleepy Owl Postbox & Parcel Stack** | **NEW** | `1×1` | `512×512` | `buff: { swiftnessPct: 2 }` (`+2% Swiftness`) |

#### Ready-to-Use Prompts — (E) 20 Placeable Decor Props

65. **`dec_swing` (`640×640`, `village/dec_swing.png`)**
    > `2.5D cozy storybook game sprite of a Sakura Couple Swing-Bench (matching the center-plaza swing in the Klaipeda fairytale village reference), 2x2 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). Sturdy A-frame pergola frame built from warm honey-oak beams (#c67d3b lit, #8a4f1d shaded), suspending a cozy two-seater slatted wooden bench seat from dark iron chains. The top crossbeam and side posts are lushly draped with blooming pastel-pink sakura blossom garlands (#ffb5c9) and trailing green ivy. Grounded at the four post feet with small clusters of scalloped green bushes, pink roses, and white daisies. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

66. **`dec_picnic` (`640×640`, `village/dec_picnic.png`)**
    > `2.5D cozy storybook game sprite of a Strawberry Tart Picnic Mat, 2x2 isometric diamond footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A plush pastel pink-and-cream gingham picnic blanket laid out at an isometric angle with fringed edges, topped with a woven wicker picnic basket with open lids, a ceramic plate holding a glossy ruby-red strawberry cream tart, two porcelain teacups on saucers, and two plump heart-shaped pastel cushions for sitting. Framed at the corners by tiny tufts of green grass and white daisies. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

67. **`dec_gramophone` (`512×512`, `village/dec_gramophone.png`)**
    > `2.5D cozy storybook game sprite of a vintage Golden Gramophone Jukebox (matching the center-plaza gramophone in the Klaipeda fairytale village reference), 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A two-tiered carved mahogany wooden cabinet pedestal (#854621 lit, #5c2d12 shaded) with brass crank and recessed panels, topped with a spinning dark vinyl record and an oversized, scalloped antique brass morning-glory horn (#f7c648 sunlit rim, #c78419 shaded interior) facing forward-left. The base of the wooden cabinet is nestled in a small ring of green leaves, pink roses, and white daisies. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

68. **`dec_tent` (`640×640`, `village/dec_tent.png`)**
    > `2.5D cozy storybook game sprite of a Starlight Glamping Tent and cozy campfire, 2x2 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A plump bell-style cream canvas glamping tent (#fbf0df) with pastel pink-and-gold scalloped trim, tied-back entrance flaps revealing a plush rose pillow inside, and a string of glowing golden star-shaped fairy lights draped across the wooden ridge pole. In front of the tent sits a small ring of river stones holding a crackling, warm-glowing golden-amber campfire (#ffae2b) beside a wooden log stool. Grounded with tiny grass tufts and daisies. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

69. **`dec_cat_cushion` (`512×512`, `village/dec_cat_cushion.png`)**
    > `2.5D cozy storybook game sprite of a Giant Cat-Paw Cushion and wooden cat tree, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). An oversized, ultra-plump cream plush floor cushion shaped like a chubby cat paw with soft strawberry-pink toe-bean pads (#ff9ebb), paired at the back with a natural honey-wood scratching post wrapped in sisal rope and topped with a dangling golden star toy and a pastel pink ribbon bow. Tiny grass tufts and white daisies at the base rim. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

70. **`dec_balloon_cart` (`512×512`, `village/dec_balloon_cart.png`)**
    > `2.5D cozy storybook game sprite of a whimsical Cotton-Candy Balloon Cart, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A vintage two-wheeled cream-and-pink wooden vendor cart with gold spoked wheels and a scalloped pastel pink-and-white striped canopy, displaying fluffy pink and sky-blue cotton candy cones on a brass rack. Tied to the side post is a joyful bouquet of five glossy floating balloons (pastel pink, buttercup yellow, baby blue, and a heart-shaped rose balloon). Warm top-left golden-hour light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

71. **`dec_mushroom_ring` (`512×512`, `village/dec_mushroom_ring.png`)**
    > `2.5D cozy storybook game sprite of a Glowing Fairy Mushroom Ring, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). An enchanting circular ring of 7 plump fairytale toadstools of varying sizes with cream stems and spotted caps in strawberry-rose (#ff758f), warm amber-gold (#ffc43d), and pastel lilac, with soft golden bioluminescent gills glowing underneath (#fff3a1). In the center of the mossy ring bloom tiny white daisies, lush scalloped fern leaves, and floating golden sparkles. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

72. **`dec_birdbath_lamp` (`512×512`, `village/dec_birdbath_lamp.png`)**
    > `2.5D cozy storybook game sprite of a Rose-Gold Birdbath and integrated Streetlamp, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A carved cream-limestone and rose-gold basin pedestal filled with sparkling crystal-blue water (#66c7f4) where a tiny chubby white songbird perches on the scalloped rim. Rising from the rear of the stone pedestal is a slender rose-gold iron lamppost holding a warm glowing amber glass lantern (#fff7b8) and a trailing garland of pink roses. Tiny flowers and grass tufts hug the base. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

73. **`dec_wooden_bench` (`512×512`, `village/dec_wooden_bench.png`)**
    > `2.5D cozy storybook game sprite of a Cozy Carved Park Bench, aligned to a 2:1 isometric axis (facing bottom-left), 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A charming two-seater park bench crafted from warm honey-oak wooden slats (#c67d3b lit, #8f4e1c shaded) with a heart cutout in the center backrest and scrolled dark wrought-iron armrests (#4c3c33). A folded pastel-pink plaid throw blanket and a small cream cushion rest on one end, while small clusters of pink roses and white daisies grow around the iron legs. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

74. **`dec_flower_cart` (`512×512`, `village/dec_flower_cart.png`)**
    > `2.5D cozy storybook game sprite of a Pastel Blossom Wheel-Cart, isometric 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A rustic whitewashed-wood and honey-timber two-wheeled florist cart with large spoked wooden wheels and a cute pink-and-cream striped fabric awning. The tiered wooden display trays overflow with terracotta pots and woven baskets bursting with pink cabbage roses, white daisies, blue hydrangeas, and golden sunflowers, plus a small copper watering can resting by the wheel. Warm top-left golden-hour light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

75. **`dec_boba_stand` (`640×640`, `village/dec_boba_stand.png`)**
    > `2.5D cozy storybook game sprite of a miniature Strawberry-Cat Boba Tea Stand (inspired by the cat-and-strawberry cafe in the Klaipeda village reference), 2x2 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A compact, ultra-cute wooden kiosk cart with a scalloped pink-and-cream striped awning topped by a chubby smiling cream cat mascot head and a glossy red strawberry ornament. The counter displays a miniature transparent boba cup with brown tapioca pearls and a pink straw, a jar of pastel macarons, and a tiny wooden chalkboard menu. Surrounded at the base by small flower bushes. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

76. **`dec_wishing_well` (`640×640`, `village/dec_wishing_well.png`)**
    > `2.5D cozy storybook game sprite of a Fairytale Stone Wishing Well, 2x2 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A circular well built from warm cream-and-sandstone cobbles (#ead6bc) filled with glowing crystal-aqua water (#5bc8f5) and golden coin glints. Two honey-oak timber posts support a charming peaked pastel-pink shingle roof crowned with brass finials, a wooden crank winch with rope, and a hanging oak bucket overflowing with pink blossoms. Lush scalloped green bushes, pink roses, and white daisies wrap around the stone base. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

77. **`dec_honey_beehive` (`512×512`, `village/dec_honey_beehive.png`)**
    > `2.5D cozy storybook game sprite of a Golden Meadow Honey Beehive, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A plump, woven golden-straw skep beehive (#f2bd41 lit, #b87b1e shaded) perched on a low honey-oak wooden stand, dripping with glossy amber honey around the round entrance hole. Beside the stand sits a corked glass honey jar tied with a pink gingham ribbon and two cute chubby round bumblebees with translucent wings hovering near a base cluster of white daisies, yellow buttercups, and lavender sprigs. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

78. **`dec_cat_bakery_sign` (`512×512`, `village/dec_cat_bakery_sign.png`)**
    > `2.5D cozy storybook game sprite of a Croissant-Cat Bakery Sandwich Board sign, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). An A-frame honey-oak wooden easel board topped with cat-ear silhouettes and a miniature chef's hat. The dark slate chalkboard face displays a hand-painted illustration of a golden flaky croissant and a steaming teacup (no text). Beside the easel sits a woven wicker basket brimming with warm golden baguettes and strawberry danishes, nestled in tiny green grass tufts and pink roses. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

79. **`dec_couple_hammock` (`640×640`, `village/dec_couple_hammock.png`)**
    > `2.5D cozy storybook game sprite of a Blossom-Draped Couple Hammock, 2x2 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A curved crescent honey-oak timber hammock stand anchored between two miniature blooming sakura shrubs, suspending a wide, quilted cream-and-pastel-pink woven hammock with fringed tassels, two plump heart-shaped throw pillows, and a string of glowing warm-gold fairy lights draped overhead. Fallen sakura petals, white daisies, and lush grass tufts cushion the base. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

80. **`dec_koi_barrel_pond` (`512×512`, `village/dec_koi_barrel_pond.png`)**
    > `2.5D cozy storybook game sprite of a Mini Oak-Barrel Lotus and Koi Pond, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A wide half-barrel planter made of warm honey-oak staves (#b36a2e) bound with dark bronze hoops, filled to the brim with clear turquoise water (#58c4f6) featuring soft white surface ripples. Inside swim two cute calico-orange-and-white koi fish beside two round green lily pads, a blooming pastel-pink lotus flower, and a miniature bamboo water-spout fountain on the rim. Mossy stones and white daisies hug the barrel base. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

81. **`dec_painter_easel` (`512×512`, `village/dec_painter_easel.png`)**
    > `2.5D cozy storybook game sprite of a Sunlit Storybook Painter's Easel, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A tripod honey-oak wooden easel holding a stretched canvas painted with a cute miniature scene of the pink fairytale castle and sunset clouds. Clipped to the easel tray is a wooden palette dabbed with vibrant gouache paints, accompanied by a round wooden stool, a mason jar of water holding paintbrushes, and a small blooming rose bush at the base. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

82. **`dec_berry_wheelbarrow` (`512×512`, `village/dec_berry_wheelbarrow.png`)**
    > `2.5D cozy storybook game sprite of a Star-Berry Harvest Wheelbarrow, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A charming vintage wooden wheelbarrow painted in pastel cream and honey-oak with a brass-rimmed front wheel, heaped high with plump, glossy ruby-red strawberries and glowing golden star-shaped berries nestled in lush green leaves and white strawberry blossoms. A pastel-pink gingham cloth drapes over the side rail, with tiny grass tufts and daisies around the wheel and legs. Warm top-left golden-hour light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

83. **`dec_starlight_telescope` (`512×512`, `village/dec_starlight_telescope.png`)**
    > `2.5D cozy storybook game sprite of a Brass Starlight Stargazer Telescope, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). An ornate polished brass-and-rose-gold refractor telescope (#f5bd41 lit, #b8791a shaded) with a sapphire-blue glass lens and decorative celestial star engravings, mounted on a sturdy mahogany wooden tripod with brass fittings. At the base of the tripod sits a small stack of leather-bound astronomy books, a rolled parchment star map, a glowing amber glass lantern, and tiny white meadow daisies. Warm top-left golden-hour lighting, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

84. **`dec_owl_mailbox` (`512×512`, `village/dec_owl_mailbox.png`)**
    > `2.5D cozy storybook game sprite of a Sleepy Owl Postbox and Parcel Stack, 1x1 isometric footprint, 30-degree top-down view, hand-painted gouache illustration style. Bold warm dark sepia ink outlines (#3a2415). A whimsical wooden mailbox shaped like a cottage house painted in pastel strawberry-pink and cream (#ffb5c9 / #fbf0df) with a brass mail slot and a raised red heart flag, mounted on a honey-oak post. Perched on the peaked roof is a chubby, sleepy plush-feathered barn owl wearing a tiny postman's cap, while two paper-wrapped parcels tied with twine and wax-sealed love letters rest among pink roses and white daisies at the stone base. Warm top-left golden light, bottom-center anchor, isolated on a pure solid white background (#FFFFFF), no ground tile, no text.`

---

## 6. 🏰 Category 4 — 2.5D Landmarks, VIP Wonders & 4 New Village Buildings (15 Assets)

### 6.1 Mandatory Building Rules (`0.82×` Scale & Integrated Courtyard Base)
1. **NO Flat Green Oval Cutouts!**: Never generate a flat lime-green oval disc, plastic sticker pedestal, or hard square turf slab under a building.
2. **Integrated Courtyard Garden Base**: Every building sprite **MUST** sit on a low chiseled cream-sandstone curb (`#e6cbb0`) and warm flagstone apron (`#edd5b8`) with a welcoming front step/carpet, flanked by **tucked pink/white/yellow flower bushes** and **low wooden/stone-pillar garden fences** around the base perimeter over a solid `#FFFFFF` background.
3. **`0.82×` Width-Per-Tile Scale**:
   - `2×2` Tiles (`512×512 px` canvas) → `bld_shrine`, `bld_nest`, `bld_flower_greenhouse`, `bld_owl_post_office`, `bld_starlight_lighthouse`
   - `3×2` Tiles (`640×512 px` canvas) → `bld_dock`
   - `3×3` Tiles (`768×768 px` canvas) → `bld_mint`, `bld_patisserie`, `wnd_onsen`, `wnd_fountain`, `bld_windmill_bakery`
   - `4×4` Tiles (`1024×1024 px` canvas) → `bld_castle`, `wnd_ferris`, `wnd_casino_dome`, `wnd_world_tree`

### 6.2 Piece-by-Piece Prompts — 6 Core Landmarks, 5 VIP Wonders & 4 New Buildings

85. **`bld_castle` — Grand Starlight Castle (`4×4`, `1024×1024 px`, `village/bld_castle.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Grand Starlight Castle (bld_castle) in 3/4 isometric view, occupying 82% width of a 1024x1024 canvas on a solid pure #FFFFFF white background. Warm cream-sandstone masonry walls with crenelated battlements, central tall rose-pink conical spire flanked by two sky-blue and two pastel-pink cylindrical corner turrets, each topped with fluttering golden pennants. Arched oak double-door entrance on the front-left facade with a plush red carpet runner stepping down onto an integrated warm sandstone cobblestone courtyard apron. A glowing vintage iron streetlamp stands left of the gate. Lush dark-green bushes blooming with pink, white, and yellow flowers plus low stone-pillar wooden fences are tucked tightly around the castle base corners—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, soft golden-hour cel-shaded painterly textures, Tree of Savior meets Ghibli storybook aesthetic.`

86. **`bld_mint` — Royal Gold Waterwheel Mint (`3×3`, `768×768 px`, `village/bld_mint.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Royal Gold Waterwheel Mint (bld_mint) in 3/4 isometric view, occupying 82% width of a 768x768 canvas on a solid pure #FFFFFF white background. Charming medieval half-timbered stone and oak-beam mill house with warm shingled gable roof, dormer window, and a gleaming gold coin emblem above the door. A large detailed wooden waterwheel on the front-left stone millrace splashes sparkling sky-blue water and white foam into a stone basin. Integrated base of warm sandstone cobbles, low rustic timber fence, and tucked bushes with pink and white blossoms—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

87. **`bld_shrine` — Goddess Vakarine Shrine (`2×2`, `512×512 px`, `village/bld_shrine.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Goddess Vakarine Shrine (bld_shrine) in 3/4 isometric view, occupying 82% width of a 512x512 canvas on a solid pure #FFFFFF white background. Elegant cream-marble classical open temple pavilion with four fluted columns supporting a carved triangular pediment roof. In the center stands a graceful white marble winged angel goddess statue atop a circular basin filled with glowing sky-blue crystal water. Integrated courtyard base with stepped marble plinth, warm sandstone cobblestones, low white-and-wood corner fences, a glowing vintage streetlamp, and tucked bushes full of pink, yellow, and white flowers—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

88. **`bld_patisserie` — Cat Boba Patisserie (`3×3`, `768×768 px`, `village/bld_patisserie.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Cat Boba Patisserie (bld_patisserie) in 3/4 isometric view, occupying 82% width of a 768x768 canvas on a solid pure #FFFFFF white background. Cozy cream cottage bakery with a pastel pink-and-white striped scalloped roof awning, crowned by a giant cute smiling cream tabby cat head with a curled striped tail on the roof and a glossy red strawberry floating above its ear. Pastel pink arched door with stone steps, small window with mini striped awning and wooden A-frame chalkboard menu on the left, and a giant transparent boba milk tea cup with tapioca pearls and pink straw on the right. Integrated warm sandstone cobble apron, low wooden garden fence, and tucked pink/white flowering bushes around the base—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

89. **`bld_nest` — Cozy Pet Nest & Sanctuary (`2×2`, `512×512 px`, `village/bld_nest.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Cozy Pet Nest & Sanctuary (bld_nest) in 3/4 isometric view, occupying 82% width of a 512x512 canvas on a solid pure #FFFFFF white background. Whimsical fairytale pet sanctuary built into a warm carved oak tree-house cottage with a soft moss-and-pastel-shingle roof, featuring a cozy woven golden-straw rooftop nest cradling two pastel speckled pet eggs with a gentle starlight glow. Below is an arched wooden pet doorway with a plush paw-print cushion, warm hanging lantern, and wooden water bowl. Integrated warm sandstone cobblestone base with low wooden fence posts and tucked pink and white flower bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

90. **`bld_dock` — Starlight Fishing Dock (`3×2`, `640×512 px`, `village/bld_dock.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Starlight Fishing Dock (bld_dock) in 3/4 isometric view, occupying 82% width of a 640x512 canvas on a solid pure #FFFFFF white background. Cozy warm-timber covered boathouse pavilion with a pitched wooden shingle roof, open timber post railings, and a sturdy plank pier extending toward the front-left water edge. Decorated with two warm glowing hanging brass lanterns, bamboo fishing rods, a wooden tackle crate, and a life-ring buoy. Integrated shoreline base with warm sandstone stepping stones, stone curb posts, reeds, and tucked pink/white flower bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

91. **`wnd_onsen` — Capybara Yuzu Hot Spring (`3×3`, `768×768 px`, `village/wnd_onsen.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Capybara Yuzu Hot Spring (wnd_onsen) in 3/4 isometric view, occupying 82% width of a 768x768 canvas on a solid pure #FFFFFF white background. Cozy storybook outdoor hot spring bathhouse with a warm cedar-wood pavilion roof, natural smooth river boulders framing a steaming turquoise-blue mineral water pool, and a bamboo shishi-odoshi water spout. Two adorable relaxed capybaras soak happily in the water with bright yellow yuzu fruits balanced on their heads and floating around them, plus wooden hinoki buckets and warm paper lanterns. Integrated warm sandstone cobble apron with tucked pink sakura and white daisy bushes and low bamboo-and-stone fencing—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

92. **`wnd_ferris` — Couple Heart Ferris Wheel (`4×4`, `1024×1024 px`, `village/wnd_ferris.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Couple Heart Ferris Wheel (wnd_ferris) in 3/4 isometric view, occupying 82% width of a 1024x1024 canvas on a solid pure #FFFFFF white background. Grand romantic fairytale Ferris wheel with a golden-brass outer wheel rim and spokes, a large glossy pastel-pink heart centerpiece at the axle, sturdy pastel-pink A-frame support pillars, and eight cute pastel-pink passenger gondolas each decorated with a raised pink heart emblem. Integrated courtyard base featuring warm sandstone cobblestone boarding steps, low wooden post-and-rail garden fencing, and lush tucked bushes with pink, white, and yellow blossoms around the support footings—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

93. **`wnd_fountain` — Fountain of 1,000 Wishes (`3×3`, `768×768 px`, `village/wnd_fountain.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Fountain of 1,000 Wishes (wnd_fountain) in 3/4 isometric view, occupying 82% width of a 768x768 canvas on a solid pure #FFFFFF white background. Magnificent cream-marble and burnished-gold wishing fountain with a wide sculpted basin, glowing turquoise-blue water with shimmering golden coins visible beneath the ripples, and a central golden winged-chalice spire spouting graceful arcs of sparkling water. Integrated courtyard base of warm circular sandstone cobblestones, low carved stone curb pillars, a warm glowing streetlamp, and tucked bushes blooming with pink, white, and buttercup-yellow flowers—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

94. **`wnd_casino_dome` — Grand Golden Casino Dome (`4×4`, `1024×1024 px`, `village/wnd_casino_dome.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Grand Golden Casino Dome (wnd_casino_dome) in 3/4 isometric view, occupying 82% width of a 1024x1024 canvas on a solid pure #FFFFFF white background. Whimsical Beaux-Arts fairytale palace with cream-sandstone Corinthian columns, a grand gilded golden ribbed dome topped with a shining star-and-clover finial, and an ornate front marquee featuring three golden lucky-7/crown reels and warm glowing festival bulbs. Grand arched entrance with a red velvet carpet cascading down sandstone steps onto an integrated cobblestone courtyard apron, framed by low cream stone balustrades, two warm iron streetlamps, and tucked pink and white flowering bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

95. **`wnd_world_tree` — Golden Starlight World-Tree (`4×4`, `1024×1024 px`, `village/wnd_world_tree.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Golden Starlight World-Tree (wnd_world_tree) in 3/4 isometric view, occupying 82% width of a 1024x1024 canvas on a solid pure #FFFFFF white background. Majestic ancient fairytale World-Tree with thick warm-brown roots and an arched wooden sanctuary doorway with stained-glass window nestled into the trunk base. Massive layered canopy of lush emerald-green and glowing golden-starlight leaves, adorned with hanging crystalline star lanterns and tiny pink blossoms. Integrated courtyard base with curved warm sandstone cobble steps, low carved stone boundary posts, and tucked pink, white, and golden flower bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

96. **`bld_windmill_bakery` — Warm Croissant Windmill Bakery (`3×3` NEW, `768×768 px`, `village/bld_windmill_bakery.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Windmill Bakery (bld_windmill_bakery) in 3/4 isometric view, occupying 82% width of a 768x768 canvas on a solid pure #FFFFFF white background. Charming round cream-sandstone and timber windmill cottage with a pastel terracotta-and-pink conical roof, four large wooden lattice windmill sails with warm cream canvas cloths on the front-left facade, and a giant golden croissant signboard above a glowing bakery display window filled with bread loaves and berry tarts. Flour sacks and a wooden bread cart sit beside the arched oak door. Integrated warm sandstone cobblestone apron, low wooden garden fence, and tucked pink and white flower bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

97. **`bld_flower_greenhouse` — Botanical Glasshouse Conservatory (`2×2` NEW, `512×512 px`, `village/bld_flower_greenhouse.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Flower Greenhouse (bld_flower_greenhouse) in 3/4 isometric view, occupying 82% width of a 512x512 canvas on a solid pure #FFFFFF white background. Cozy fairytale Victorian glasshouse conservatory with a low warm-sandstone brick base wall, cream-painted arched wrought-iron framing, and sparkling sky-tinted glass roof panels with a golden crest finial. Inside the glass and spilling out the open front double doors are lush pastel pink roses, blue hydrangeas, and hanging flower baskets, with a wooden potting table and brass watering can outside. Integrated warm sandstone cobble step apron, low wooden fence, and tucked pink/white flower bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

98. **`bld_owl_post_office` — Messenger Owl Post Office (`2×2` NEW, `512×512 px`, `village/bld_owl_post_office.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Owl Post Office (bld_owl_post_office) in 3/4 isometric view, occupying 82% width of a 512x512 canvas on a solid pure #FFFFFF white background. Whimsical cream-stone and timber cottage with a sky-blue shingled gable roof and a round wooden rooftop owl-loft turret. A cute plump white messenger owl wearing a tiny postman cap perches on the golden weathervane holding a pink wax-sealed envelope in its beak. Front facade features a warm arched oak door, brass horn postal sign, mailbag, and a vintage pastel-red and gold pillar postbox on an integrated warm sandstone cobblestone apron with low fence posts and tucked pink/white flower bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

99. **`bld_starlight_lighthouse` — Starlight Harbor Lighthouse (`2×2` NEW, `512×512 px`, `village/bld_starlight_lighthouse.png`)**
    > `Single isolated 2.5D cozy storybook game building sprite of the Starlight Lighthouse (bld_starlight_lighthouse) in 3/4 isometric view, occupying 82% width of a 512x512 canvas on a solid pure #FFFFFF white background. Charming cylindrical stone lighthouse painted in horizontal warm-cream and pastel-rose-pink bands, with a small cozy timber keeper's entrance porch at the base and a golden brass railed gallery deck at the top. The glass lantern room houses a glowing golden star-shaped crystal beacon beneath a sky-blue conical roof. Integrated warm sandstone cobblestone base with stone bollard posts, coiled rope, and tucked pink and white flowering bushes—NO flat green oval grass cutout. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

---

## 7. 🎲 Category 5 — Sky Monopoly (`8×6` Board) Reuse Architecture & Board Kit (12 Assets)

### 7.1 How the `8×6` Sky Monopoly Board Reuses Our 2.5D Village Assets (`0 KB` Extra Bloat!)
From [`shared/monopoly_rules.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/monopoly_rules.js) (`GRID_COLS: 6, GRID_ROWS: 8`, `BOARD_N: 24` perimeter tiles), the Sky Monopoly board is constructed as a **floating sky-island diorama** that directly reuses the Village 2.5D Master Kit across 4 layers:

1. **Layer 1 — Outer Floating Sky-Island Cliff & Clouds (`cliff_grass_lip_strip` + `cliff_side_strata_strip` + `env_cloud_fluffy_a/b`)**:
   - The `8×6` Monopoly plateau is wrapped around its outer perimeter by the exact same overhanging scalloped grass lip (`cliff_grass_lip_strip`) and chiseled terracotta/rock cliff strata (`cliff_side_strata_strip`), floating among `env_cloud_fluffy_a` and `env_cloud_fluffy_b`.
2. **Layer 2 — Center Courtyard Park, Lagoon & Waterfall (`tile_grass_meadow_a` + `water_canal` + `cliff_waterfall_strip`)**:
   - The interior `6×4` courtyard inside the 24-tile track loop uses `tile_grass_meadow_a` and a crystal `water_canal` stream bordered by `river_bank_straight`, `decal_water_lily_white`, and `env_river_boulders_a`, spilling over the front-right edge of the board via `cliff_waterfall_strip` + `env_waterfall_mist`!
3. **Layer 3 — Center Park 2.5D Foliage, Fences & Scaled Landmarks**:
   - The inner border of the `6×4` courtyard is framed by `env_bush_mixed_large`, `env_fence_wood_stone_straight`, and `env_streetlamp_iron`, while `bld_shrine`, `bld_patisserie`, and `wnd_fountain` sit at `0.55×–0.65×` diorama scale in the park corners around the central dice-rolling lawn.
4. **Layer 4 — 24 Bevelled 2.5D Track Tiles & Miniature Upgrade Tokens**:
   - The 24 perimeter tiles use the 12 dedicated **Sky Monopoly Board & Token Sprites** below (`mono_tile_*` and `mono_house_*`).

### 7.2 Piece-by-Piece Prompts — Sky Monopoly Board Tiles & Upgrade Tokens (12 Assets)

100. **`mono_tile_property_tier1` — Property Board Tile Lv 1 (`256×192 px`, `village/mono_tile_property_tier1.png`)**
     > `Single isolated 2.5D isometric board game tile sprite (mono_tile_property_tier1) in a 2:1 diamond perspective on a 256x192 canvas, solid pure #FFFFFF white background. Thick beveled mint-cream marble slab (#eef5f0 top face, #b8c9be chiseled side thickness) with a raised inner-edge color-zone ribbon band (neutral white/tintable bevel strip) framed by thin #3a2415 dark sepia ink lines, leaving clean cream space in the center and outer edge for property name and gold coin price text. Cozy storybook Monopoly GO meets Tree of Savior aesthetic.`

101. **`mono_tile_property_tier2` — Property Board Tile Lv 2 (`256×192 px`, `village/mono_tile_property_tier2.png`)**
     > `Single isolated 2.5D isometric board game tile sprite (mono_tile_property_tier2) in a 2:1 diamond perspective on a 256x192 canvas, solid pure #FFFFFF white background. Thick beveled warm-cream marble slab with a raised inner-edge color-zone header band rimmed in polished brass-gold molding and two tiny corner star studs, leaving clean center space for property text. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

102. **`mono_tile_property_tier3` — Property Board Tile Lv 3 (`256×192 px`, `village/mono_tile_property_tier3.png`)**
     > `Single isolated 2.5D isometric board game tile sprite (mono_tile_property_tier3) in a 2:1 diamond perspective on a 256x192 canvas, solid pure #FFFFFF white background. Thick beveled ivory-and-gold marble slab with an ornate gilded filigree inner color-zone header band set with three sparkling diamond pips and engraved golden corner flourishes, leaving clean center space for property text. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

103. **`mono_tile_property_tier4` — Property Board Tile Lv 4 Mythic (`256×192 px`, `village/mono_tile_property_tier4.png`)**
     > `Single isolated 2.5D isometric board game tile sprite (mono_tile_property_tier4) in a 2:1 diamond perspective on a 256x192 canvas, solid pure #FFFFFF white background. Radiant royal-gold and pearl-marble isometric board tile with an iridescent rainbow-gold inner header band, glowing starlight runes along the beveled stone rim, and winged golden corner crests. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

104. **`mono_tile_start` — START Corner Tile (`320×256 px`, `village/mono_tile_start.png`)**
     > `Single isolated 2.5D isometric corner board game tile sprite (mono_tile_start) in a 2:1 diamond perspective on a 320x256 canvas, solid pure #FFFFFF white background. Thick beveled cream-and-mint marble corner slab featuring a cute 2.5D sky-blue and white storybook winged airship launchpad emblem poised on a golden compass-star in the center. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

105. **`mono_tile_festival` — Festival / Casino Corner Tile (`320×256 px`, `village/mono_tile_festival.png`)**
     > `Single isolated 2.5D isometric event board game tile sprite (mono_tile_festival) in a 2:1 diamond perspective on a 320x256 canvas, solid pure #FFFFFF white background. Thick beveled cream-marble tile topped with a festive pastel-pink and gold carnival stage emblem featuring a miniature golden lucky prize wheel, colorful bunting flags, and a star-ribbon gift box. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

106. **`mono_tile_portal` — Sky Warp Portal Tile (`320×256 px`, `village/mono_tile_portal.png`)**
     > `Single isolated 2.5D isometric event board game tile sprite (mono_tile_portal) in a 2:1 diamond perspective on a 320x256 canvas, solid pure #FFFFFF white background. Thick beveled cream-marble tile inlaid with a glowing turquoise-and-lavender astral cloud vortex ring framed by two golden angel wings and floating starlight sparkles. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

107. **`mono_tile_tax` — Arena / Royal Vault Toll Tile (`320×256 px`, `village/mono_tile_tax.png`)**
     > `Single isolated 2.5D isometric corner board game tile sprite (mono_tile_tax) in a 2:1 diamond perspective on a 320x256 canvas, solid pure #FFFFFF white background. Thick beveled cream-and-slate marble corner slab featuring two crossed gleaming steel-and-gold storybook broadswords with ruby-hilts over a golden royal shield and treasure coffer emblem in the center. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

108. **`mono_house_lv1` — Tier 1 Cozy Cottage Token (`192×192 px`, `village/mono_house_lv1.png`)**
     > `Single isolated 2.5D miniature board-game house token sprite (mono_house_lv1) in 3/4 isometric view on a 192x192 canvas, solid pure #FFFFFF white background. Cute chunky emerald-green and mint-green Monopoly-style storybook cottage with a pitched roof, tiny chimney, arched front door, and warm glowing window, resting on a thin bevelled base rim. Hand-inked #3a2415 dark sepia outlines, glossy cel-shaded toy-diorama finish.`

109. **`mono_house_lv2` — Tier 2 Storybook Villa Token (`192×192 px`, `village/mono_house_lv2.png`)**
     > `Single isolated 2.5D miniature board-game house token sprite (mono_house_lv2) in 3/4 isometric view on a 192x192 canvas, solid pure #FFFFFF white background. Charming two-story emerald-green and cream-stone storybook villa token with a twin-gable roof, dormer window, tiny pink flower box, and golden door trim. Hand-inked #3a2415 dark sepia outlines, glossy cel-shaded toy-diorama finish.`

110. **`mono_house_lv3` — Tier 3 Golden Grand Hotel Token (`224×224 px`, `village/mono_house_lv3.png`)**
     > `Single isolated 2.5D miniature board-game hotel token sprite (mono_house_lv3) in 3/4 isometric view on a 224x224 canvas, solid pure #FFFFFF white background. Luxurious two-tier burnished-gold and amber-cream grand hotel token with classical arched windows, a stepped penthouse roof, and a tiny golden crown finial. Hand-inked #3a2415 dark sepia outlines, glossy cel-shaded toy-diorama finish.`

111. **`mono_landmark_lv4` — Tier 4 Mythic Sovereign Monument Token (`256×256 px`, `village/mono_landmark_lv4.png`)**
     > `Single isolated 2.5D miniature board-game mythic landmark token sprite (mono_landmark_lv4) in 3/4 isometric view on a 256x256 canvas, solid pure #FFFFFF white background. Miniature fairytale chateau spire encased in a translucent glowing sky-blue crystal-starlight prism cube with golden winged corners and a floating star crest above the turret. Hand-inked #3a2415 dark sepia outlines, warm golden-hour storybook cel-shading.`

---

## 8. 📦 Drop-In Catalog Schema Additions (`shared/catalog_landmarks.js`)

When wiring the **4 New Landmarks (`85–99`)** and **12 New Placeable Decorations (`73–84`)** into [`shared/catalog_landmarks.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/catalog_landmarks.js), add these entries directly:

```js
// --- 4 NEW Village Landmarks (Add to LANDMARKS in shared/catalog_landmarks.js) ---
bld_windmill_bakery: {
  id: 'bld_windmill_bakery', kind: 'landmark', sprite: 'bld_windmill_bakery',
  name: 'Warm Croissant Windmill', emoji: '🥐', w: 3, h: 3,
  unlockCastleLv: 2, buildCostGold: 900,
  produces: 'berries', basePerHour: 35, baseCap: 280,
  effect: 'Produces 🍓 Star-Berries/hr • Unlocks Croissant Buffs'
},
bld_flower_greenhouse: {
  id: 'bld_flower_greenhouse', kind: 'landmark', sprite: 'bld_flower_greenhouse',
  name: 'Botanical Glasshouse', emoji: '🌺', w: 2, h: 2,
  unlockCastleLv: 2, buildCostGold: 750,
  produces: 'berries', basePerHour: 28, baseCap: 220,
  effect: 'Produces 🍓 Star-Berries/hr • +5% Garden Harvest Yield'
},
bld_owl_post_office: {
  id: 'bld_owl_post_office', kind: 'landmark', sprite: 'bld_owl_post_office',
  name: 'Messenger Owl Post', emoji: '🦉', w: 2, h: 2,
  unlockCastleLv: 3, buildCostGold: 1100,
  produces: 'gold', basePerHour: 65, baseCap: 520,
  effect: 'Produces 🪙 Gold/hr • Enables Couple & Guild Gift Parcels'
},
bld_starlight_lighthouse: {
  id: 'bld_starlight_lighthouse', kind: 'landmark', sprite: 'bld_starlight_lighthouse',
  name: 'Starlight Harbor Lighthouse', emoji: '🗼', w: 2, h: 2,
  unlockCastleLv: 3, buildCostGold: 1250,
  produces: 'wishes', basePerHour: 8, baseCap: 64,
  effect: 'Produces 💎 Wishes/hr • +10% Rare Fish & Sky-Ship Luck'
},

// --- 12 NEW Cozy Placeable Decor Props (Add to DECOR in shared/catalog_landmarks.js) ---
dec_wooden_bench:        { kind: 'decor', sprite: 'dec_wooden_bench',        name: 'Cozy Carved Park Bench',       emoji: '🪑', w: 2, h: 1, buff: { goldPct: 1, petMoodPct: 1 }, seats: 2, effect: '+1% Village Gold/hr • +1% Pet Mood' },
dec_flower_cart:         { kind: 'decor', sprite: 'dec_flower_cart',         name: 'Pastel Blossom Wheel-Cart',    emoji: '💐', w: 2, h: 1, buff: { berriesPct: 2 },                      effect: '+2% Star-Berries/hr' },
dec_boba_stand:          { kind: 'decor', sprite: 'dec_boba_stand',          name: 'Strawberry-Cat Boba Stand',    emoji: '🧋', w: 2, h: 2, buff: { goldPct: 2, swiftnessPct: 1 },        effect: '+2% Village Gold/hr • +1% Swiftness' },
dec_wishing_well:        { kind: 'decor', sprite: 'dec_wishing_well',        name: 'Fairytale Stone Wishing Well', emoji: '⛲', w: 2, h: 2, buff: { luckPct: 3 },                         effect: '+3% Luck' },
dec_honey_beehive:       { kind: 'decor', sprite: 'dec_honey_beehive',       name: 'Golden Meadow Honey Beehive',  emoji: '🐝', w: 1, h: 1, buff: { berriesPct: 3 },                      effect: '+3% Star-Berries/hr' },
dec_cat_bakery_sign:     { kind: 'decor', sprite: 'dec_cat_bakery_sign',     name: 'Croissant-Cat Bakery Sign',    emoji: '🥐', w: 1, h: 1, buff: { goldPct: 2 },                         effect: '+2% Village Gold/hr' },
dec_couple_hammock:      { kind: 'decor', sprite: 'dec_couple_hammock',      name: 'Blossom-Draped Couple Hammock',emoji: '🌸', w: 2, h: 2, buff: { petMoodPct: 3 }, seats: 2,            effect: '+3% Pet Mood' },
dec_koi_barrel_pond:     { kind: 'decor', sprite: 'dec_koi_barrel_pond',     name: 'Mini Oak-Barrel Koi Pond',     emoji: '🐟', w: 1, h: 1, buff: { fortunePct: 2, luckPct: 1 },          effect: '+2% Fortune • +1% Luck' },
dec_painter_easel:       { kind: 'decor', sprite: 'dec_painter_easel',       name: 'Sunlit Painter\'s Easel',      emoji: '🎨', w: 1, h: 1, buff: { traitLuckPct: 2 },                    effect: '+2% Pet Trait Roll Luck' },
dec_berry_wheelbarrow:   { kind: 'decor', sprite: 'dec_berry_wheelbarrow',   name: 'Star-Berry Wheelbarrow',       emoji: '🍓', w: 1, h: 1, buff: { storagePct: 3 },                      effect: '+3% Offline Storage Cap' },
dec_starlight_telescope: { kind: 'decor', sprite: 'dec_starlight_telescope', name: 'Brass Starlight Telescope',    emoji: '🔭', w: 1, h: 1, buff: { fortunePct: 3 },                      effect: '+3% Fortune' },
dec_owl_mailbox:         { kind: 'decor', sprite: 'dec_owl_mailbox',         name: 'Sleepy Owl Postbox',           emoji: '📮', w: 1, h: 1, buff: { swiftnessPct: 2 },                    effect: '+2% Swiftness' },
```
