# Master Crafters Combat, Vitality & VFX Studio Patch (`MASTER_CRAFTERS_COMBAT_V2.md`)

> **Status**: Planning Draft (Calibrated to `skill_example.mov` Visual Benchmark)  
> **Inspiration**: *WC3 Master Crafters ORPG* × *Ragnarok Online* × *Tree of Savior / Frieren Cozy 2.5D Magic*

---

## 1. Visual Benchmark Analysis (`skill_example.mov` `00:00` → `00:08`)
Inspecting `skill_example.mov` frame-by-frame defines the **exact 4-Phase Visual Law** our `vfx-pipeline` must hit:
1. **`00:00–00:01` Crisp Sacred-Geometry Cast Seal**: High-res (`1024px`) concentric rings + star polygon + fine runes with a soft mint/pearl outer glow under the Chibi's feet while ambient golden-white motes drift upward—never a blurry low-res circle.
2. **`00:02–00:05` GPU-Instanced Multi-Variant Wave-Bloom (`120–260` Painted Sub-Sprites in 1 Draw Call!)**: Instead of scaling 1 giant blurry PNG decal, a single `THREE.InstancedMesh` scatters **hundreds of crisp hand-painted sub-sprites** (4–6 variants per theme: periwinkle/lavender/buttercup blossoms, cyan/violet crystal clusters, mossy stones & ferns) that **ripple outward radially** (`delay = radius * waveSpeed + jitter`) with spring-pop (`0 → 1.15 → 1.0`), organic ruffled edges, and gentle breeze sway!
3. **`00:03–00:06` Grounded Ankle-Height Readability**: Clusters sit at `y = 0.02..0.26m` so your Chibi stands *nestled inside* the living field—100% sharp, unobstructed, and free to walk around inside her own spell!
4. **`00:07–00:08` Twinkle-Starlight Dissolve**: Instead of a flat alpha fade, staggered shrinking clusters hand off into **shimmering white-violet starlight sparkles & floating petals** before vanishing into the meadow breeze.

---

## 2. Unified `⚔️ Hands & Weapon` (`slot: 'gloves'`) & 15 New Weapons
- **Active Class Rule**: Follows `visibleSlotId(equipped, 'gloves', glamour)` (`Glamour` if set, otherwise `Equipped`). Your 3D held item **always** matches your `1–2–3` attack animation, and swapping Glamour switches classes freely without losing `+10` refined stats.
- **Gathering Tool Separation**: `Pickaxe`, `Axe`, and `Herbalist Staff` (`toolbelt`) are purely for gathering nodes; `ChibiRig` temporarily hides `singleHand` weapons during the 2-second gather swing.
- **+15 New Held Weapons (`97` Total)**:
  - **3 Free Day-1 Starters (`starterCosmetic: true`)**: *Traveler Oak Shortsword (`⚔️`)*, *Woodland Hunter Shortbow (`🏹`)*, *Apprentice Dewdrop Wand (`🪄`)*.
  - **6 Workshop Boss-Crafted Weapons (`bossCraft: true`)**: 3 Meadow (`★2`: *Mossheart Cleaver*, *Thornvine Longbow*, *World-Root Staff*) + 3 Hollow (`★3`: *Prism-Weaver Scythe*, *Starshard Greatbow*, *Astral Spindle Cane*).
  - **6 Sovereign `★3 Mythic` Gacha Weapons**: *Prism-Valkyrie Greatsword (`⚔️`)*, *Bahamut War-Scythe (`⚔️`)*, *Sakura-Phoenix Greatbow (`🏹`)*, *Chronos Arbalest (`🏹`)*, *Eden Peacock Plume-Bow (`🏹`)*, *Atlantis Pearl Trident (`🪄`)*.

---

## 3. Universal 4-Stat Quartet (`🔥 Power · ⚡ Swiftness · 💖 Vitality · 🍀 Luck`)
*(Internal JSON key remains `fortune` for 100% backward compatibility; stale `"Island Defense"` tooltips removed.)*
- **🔥 Power**: All Damage *(Combos + Monster Skills + Ult)*
- **⚡ Swiftness**: Move Speed + Attack Speed + **Skill Cooldown Haste**
- **💖 Vitality**: **+Max HP (`+0..140`) + Heal/Shield Strength + Gather Yield** *(Monopoly: Starting Cash + Rent · Cloud Dash: `💖 Collector`)*
- **🍀 Luck**: **+Crit Chance + Rare Drop / Skill Scroll Rate**

---

## 4. Tinker's Workshop `⚒️ Weapon Forge`
- **Instant Anvil Strike**: Spend `Boss Cores + Refined Ingots/Planks/Crystal Glass + Gold` to roll **2 distinct random stats** + **Grade (`B` 50% · `A` 32% · `S` 14% · `SS Masterwork` 4%)** with **`10-forge` S/SS Pity**.
- **Keep vs Take**: Preserves `+1..+10` Star-Force Refine & Attunement, and **awards `+1 dupe` on every repeat forge** so Boss Weapons can refine all the way to `+10`!

---

## 5. 8 Monster-Dropped Skill Scrolls (`skill_example.mov` Visual Choreography)
- **`2% × rareFindMult`** Field Mob drop · **`10% × rareFindMult`** Boss drop (`12-kill` Boss Scroll Pity). `1 duplicate = +1 Level` up to **`Lv. 5 MAX`** (`5` scrolls total; extras convert to Gold).

| Skill | Source | CD | 4-Phase `skill_example.mov`-Grade Visuals | Gameplay Role |
| :--- | :--- | :---: | :--- | :--- |
| **🌸 Meadow Flower Sanctuary** | Pollen Wisp | `14s` | **Direct `skill_example.mov` tribute!** Mint sacred octagram → radial bloom of **`180→260` periwinkle, lavender & buttercup blossoms** → twinkle-starlight dissolve | `4.4m` Co-Op Heal Field (`💖 Vitality`) |
| **🫧 Dewdrop Jelly Canopy** | Moss Slime | `12s` | Aqua sacred seal → watercolor dome + `60` rippling mint water-pearls → mist pop | `💖 Vitality` Max-HP Party Shield + slow pop |
| **💨 Gale-Leaf Charge** | Thornback Boar | `7s` | Wind seal → `5.2m` dash + `3` afterimages + **`90`-tuft blooming clover & golden-leaf wake** → dust twinkle | `5.2m` Dash + `🔥 Power` line DMG + stun |
| **💎 Prism Crystal Bloom** | Crystal Beetle | `6.5s`| Cyan seal → `55°` cone ripple of **`75→130` faceted cyan & violet crystal clusters** → diamond sparkle shatter | Multi-hit crystal cone (`🔥 Power`) |
| **🦇 Twilight Lantern Siphon**| Lantern Bat | `10s` | Nocturnal amber seal → soundwave rings + **`80` glowing lantern-wisps** spiraling inward | `3.8m` AoE (`🔥 Power`) + `25%` HP leech |
| **🪨 Astral Quartz Vortex** | Quartz Golemling| `11s` | Astrolabe seal → `360°` spin whipping **`140` orbiting violet quartz shards** inward → nebula twinkle | `4.4m` Gravity Pull + AoE DMG |
| **🌲 Ancient Grove Quake** | Elder Moss Golem| `15s` | Druidic seal + leap → crater ripple of **`160` mossy megaliths, ferns & wildflowers** → spore twinkle | `4.8m` AoE DMG + `1.5s` Stun + stagger |
| **🕸️ Celestial Prism Ray** | Crystal Weaver | `16s` | Double celestial seal + float → piercing beam rippling a **`9.5m` carpet of `150` astral crystals & prism flowers** → constellation dissolve | `9.5m` piercing laser (`🔥 Power`) |

---

## 6. Declarative VFX & Animation Studio (`vfx-pipeline`)
1. **`shared/skill_vfx_defs.js`**: Pure JSON recipes defining `sacredSeal`, `clusterField` (`count`, `variants`, `waveSpeed`, `swayAmp`), `slashSweep`, `beam`, `twinkleDissolve`, `rigChoreo`, and `lv5Override`.
2. **`client/js/frontier/skill_vfx_engine.js`**: Hi-DPI sacred-geometry seal generator + GPU `InstancedMesh` cluster wave-bloom shader (`1 draw call` per 260-sprite field!) + staggered starlight-twinkle dissolve.
3. **`/?dev=1&vfx=1` (`vfx_studio.js`) + `scripts/shoot_skill_vfx.mjs`**: Renders a **6-phase contact strip** matching the `00:01 → 00:08` phases of `skill_example.mov`, validates Chibi readability, and benchmarks **10 simultaneous casting players** (`< 16ms`).
4. **`.agents/skills/vfx-pipeline/SKILL.md`**: Reusable skill so every future Monster Skill & Hero Ultimate hits this exact `skill_example.mov` bar automatically.
