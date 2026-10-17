# 🌙🏰 MOON DEFENSE V2 — *Tree of Savior (ToS) × X Hero Siege* Co-Op Hero Defense Spec
**Status:** Locked Core Design Spec (Ready for Phase 6 Implementation & Future MMORPG Bridge)
**Target Screen:** `Screen 14` (`MODES.moon_bunny` in `shared/universal_room.js`)
**Arena Map:** Reuses **100% of the Town Hall Plaza (`36m × 36m`)** in **🌙 Starlight Night / Sakura Moon** mode!

---

## 1. 🎯 Core Design Philosophy (*Tree of Savior Uphill Defense × X Hero Siege*)
Instead of a static grid Tower Defense, **Moon Defense V2** plays like ***Tree of Savior (ToS)*'s Uphill Defense / Saalus Convent** mixed with ***X Hero Siege***:
1. **Pure 2.5D Chibi Action RPG (Zero Static Tower Grids)**: No ugly concrete tower pads cluttering the Town Hall floor! Every unit on screen — **Your Hero, Your Partner, Your Companion Pets, and Your Hired Mercenary Bots** — is a **living, walking, spell-casting 9-Bone Chibi or Pet**!
2. **Wardrobe = Combat Class (`combatClass`)**: Putting on a Costume defines your RPG Class (`⚡ Striker`, `❄️ Controller`, `🌸 Mystic Healer`, `🎰 Fortune Alchemist`), with signature basic attacks, ground magic circles, and Ultimates.
3. **Exponential In-Match Power (*X Hero Siege* Tomes)**: Stack **Stat Tomes** mid-match (`Power`, `Swiftness`, `Multi-Shot`) so your Chibi evolves from firing 1 bolt at Wave 1 to unleashing 5-way rainbow fans & chain lightning at Wave 5.
4. **Moving Mercenary Helper Squads (`[🎰 Hire Mercenary]`)**: Spend in-match **🪙 Mochi Coins** to hire **Moving Mercenary Helper Bots** (`★1 → ★2 → ★3` Auto-Merge + `✦ Super Mythic Fusion`) that **patrol the 3 lanes on foot or rally around you** via 1-tap Stance Orders!

---

## 2. 📱 Optimal Vertical `9:16` Arena Layout (North-to-South 3-Lane Siege)

Why **Vertical `9:16` Top-to-Bottom (`North → South`)** is optimal:
- Keeps 100% of Neora World V2 in **one-handed Portrait `9:16`** (never forces players to rotate their phone or break the Couple Voice Call HUD).
- Eliminates off-screen Left/Right blind spots: all monsters spawn from the **3 Top Gates (`NW Left`, `N Center Boss`, `NE Right`)** and march **downward** toward the **🐰 Moon Bunny Shrine** at the lower-center of the Town Hall Plaza!

```
┌─────────────────────────────────────────┐ ◄── VERTICAL 9:16 PHONE SCREEN
│ [🐰 HP: 920/1000]  [🍡 Cake 3/6] [Wave 4]│
│ Stance: [🛡️ Patrol Lanes] [⚔️ Follow Me!]│ ◄── 1-Tap Mercenary Bot Command!
├─────────────────────────────────────────┤
│   ⛩️ NW GATE   ⛩️ N BOSS   ⛩️ NE GATE   │ ◄── Monsters spawn at the TOP
│       │            │            │       │     and march DOWN the 3 roads!
│       ▼            ▼            ▼       │
│     🐷🐷         👹BOSS        🟢🟢     │ ◄── See ALL 3 lanes in one view!
│      ⚔️🤖         ⚡🧙‍♀️         ❄️🤖     │ ◄── Your Hero + Moving Mercenary Bots
│   (Merc Bot)   (Your Hero)   (Merc Bot) │     roam, intercept & dodge Red Zones!
│       \            │            /       │
│        ▼           ▼           ▼        │
│               ( 🐰 BUNNY )              │ ◄── Protect the Bunny at lower-center!
├─────────────────────────────────────────┤
│ [📖 Tome 50🪙] [🎰 Hire Merc 80🪙] [🔔] │ ◄── Bottom Thumb Deck
│    [💨 Dash]    [🐾 Pet]    [🌈 ULT!]   │
└─────────────────────────────────────────┘
```

- **Lower-Center Shrine `(0, 0, +8m)` (`radius = 2.2m`)**:
  - The **🐰 Moon Bunny (`1,000 Max HP`)** pounds **6 Star-Mochi Rice Cakes** inside a glowing *Tree of Savior*-style **Golden Magic Circle**.
- **3 North-to-South Chokepoint Roads (`Left NW`, `Center Boss`, `Right NE`)**:
  - Open plaza terrain where Players and Hired Mercenary Bots walk freely between lanes to intercept waves, dodge Boss slams, and collect drops.

---

## 3. 🕹️ Free-Roam *ToS* Hero Controls + Active Challenge (Zero Button-Mashing!)

1. **Free-Roam Movement (Exact Same as Town Hall)**:
   - Drag anywhere on the ground (or tap) to walk freely across all 3 lanes, intercept Bosses, grab dropped **🌱 Primrose Seeds**, or stand beside your Partner.
2. **Smart `6m` Auto-Fire Ring (Zero Thumb Fatigue)**:
   - Whenever enemies enter your Hero's **`6m` Attack Circle**, your Chibi automatically faces the nearest threat and fires your **Costume Class Basic Attack** (`⚡ Lightning`, `❄️ Frost Shards`, `🌸 Healing Foxfires`, `🎰 Midas Cards`), while your **🐾 Pet** fires every 3rd shot.
   - Tap any Boss/Bounty Pig to lock focus (`🎯`).
3. **Why You Can't Just Stand Still (The 3 Active *ToS* Challenges)**:
   - **🔴 Boss & Elite Red Telegraph Zones**: Elite Boars charge in red lines and the King Slime slams red circles (`1.5s` warning). You must walk or tap **`[💨 Dash (4s CD)]`** to dodge, or get stunned/frozen for `3s`! (`[💨 Dash]` also magnet-vacuums nearby coins & seeds!).
   - **🎯 Positional Class Passives & Ground Magic Circles**:
     - `⚡ Striker`: **`+40%` Close-Range Crit** (`<3m`) — rewards dashing near Bosses and dodging slams.
     - `❄️ Controller`: **`[🌈 Ultimate]`** drops a *ToS*-style **Frost/Gravity Magic Circle** freezing/pulling enemies in the lane you are standing in.
     - `🌸 Mystic`: Projects a **Sacred Shrine Healing Circle** around your feet — stand near the **🐰 Moon Bunny** or wounded teammates/mercenaries to heal & buff `+15%` Attack Speed!
     - `🎰 Alchemist`: Hits pop **Golden Jackpot Coins** on the ground that must be dashed over within `5s`.
   - **☄️ 25s Side-Objective Crises**: **Star-Mochi Meteors** & **🌱 Sacred Primroses** land near the top monster gates — one player must brave enemy territory for `2s` to harvest and bring them back while teammates & Mercenary Bots hold the lanes!

---

## 3B. 🤝 The Moving "Hire Mercenary / Helper Bot" System (*ToS* Companion Squads!)

Because every Hero uses the **same 9-Bone Chibi Rig + Costume Class (`combatClass`)**, **Moving AI Mercenary Bots** use the exact same walk, dodge, and projectile engine as players — and carry **100% into the future 6-Biome MMORPG**!

### A. Pre-Match Party Mercenaries (Fill Empty Seats in Solo / Couple Duo!)
When starting Moon Defense with fewer than 4 human players, empty seats in the 4-Seat Hub (`Screen 09`) can be filled by **AI Chibi Party Mercenaries**:
1. **💞 Summon Offline Partner's Ghost (`FREE` for Couples!)**:
   - Partner asleep or at work? Tap **`[💞 Bring Partner's Mercenary]`** to spawn your Partner's real Chibi wearing their equipped **Costume Class, `+10` Gloves, and Companion Pet**!
   - Their AI walks the lanes, dodges red Boss slams, casts their Costume Ultimate, and sends your Partner an **🦉 Owl Commission Mail (`+50 🪙`)** next time they log in!
2. **🏆 Hire a Friend or Hall-of-Fame Statue Mercenary**:
   - Solo players can hire a **Friend's Chibi** or one of the **🏆 Top 3 Hall of Fame Statue Heroes** (`1 Free Daily Hire` or `50 🪙` commission sent to their Owl Inbox) to round out their party class synergy!

### B. In-Match `[🎰 Hire Mercenary (80 🪙)]` (Moving Squad + `3×` Auto-Merge!)
Inside the match, tapping **`[🎰 Hire Mercenary (80 🪙)]`** summons **Moving Helper Bots** at the Moon Bunny Shrine that immediately run out on foot to fight:
- **`60%` ★1 Vanguard Pet Bot** (`🐱 Ragdoll`, `🐉 Nyx`, `🦊 Kitsune`, `🐋 Sky Whale` — scurries down lanes firing elemental shots).
- **`30%` ★2 Awakened Spirit Bot** (or **`3× ★1` Auto-Merge** in a flash of golden light!).
- **`10%` ★3 Mythic Chibi Mercenary Bot** (or **`3× ★2` Auto-Merge**! Spawns a moving `❄️ Elsa`, `⚡ Zeus`, `🌸 Kitsune`, or `🎰 Casino` Chibi Mercenary Captain that walks the battlefield casting mini-ultimates!).
- **✦ SUPER MYTHIC RECIPE FUSION**:
  - Having **❄️ Elsa Merc + ⚡ Zeus Merc + 🌸 Kitsune Merc** active on the field unlocks **`[✦ FUSE: ECLIPSE DRAGON / AURORA EMPRESS SOVEREIGN!]`** — a floating winged God-Mercenary that flies across all 3 lanes raining solar/aurora beams!
- **🕹️ 1-Tap Mercenary Stance Bar (Top HUD)**:
  - **`[🛡️ Patrol 3 Lanes]`** *(Default)*: Your hired Mercenary Bots automatically divide evenly across the Left, Center, and Right roads.
  - **`[⚔️ Follow Me / Focus Boss]`**: All your Mercenary Bots sprint to YOUR Hero's side like a personal *Tree of Savior* summon army to gang up on the Boss or Bounty Pig!
  - **`[🐰 Guard Bunny]`**: Pulls all Mercenary Bots back to form a protective ring around the Moon Bunny Shrine.

---

## 4. 👾 5-Wave Structure + *X Hero Siege* Special Events (`~2.5 Minutes`)

| Wave | Time | What Marches Down the 3 North Gates | Special *ToS × X Hero Siege* Event |
| :--- | :---: | :--- | :--- |
| **Wave 1** | `0:00–0:25` | **🟢 Green Bouncy Slimes** (`150 HP`, slow hop) | Warm-up farm to buy your first **📖 Hero Tome** or **`[🎰 Hire Mercenary]`**! |
| **Wave 2** | `0:25–0:55` | **🟢 Green Slimes** + **🐷 Fast Ribbon Pigs** (`280 HP`, `1.6×` speed) | First speed check — fast pigs test whether your Mercenary Bots & Speed Tomes cover all 3 lanes. |
| **⚡ EVENT 1** | `0:55–1:10` | **🪙 Golden Treasure Pig Pinata (`15s` Bonus Trial!)** | Spawns in the center plaza! Tap `[⚔️ Follow Me!]` so all Heroes & Mercenary Bots gang up on it — breaking it in `15s` showers everyone with **`+200 🪙 Mochi Coins` + `1 Free ★2 Mercenary`**! |
| **Wave 3** | `1:10–1:40` | **🍓 Strawberry Shield Slimes** (`450 HP`, blocks 1st hit) + **🐷 Ribbon Pigs** | Mid-game pressure — players unleash **🌈 Costume Ultimates**, **🐾 Pet Soul-Links**, and `3×` Mercenary Auto-Merges. |
| **Wave 4** | `1:40–2:10` | **🔥 Elite Armored Boars** *(🔴 Red Line Charge!)* + **2× Double Surge on 1 Lane** | **Co-Op & Dodge Test**: Dodge the red boar charges with `[💨 Dash]` and rally to the surged lane! |
| **Wave 5 (BOSS)** | `2:10–2:45` | **👑 Giant King Mochi Slime Boss (`8,000 HP`, 🔴 Red Circle Slams)** + 3-Lane Final Onslaught! | **Final Gauntlet**: King Slime marches down Center Road — stack Tomes, fuse ★3 / ✦ Super Mythic Mercenaries, dodge red slams, and unleash Dual Soul-Link Combos! |

---

## 5. 👗 The "Wardrobe = Combat Class" System (Moon Defense V2 → Future MMORPG)
Instead of locking players into a permanent character class at account creation, **changing your Costume in the Wardrobe changes your Combat Class (`combatClass`)**!
- Building this directly into [`shared/season_skills.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/season_skills.js) for **Moon Defense V2** means **100% of your Basic Attack Projectiles, Class Passives, Pet Combos, and Ultimates are already built when we expand into the 6-Biome Co-Op MMORPG later.**

### A. The 4 Core Costume Classes (`combatClass` — *Tree of Savior* Archetypes)

| Class Archetype | Icon | Costumes in This Class | Basic Attack Style (Every Shot) | Class Passive (Moon Defense + Future MMO) | Ultimate Role (`[🌈 COSTUME ULT]`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **1. Striker (Swordsman / Burst DPS)** | ⚡ | **Zeus (`s11`)**, **Pharaoh Ra (`s9`)**, **Dune Phoenix (`s3`)**, **Eclipse Dragon (`sm`)** | Piercing lightning / solar beams / firebolts | **Armor Melt**: Hits shred Boss & Elite DEF by `-20%` and deal `+30%` damage to Bosses (`+40%` Crit at `<3m` range) | Massive Boss execution & burn/lightning pillars |
| **2. Controller (Cryo / Chrono Wizard)** | ❄️ | **Glacial Elsa (`s8`)**, **Cinderella (`s7`)**, **Astral (`s6`)**, **Tsukuyomi (`s2`)** | Frost shards / gravity orbs / chrono needles | **Permafrost / Time Slow**: Basic attacks chill enemies (`-35%` move speed) and `15%` chance to knock them back `1.5m` | Drops a *ToS*-style Magic Circle that deep-freezes (`6s`), pulls into a Black Hole, or rewinds enemies |
| **3. Mystic (Cleric / Shrine Healer)** | 🌸 | **Kitsune Inari (`s2`)**, **Aurora Empress (`sm`)**, **Atlantis Siren (`s5`)**, **Naga (`s1`)** | Homing foxfires / aqua bubbles / aurora waves | **Shrine Blessing Circle**: Every 3rd hit heals the **🐰 Moon Bunny `+10 HP`** & allies inside your aura gain **`+15%` Attack Speed** | Tidal wave pushback + Party Barrier Shield + Moon Bunny `+150 HP` burst heal |
| **4. Alchemist (Scout / Fortune Trickster)** | 🎰 | **Casino Royale (`s4`)**, **Sultan Djinn (`s3`)**, **Phantom Masque (`s10`)** | Golden trick cards / Midas coins / mirror blades | **Midas Touch**: Every hit has a **`20%` chance to pop `+5 🪙 Mochi Coins`** + lucky `3×` Jackpot Crit bursts | Spins Golden Roulette / 3 Wishes to shower the team with Coins, free Mercenaries, or reflect Boss damage |
| **5. Starlight Adventurer *(Default `★1–★2`)* ** | 🌟 | All Casual / Rare (`★1–★2`) Outfits | Balanced Starlight Bolts | **Starlight Luck**: `+10%` Move/Attack Speed & `+1` bonus Primrose Seed drop per wave | **Lucky Star Wish**: Heals Moon Bunny `+100 HP` & grants `+100 🪙 Mochi Coins` |

### B. How Gloves, Weapons & Pets Stack on Top of Your Costume Class
1. **Equipped Gloves / Weapon + Star-Force (`+1` to `+10`)**:
   - Scales your starting base damage (`up to +25%` soft-capped) and gives `+10` heroes their signature **Sovereign Hand Lightning projectile trail**.
2. **Equipped Companion Pet (`★1–★3` + Lv.15 Bound Costume)**:
   - Fires its signature **`every3rdShot` elemental attack** from [`shared/pet_skills.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/pet_skills.js) (`Ragdoll Bounce Orb`, `Nyx AoE Plasma`, `Kitsune Bunny-Heal Foxfire`, `Sky Whale Frost Slow Bubble`).
   - Joins your Costume Ultimate as a **🔗 Soul-Link Combo (+15% potency + second wave spell)**!

---

## 6. 🔥 The 4 Addiction & Replayability Pillars

1. **🎰 Moving Mercenary Auto-Merge & `✦ Super Mythic` Recipe Fusion**:
   - Rolling & auto-merging `★1 → ★2 → ★3` moving Mercenary Bots (`❄️ Elsa`, `⚡ Zeus`, `🌸 Kitsune`, `🎰 Casino`) and fusing them into a flying **✦ Super Mythic Sovereign Mercenary** gives every match that *"Will I hit the Super Mythic fusion this run?!"* thrill.
2. **🃏 "Pick 1 of 3 Starlight Blessings" After Every Cake Baked (*Roguelike Build Variety*)**:
   - Every time the Moon Bunny finishes 1 of the 6 Mochi Cakes (~25s), pick 1 of 3 run-defining passives (**`🪙 Compound Interest +25%`**, **`🎰 Twin Mercenary Roll 25%`**, **`⚡ Pet Overdrive Every Shot`**, **`💞 Couple Shared Bank +30%`**).
3. **🔔 The "Daredevil Bounty Bell" (`[🔔 Summon Bounty Boss!]`)**:
   - Tap **`[🔔 Ring Bounty Bell! (25s CD)]`** to spawn an optional **👹 Golden Bounty Pig** — rally your Mercenaries with `[⚔️ Follow Me!]` to kill it before it escapes for **`+150 🪙 Mochi Coins` + `1 Free Tome` + `+10 💎 Diamonds`**!
4. **💝 Couple Coin Gifting & 🏆 Wave 6–10 Overtime Rush**:
   - **`[💝 Toss 100 🪙 to Partner]`** to help them complete a `✦ Super Mythic Mercenary Fusion`, plus an optional `60s` **Wave 6–10 Overtime Boss Rush** after Cake `6/6` that feeds the **🏆 Pedestal #3 (`#1 Arcade Defender`) Hall of Fame Statue**!


---

## 7. 🌍 Bridge to Future Expansion: How Moon Defense V2 Powers the 6-Biome Co-Op MMORPG
By building the `combat` block inside [`shared/season_skills.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/season_skills.js) during Moon Defense V2, expanding into the **6-Biome Open World MMORPG** (`Spirit Sakura`, `Desert Dunes`, `Ocean Atlantis`, `Fortune Neon`, `Frost Peaks`, `Celestial Olympus`) requires **zero new combat engine code**:
1. **Same `combatClass` & Projectiles**: Your Chibi's `STRIKER / CONTROLLER / MYSTIC / ALCHEMIST` basic attacks, passives, and Ultimates work identically when walking into field maps to fight roaming monsters and World Bosses.
2. **Same `affinity` Home-Turf Bonus**: Each costume already has `affinity: 'frost' | 'desert' | 'ocean' | 'spirit' | 'fortune' | 'celestial'` in [`shared/season_skills.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/season_skills.js) — granting **`+20%` Elemental Damage & Drop Rate** when exploring that costume's matching Biome!
3. **Same Couple & 4-Player Party Synergy**: A Couple wearing complementary classes (e.g. **⚡ Striker + 🌸 Mystic** or **❄️ Controller + 🎰 Alchemist**) naturally forms a balanced RPG duo in both **Moon Defense V2** and future **6-Biome Field Expeditions**.


