# ✈️ Nook Runway: Sky Dash (Tales of Flight)
### Comprehensive Game Design & Technical Specification Document
*A hybrid of **Tales Runner** (fashion stats, pet companions, rhythm dash chaining, item sabotage) and **Cookie Run** (accessible 2-thumb rhythm, diamond arc collection, dynamic Fever Flight).*

---

## 1. Executive Summary & Core Identity

| Field | Specification |
|---|---|
| **Title** | **Nook Runway: Sky Dash** (*Tales of Flight*) |
| **Genre** | 2.5D Real-Time Mobile Sky Runner (Competitive Sabotage & Co-op Relay) |
| **Platforms** | Mobile-First Web App (iPhone 18 Pro optimized: 402×874 px, 60–120 FPS WebGPU) |
| **Runtime Context** | Seamlessly embedded alongside active WebRTC video call & flight cabin UI |
| **Session Length** | 60 to 90 seconds per race |
| **Setting** | Floating cloud runways soaring above iconic global skylines (Tokyo Sakura, Bangkok Twilight, Dubai Golden Hour) |

### The Core Vision
*Nook Runway: Sky Dash* transforms the Nook Airline wardrobe and pet collection into a fast-paced, high-adrenaline, yet charmingly cute racing game. It blends:
1. **The Casual Charm of Cookie Run**: Smooth two-thumb controls, satisfying rhythmic arcs of collectible diamonds, glowing particle cascades, and accessible fun.
2. **The High Skill Ceiling of Tales Runner**: Landing-dash rhythm chaining, drift mechanics, aerial glide maneuvering, and chaotic Mario-Kart-style item warfare.
3. **The Nook Airline Meta-Economy**: Direct utility for collected gacha costumes (Speed, Dash, Float, Luck stats) and Cat Lounge companions (active and passive companion perks).

---

## 2. Target Audience Appeal: Women & Men Player Dynamics

To ensure both female and male players are genuinely captivated:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DUAL-APPEAL DESIGN FORMULA                      │
├──────────────────────────────────┬─────────────────────────────────────┤
│   💖 WHY SHE WILL LOVE IT        │   ⚡ WHY HE WILL LOVE IT             │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Adorable, expressive pet cats  │ • High skill ceiling & rhythm tech  │
│   running and bouncing alongside │ • Frame-perfect "Landing Dash" tech │
│ • High-fashion costume showcase  │ • Cutthroat item sabotage & traps   │
│   (Sakura kimonos, cyber coats)  │ • Competitive 1st place bragging    │
│ • Satisfying diamond chime audio │ • Min-maxing costume stat builds    │
│ • Magical, hand-in-hand "Fever   │ • Clutch comeback mechanics         │
│   Flight" co-op mode             │   (Lightning, Homing C4 Missiles)   │
└──────────────────────────────────┴─────────────────────────────────────┘
```

* **Surface Charm, Deep Mastery**: A newcomer can play casually with two thumbs and enjoy the cute pets and gorgeous scenery. A competitive player can master landing dash timing, optimal jump arcs, and offensive item counterplay to dominate the track.

---

## 3. Game Modes: Competitive Versus vs. Co-op Duo

The game features two strictly separated game modes to ensure competitive integrity in versus play while providing romantic teamwork in duo play.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GAME MODE MATRIX                              │
├────────────────────────────────┬────────────────────────────────────────┤
│  🏆 MODE A: COMPETITIVE VERSUS │  💞 MODE B: CO-OP DUO / 2v2 RELAY      │
├────────────────────────────────┼────────────────────────────────────────┤
│ • 1v1, 3P, or 4P Free-for-All  │ • 2-Player Couple Team vs. Rival Team  │
│ • Pure race for 1st Place      │ • Combined team finish points win      │
│ • Sabotage items enabled       │ • Sabotage items target opposing team  │
│ • Individual costume/pet stats │ • "Love Tether" active (+20% speed)    │
│ • ZERO couple synergy (fair)   │ • "Rescue High-Five" clears stumbles   │
│ • Individual podium rewards    │ • Shared "Fever Flight" starway blast  │
└────────────────────────────────┴────────────────────────────────────────┘
```

---

### Mode A: Competitive Versus (1v1, 3P, 4P Free-for-All)
Every racer competes solely for themselves. The objective is simple: cross the finish line first.

#### 1. Competitive Integrity Rule
* In Competitive Versus, **all couple synergy mechanics (tethers, auto-revives, shared gauges) are completely disabled**.
* If two partners play 1v1 or 4P FFA against each other, the race is 100% fair and cutthroat.
* **Couple Resonance (Flavor Only)**: If both players wear matching costume themes (e.g. both wearing Tokyo Sakura S2), a special post-game podium title **"Best Dressed Couple"** is awarded with a +50💎 bonus, regardless of who won the race.

#### 2. Live Leaderboard Ticker & HUD
* A real-time race progress bar stays pinned to the top of the screen:
  ```
  [ 🥇 You (1st) ──► (+12m) ──► 🥈 Partner (2nd) ──► (+24m) ──► 🥉 Player 3 ──► 4th ]
  ```
* Displays relative distances in meters and flashing alert indicators when a rival launches an incoming missile or drops a trap.

#### 3. Podium Finish & Bounties
* 🥇 **1st Place**: Gold Trophy + 300 💎 Diamonds + Exclusive Victory Pose
* 🥈 **2nd Place**: Silver Trophy + 160 💎 Diamonds
* 🥉 **3rd Place**: Bronze Trophy + 80 💎 Diamonds
* 🎖️ **4th Place**: Consolation Prize + 30 💎 Diamonds + EXP

---

### Mode B: Co-op Duo / 2v2 Team Relay
You and your partner run as a **unified romantic team** against 2 rival racers (or AI bots).

#### 1. The "Love Tether" Mechanic
* When running within **150px** of each other, an animated, pulsing neon pink-and-gold stardust tether links both avatars.
* **Gameplay Buffs**:
  * **+20% Base Speed** for both runners.
  * **Dash Stamina Tank regenerates 2× faster**.
  * **Rubberband Slingshot**: If one partner lags behind due to a stumble, holding Dash lets them slingshot forward to their partner's position.

#### 2. The "Rescue High-Five"
* If your partner hits an obstacle, gets stunned by lightning, or spins on a banana peel:
  * Their avatar flashes yellow with a dizzy bubble for 1.5 seconds.
  * The unaffected partner can activate Dash and physically touch their avatar.
  * **Result**: Instantly cancels the stun penalty and triggers an explosive heart-burst high-five that boosts both runners forward with +30% acceleration!

#### 3. Shared "Fever Flight" Mode
* Collecting diamonds and stars charges a shared **Couple Heart Gauge** at the top center.
* Once the gauge hits 100%, the entire track transitions:
  * Both avatars blast into the golden stratosphere hand-in-hand!
  * **Zero obstacles or pits for 8 seconds**—only raining diamonds, huge golden coins, and flying mascot cats.
  * Dynamic synth-pop music swell with trailing rainbow light ribbons.

#### 4. Team Scoring
* Positions award team points: 1st (10 pts), 2nd (6 pts), 3rd (4 pts), 4th (2 pts).
* The duo with the highest combined score wins the match.

---

## 4. Controls & Movement Mechanics (2-Thumb Mobile)

Designed specifically for thumb comfort on modern iPhones (e.g. iPhone 18 Pro) while holding the device horizontally or vertically beside the video call:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SCREEN TOUCH INTERACTION ZONES                       │
├───────────────────────────┬────────────────────────────────────────────┤
│      LEFT THUMB: JUMP     │            RIGHT THUMB: DASH & SLIDE       │
├───────────────────────────┼────────────────────────────────────────────┤
│ • Tap: Standard Jump      │ • Tap: Slide under high hurdles            │
│ • Mid-Air Tap: Double Jump│ • Hold: Turbo Jet Dash (consumes stamina)  │
│ • Hold in Air: Float/Glide│ • Frame-Perfect Landing: "Landing Dash"    │
└───────────────────────────┴────────────────────────────────────────────┘
```

### Movement Nuances & Rhythm Tech

1. **Tales Runner "Landing Dash" (The Skill Ceiling)**:
   * When an avatar drops from a jump and hits the runway, a glowing circle flashes under their sneakers for **120 milliseconds**.
   * Tapping the **Right Thumb (Dash)** during this 120ms landing window triggers an **Instant Landing Dash**:
     * Instantly restores top speed.
     * Consumes **zero stamina**.
     * Emits a crisp audio cue (*"Zwing!"*) and blue spark particles.
   * Rhythmic chaining of Jump $\rightarrow$ Landing Dash separates masters from beginners.

2. **Cookie Run Diamond Arcs**:
   * Collectible diamonds and gold coins are placed in parabolic arcs matching the exact jump and double-jump trajectories.
   * Collecting an entire arc of 7 diamonds awards a **"Perfect Arc!"** chime and a burst of Dash Stamina.

3. **Squash & Stretch (Tactile Weight / Juice)**:
   * Landing from a high fall compresses the character vertically (`scaleY: 0.82, scaleX: 1.18`) for 80ms before springing back.
   * Launching into a double-jump stretches the sprite vertically (`scaleY: 1.25, scaleX: 0.85`), delivering satisfying cartoon physics.

4. **Turbo Dash Juice**:
   * Engaging Turbo Dash tilts the avatar forward (`skewX: -12deg`).
   * The camera smoothly zooms out by 10% to widen the player's reaction window.
   * Trailing anime motion lines and camera micro-shake provide a sense of intense speed.

---

## 5. Mystery Item Sabotage Arsenal (Tales Runner / Mario Kart Style)

Floating gift cubes scattered along the track grant single-use offensive, defensive, and tactical weapons:

| Item Icon | Item Name | Target | Tactical Effect | Counterplay |
|---|---|---|---|---|
| 🍌 | **Banana Peel / Oil Slick** | Trailing opponent | Drops behind your avatar. Any runner who steps on it spins out for 1.2s and drops 10 diamonds. | Jump or double-jump over it; air float over the hazard. |
| 🚀 | **Homing C4 Blossom Rocket** | Leader ahead | Fires forward, homing onto the next racer ahead, launching them upward on impact with a pink smoke burst. | Activate Air Shield or perform a timed double-jump dodge. |
| ⚡ | **Lightning Rod** | 1st Place Player | Strikes the race leader anywhere on the track. Shrinks them by 50% and caps max speed for 3.0s (rubberbanding). | Air Shield completely absorbs the shockwave. |
| 🛡️ | **Air Bubble Shield** | Self | Encircles the runner in a translucent iridescent bubble. Absorbs 1 obstacle stumble or enemy item attack. | Persists until struck or expires after 10s. |
| 💨 | **Super Jet Boost** | Self | Grants a 3.5s supercharged rocket sprint that plows straight through obstacles without taking damage. | Steer clear of racers in Super Jet mode. |
| 🧲 | **Diamond Magnet** | Self | Sucks all coins, diamonds, and stardust within a 200px radius into your runner for 6.0s. | Maximizes score and Fever gauge filling. |
| 🐾 | **Squid Ink / Paw Splatter** | All rivals | Splatters cute black and pink cat paw prints over rivals' screens, obscuring their track visibility for 2.5s. | Memorize track layout or jump blindly. |

---

## 6. Costume Stat System (Vault Integration)

Every costume unlocked via the Nook Airline Gacha banners possesses 4 concrete racing attributes that directly affect the physics engine:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COSTUME STAT FORMULAS                           │
├───────────────┬────────────────────────────────────────────────────────┤
│ 🏃 MAX SPEED  │ Base runway velocity (100 to 165 km/h).                │
│ ⚡ DASH BOOST │ Acceleration rate, stamina pool size & recharge rate.  │
│ 🪶 AIR FLOAT  │ Jump apex hang-time and horizontal glide distance.     │
│ 🍀 LUCK/VIBE  │ High-tier item draw probability & magnet radius.       │
└───────────────┴────────────────────────────────────────────────────────┘
```

### Stat Progression & Signature Passives by Tier

| Costume Tier | Speed | Dash Boost | Air Float | Luck / Magnet | Signature Running Passive Perk |
|---|:---:|:---:|:---:|:---:|---|
| **Classic (Default)** | 100 | 100 | 100 | 100 | *Standard Dash & Jump* |
| **⭐ Rare** | 115 | 110 | 105 | 120 | **Quick Recovery**: Stumble duration from banana peels and obstacle hits reduced by **-35%**. |
| **⭐⭐ Epic** | 135 | 130 | 125 | 140 | **Slipstream Draft**: Running directly behind any opponent grants **+15% free speed boost** without consuming dash stamina. |
| **⭐⭐⭐ Mythic** | 160 | 155 | 150 | 170 | **Golden Aura**: Trailing stardust sparkles; **grants immunity to the first 2 obstacle hits** in every race! |

* **Wardrobe Synergy**: Wearing matching theme sets (e.g. full Tokyo Sakura Kimono + Floral Parasol) activates an additional **+5% Set Resonance Bonus** to all stats.

---

## 7. Cat Companion System (Cat Lounge Integration)

Your active pet from the Cat Lounge doesn't just sit in the menu—it physically runs, bounds, or flies beside your avatar, providing active skill triggers and passive perks:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAT COMPANION MATRIX                            │
├────────────────────┬───────────┬───────────────────────────────────────┤
│ CAT BREED & NAME   │ RARITY    │ TRACK RUNNING ABILITY                 │
├────────────────────┼───────────┼───────────────────────────────────────┤
│ 🍗 Bengal Tiger    │ ⭐⭐ Epic │ **Jungle Pounce**: Every 16s, leaps   │
│    (*Tiger Lily*)  │           │ forward to smash the next obstacle or │
│                    │           │ enemy trap into golden coins.         │
├────────────────────┼───────────┼───────────────────────────────────────┤
│ 🪙 Maneki-Neko     │ ⭐⭐⭐    │ **Golden Vacuum**: Continuously draws │
│    (*Princess*)    │   Mythic  │ in all diamonds and stardust within   │
│                    │           │ an extended 180px radius.             │
├────────────────────┼───────────┼───────────────────────────────────────┤
│ 🐟 Captain Cat     │ ⭐⭐⭐    │ **Tailwind Booster**: +25% Dash       │
│    (*Whiskers*)    │   Mythic  │ Stamina duration and blows away cloud │
│                    │           │ fog and ink splatters instantly.      │
├────────────────────┼───────────┼───────────────────────────────────────┤
│ 🌸 Sakura Fold     │ ⭐⭐⭐    │ **Petal Trampoline**: If your avatar  │
│    (*Sakura Mochi*)│   Mythic  │ falls into a cloud gap, Sakura drops  │
│                    │           │ a floral cushion bouncing you back up!│
├────────────────────┼───────────┼───────────────────────────────────────┤
│ 🔮 Galaxy / Moon   │ ⭐⭐⭐    │ **Cosmic Starlight**: Multiplies star │
│    (*Nebula*)      │   Mythic  │ collection value by 2× and generates  │
│                    │           │ an anti-gravity low float on jumps.   │
└────────────────────┴───────────┴───────────────────────────────────────┘
```

* **Pet Energy & Affection**: Feeding your cat gourmet treats in the Cat Lounge boosts their skill cooldown speed on the track by up to **+15%**.

---

## 8. Costume & Pet Strategy & Combi System (The Meta Synergy)

Just like the beloved **Cookie + Pet Combi Bonus** in *Cookie Run* and the **Character + Alchemy Pet loadouts** in *Tales Runner*, pairing specific costumes with specific cats unlocks unique **Named Combi Bonuses** and distinct **Strategic Playstyle Archetypes**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THEMATIC COMBI SYNERGY MATRIX                        │
├──────────────────────────┬─────────────────────────────┬───────────────┤
│ COSTUME SET              │ MATCHING PET COMPANION      │ COMBI TITLE   │
├──────────────────────────┼─────────────────────────────┼───────────────┤
│ 🌸 Tokyo Sakura Kimono   │ 🌸 Sakura Fold (Mochi)      │ Sakura Reverie│
│ ✈️ First Class Captain   │ 🐟 Captain Whiskers         │ Aerial Ace    │
│ 🪙 Golden Jetsetter      │ 🪙 Maneki-Neko (Kohaku)     │ Fortune King  │
│ 🏙️ Cyber Streetwear      │ 🍗 Bengal Tiger (Lily)      │ Apex Predator │
│ 🔮 Celestial Star Robes  │ 🔮 Galaxy Cat (Nebula)      │ Zero-G Horizon│
└──────────────────────────┴─────────────────────────────┴───────────────┘
```

### Part A: Named Thematic Combi Bonuses (Synergy Perks)

1. **🌸 "Sakura Reverie" (Tokyo Sakura S2 Costume + Sakura Mochi Fold)**:
   * **Combi Perk — *Cherry Blossom Wake*:**
     * Whenever you execute a frame-perfect **Landing Dash**, you create an expanding swirl of glowing pink cherry blossom petals.
     * **Self Buff:** Extends Dash boost duration by **+20%**.
     * **Sabotage Effect:** Leaves a slippery petal wake behind you on the runway for 3.0s that slows trailing opponents by **-15%**.

2. **✈️ "Aerial Ace" (First Class Captain Uniform + Captain Whiskers)**:
   * **Combi Perk — *Supersonic Slipstream*:**
     * **Stamina Efficiency:** Dash Stamina consumption reduced by **-25%**.
     * **Wind Mastery:** Crosswinds, turbulence zones, and storm clouds grant a **forward speed kick** instead of pushing you back or slowing you down.

3. **🪙 "Fortune King" (Golden Jetsetter Luxe + Princess Kohaku Maneki)**:
   * **Combi Perk — *Golden Star Rush*:**
     * **Star Transmutation:** 30% of all diamonds vacuumed by Maneki's magnet are transmuted into **Golden Star Diamonds** (worth 3× points and filling the Fever meter twice as fast).
     * **Lucky Draw:** Mystery Boxes have double the chance to grant **Super Jet** or **Lightning Rod**.

4. **🏙️ "Apex Predator" (Cyber Streetwear + Tiger Lily Bengal)**:
   * **Combi Perk — *Hunter's Shrapnel*:**
     * **Pounce CD:** Reduces Tiger Lily's Jungle Pounce cooldown from 16s down to **12s**.
     * **Obstacle Shrapnel:** When Tiger Lily smashes an obstacle, it shatters into projectile debris that launches forward and trips up the racer directly ahead!

5. **🔮 "Zero-G Horizon" (Celestial Robes + Nebula Galaxy Cat)**:
   * **Combi Perk — *Antigravity Glide*:**
     * **Infinite Air Glide:** Gliding in mid-air consumes **zero stamina**.
     * **Stratosphere Path:** Jump apex hang-time is doubled, allowing players to float across entire hazardous gaps and cruise the exclusive high-sky diamond highway.

---

### Part B: Strategic Build Archetypes (The Competitive Meta)

Players can mix and match any costume and cat to craft their personal strategic racing identity:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STRATEGIC RACING BUILDS                         │
├────────────────────┬─────────────────────────┬─────────────────────────┤
│ PLAYSTYLE BUILD    │ RECOMMENDED LOADOUT     │ WIN CONDITION           │
├────────────────────┼─────────────────────────┼─────────────────────────┤
│ ⚡ THE RHYTHM      │ Max Speed Costume       │ Pure mechanical skill.  │
│    DASHER          │ + Captain Whiskers      │ Chain 100% Landing      │
│                    │                         │ Dashes to run away 1st. │
├────────────────────┼─────────────────────────┼─────────────────────────┤
│ 🪽 THE SKYLINE     │ Max Float Costume       │ Bypass all ground traps │
│    SHORTCUTTER     │ + Nebula Galaxy Cat     │ & bananas by living in  │
│                    │                         │ the sky above rivals.   │
├────────────────────┼─────────────────────────┼─────────────────────────┤
│ 💣 THE CLUTCH      │ Max Luck Costume        │ Stay in 2nd/3rd place,  │
│    SABOTEUR        │ + Tiger Lily Bengal     │ hoard Lightning/Rockets,│
│                    │                         │ strike at final 100m.   │
├────────────────────┼─────────────────────────┼─────────────────────────┤
│ 💞 THE FEVER       │ (P1) Luck + Maneki-Neko │ Duo Mode only: Rapidly  │
│    DUO             │ (P2) Dash + Captain     │ charge Fever Heart to   │
│                    │                         │ fly invincible 50% time.│
└────────────────────┴─────────────────────────┴─────────────────────────┘
```

1. **Build 1: "The Rhythm Dasher" (Speed Demon Meta)**
   * **Focus**: Top velocity and dash uptime.
   * **Execution**: Ideal for players with great rhythm. By timing the 120ms Landing Dash on every jump descent, this build maintains unbroken maximum velocity and creates an untouchable lead.

2. **Build 2: "The Skyline Shortcutter" (Aerial Glide Meta)**
   * **Focus**: Air float, jump height, and gap clearance.
   * **Execution**: Ignores the cluttered bottom runway where bananas, laser gates, and oil slicks lie. Jumps from high cloud trampolines and glides along the upper stratosphere diamond trails.

3. **Build 3: "The Clutch Saboteur" (Mario Kart Chaos Meta)**
   * **Focus**: High Luck attribute for aggressive item draws.
   * **Execution**: Tactically hangs back in 2nd or 3rd place to maximize the odds of pulling Lightning Rods and Homing Rockets from Mystery Boxes. Deploys the strike right at the finish line stretch for a dramatic photo-finish steal!

4. **Build 4: "The Fever Duo" (Co-op Synergy Meta)**
   * **Focus**: Role division between partners in 2v2 Duo.
   * **Execution**: Partner 1 runs high Luck/Magnet (Maneki-Neko) to vacuum every diamond in sight, while Partner 2 runs high Speed/Dash (Captain Whiskers) to pull the Love Tether forward. The pair enters Fever Flight 3 to 4 times per race!

---

## 9. Track Design & Environmental Hazards

Races take place across stylized aerial runway circuits with 3-layer parallax depth:

### 1. Circuit 1: Tokyo Sakura Skyway (Season 2 Theme)
* **Background**: Neon Shinjuku and Tokyo Tower glowing below a twilight sky with falling cherry blossoms.
* **Hazards**: Floating paper lantern obstacles, sudden crosswinds pushing racers left/right.
* **Special Props**: Japanese Torii Gate boost arches granting instant speed bursts.

### 2. Circuit 2: Bangkok Twilight Cloudway
* **Background**: Wat Arun and Chao Phraya river illuminated in warm golden twilight.
* **Hazards**: Drifting storm clouds with static lightning rods, floating market boat hurdles.
* **Special Props**: Lotus flower trampolines launching runners into the high diamond trail.

### 3. Circuit 3: Dubai Golden Mirage Runway
* **Background**: Burj Khalifa and futuristic sky islands glistening under desert starlight.
* **Hazards**: Cloud sandstorms obscuring visibility, moving laser luggage scanners.
* **Special Props**: Supersonic wind tunnels granting prolonged flight.

---

## 10. Technical Architecture: Pixi.js (v8 WebGPU) + GSAP

### Why This Engine Stack Wins
Instead of heavy compiled engines like Godot (which require massive WASM bundles and complicate WebRTC video integration), we use **Pixi.js v8 + GSAP**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RENDER ENGINE PIPELINE                          │
├────────────────────────────────────────────────────────────────────────┤
│  ⚡ PIXI.JS v8 (WebGPU / WebGL2 Core)                                  │
│  • 120 FPS hardware-accelerated 2D canvas                              │
│  • Ultra-lightweight footprint (~18MB memory)                          │
│  • Single draw call sprite batching (avatars, pets, diamonds, tracks) │
│  • Coexists seamlessly with active WebRTC video stream                 │
├────────────────────────────────────────────────────────────────────────┤
│  🎬 GSAP (Camera Director & Juice Animation)                           │
│  • Dynamic camera zoom (zooms in on apex jumps, pulls back on dash)   │
│  • Hit-stop freeze frames (0.08s pause on missile impact)              │
│  • Screen shake & anime speed line vignette shaders                    │
├────────────────────────────────────────────────────────────────────────┤
│  🦴 SPINE 2D / MODULAR SKELETAL RIGS                                   │
│  • Costume modularity: Hats, outfits, and accessories snap to one rig │
│  • Smooth running, jumping, and tumbling skeletal interpolation        │
│  • Zero need for heavy frame-by-frame spritesheet asset bloat          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Real-Time Networking & 200-Player Scalability

### Architecture Evolution:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     NETWORKING SCALING ROADMAP                         │
├───────────────────────────────────┬────────────────────────────────────┤
│ PHASE 1: 1v1 to 4P ROOM SERVER    │ PHASE 2: SCALING TO 200 PLAYERS    │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Authoritative Node.js WebSocket │ • Colyseus room clusters / sharding│
│ • 20 Hz tick rate with client     │ • 16 to 32 active racers per heat  │
│   prediction & smooth interp      │ • Tournament bracket progression   │
│ • Delta compression: ~3 KB/s      │ • 150+ live spectators in arena    │
│ • Ping compensation (<80ms)       │ • Real-time betting & light-sticks │
└───────────────────────────────────┴────────────────────────────────────┘
```

#### How 200 Players Are Supported
1. **Race Heat Sharding**: 200 concurrent players are partitioned into parallel heats (e.g. 10 rooms of 20 racers or 25 rooms of 8 racers) using Colyseus room clustering.
2. **Grand Final Tournament**: Top 2 finishers from each heat advance to semi-finals and a 4-player Grand Championship race.
3. **Mass Spectator Arena**: Players waiting in the lobby can spectate the ongoing championship race with zero latency via lightweight state broadcasts, cheering with emoji fireworks and placing diamond wagers on the winner!

---

## 12. Cross-Game Synergy: Elevating the Monopoly Board

Adopting Pixi.js and GSAP for *Sky Runway* also elevates the existing **Monopoly Cabin Game**:
* **3D-like Dice Physics**: Smooth WebGL tumbling dice with shadow projection instead of flat DOM elements.
* **Animated Player Avatars**: Instead of static avatar icons moving across tiles, your equipped 2D costume character physically walks, jumps, and celebrates on tiles.
* **Unified Economy**: Diamonds collected in Sky Runway directly feed into Gacha pulls, Pet Lounge treats, and Monopoly powerups.

---

## 13. Phased Implementation Roadmap

* **Phase 1: Solo Feel & Physics Prototype**
  * Lightweight Pixi.js v8 canvas overlay in flight cabin.
  * 3-layer parallax skyline, 2-thumb Jump/Double-Jump/Dash, squash-and-stretch landing.
  * 1 pet cat bounding beside avatar. Tested at 120 FPS on iPhone 18 Pro.
* **Phase 2: Vault Stats, Pet Skills & Mystery Items**
  * Wire costume stats (Speed, Dash, Float, Luck) from `vault.js`.
  * Wire cat active/passive skills from `catlounge.js`.
  * Diamond arcs, obstacles, and mystery item boxes.
* **Phase 3: 2-to-4 Player Real-Time Multiplayer**
  * WebSocket delta sync for racers.
  * Mode toggle: Competitive Versus (FFA) vs. Co-op Duo (2v2).
  * Love Tether, Rescue High-Five, and Fever Flight implementation.
  * Finish line podium ceremony and diamond rewards.
* **Phase 4: Scalable Room Sharding & Spectator Arena**
  * Multi-room matchmaking, tournament brackets, and live spectator cheering.
