---
name: nook-mythic-enhancer
description: >-
  Standard workflow and architectural blueprint for enhancing, designing, and balancing Mythic costumes,
  in-game ultimate abilities, and gacha banners in Nook Airline (e.g. Season 6 Astral Sovereign, Season 4 Monaco High-Roller, Season 5 Atlantis Drift).
  Enforces multi-sensory audio-visual theatricality, signature tactical gameplay, resilient zero-deadlock multiplayer sync,
  compact mobile HUD aesthetics, and rock-solid uniform gacha banner dimensions.
---

# Nook Airline — Mythic Masterpiece Enhancement Guide

Use this skill whenever the user asks to **enhance, improve, rework, or design a Mythic costume** (e.g., *"enhance the Season X mythic"*, *"make this mythic on par with Astral Sovereign or Monaco"*, *"design a new mythic skill/effect"*, *"create a new gacha banner for Season X"*).

Every Mythic in Nook Airline must feel like an awe-inspiring, high-prestige masterpiece. Never settle for boring passive stats (e.g., "+10 miles") or inconsistent, jumping banner layouts. Follow the **Astral Sovereign Standard** detailed below.

---

## 1. The Five Pillars of a Masterpiece Mythic

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE ASTRAL SOVEREIGN STANDARD                        │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Multi-Sensory Theatre │ 3-stage AudioFX + 3D Orbit Nodes + Shockwave│
│ 2. In-Board Ultimates    │ 4-phase cinematic eruption + SVG vectors    │
│ 3. Signature Gameplay    │ Active choice or miraculous reactive moment │
│ 4. Resilient Netcode     │ Zero-deadlock try-finally + 9s fallback     │
│ 5. Uniform Banner & Art  │ Fixed 420px height, anchored hero, zero jump│
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 2. Pillar 1: Multi-Sensory Theatrical Identity & 3D Dice Orbits

Every Mythic costume roll must transform the entire board experience. Never settle for generic dice tumbling or static dice boxes.

### A. The 4-Tier Description Deconstruction Workflow
When designing or enhancing a Mythic, **deconstruct its costume description, lore, and skill mechanics into 4 distinct visual tiers**:
1. **Hero Projectile / Summoned Prop**: An isolated high-res sprite (e.g., `zeus_masterbolt.png`, `opera_curtains.png`, `olympus_temple.png`, `venetian_mask.png`). If an asset does not exist on disk, **proactively generate it via `generate_image`**, cut it out with clean alpha transparency, and rebuild thumbnails via `node scripts/make_thumbs.js`.
2. **Surface Reaction / Impact Crater**: Physical ground impact on the targeted tile (e.g., `lightning_crater.png`, scorched fissures, ice frost, golden sand ripple).
3. **High-Visibility Board Domain Imprint**: Fully branded property tiles owned by the player (animated crawling border + centered watermark + corner luxury pill).
4. **3D Orbit Nodes & Atmospheric Center Hub**: 6 thematic floating glyphs encircling the tumbling dice with perspective tilt, dice box vibration aura, and center hub background transformation.

### B. Procedural 3-Stage Audio (`AudioFX`)
Never use external sound files; synthesize clean, lag-free procedural Web Audio:
1. **Throw / Charge Ambience**: Activated on dice tap (`AudioFX.playAstralShimmer()`, `AudioFX.playAbyssalWave()`, `AudioFX.playPhantomOrgan()`, `AudioFX.playOlympusThunder()`). Uses low-frequency slides (45Hz–110Hz) layered with crystalline harmonic chords or sawtooth distortion.
2. **Tumbling Rhythm Tick**: Plays every 2 ticks (120ms) inside `setInterval` (`AudioFX.playOlympusTick()`, `AudioFX.playPhantomTick()`, `AudioFX.playAstralTick()`). High-frequency electric sparks or baroque harpsichord plinks.
3. **Impact / Slam Detonation**: Heavy punch on dice landing (`AudioFX.playZeusBolt()`, `AudioFX.playPhantomImpact()`, `AudioFX.playAstralImpact()`). Features sawtooth/triangle bass drop + sub-bass slam + `shakeBoard('medium')` or `'heavy'`.

### C. 3D Dice Orbit & Center Hub Immersion (`monopoly.css` + `monopoly.js` + `index.html`)
1. **HTML Orbit Markup**: Ensure a dedicated orbit container exists inside `#monopolyDiceContainer` in `public/index.html`:
   ```html
   <div class="olympus-dice-orbit hidden" id="olympusDiceOrbit">
     <span class="olympus-orbit-node olo-1">⚡</span>
     <span class="olympus-orbit-node olo-2">🏛️</span>
     <span class="olympus-orbit-node olo-3">🦅</span>
     <span class="olympus-orbit-node olo-4">🔱</span>
     <span class="olympus-orbit-node olo-5">👑</span>
     <span class="olympus-orbit-node olo-6">🏺</span>
   </div>
   ```
2. **CSS 3D Perspective Rotation**:
   ```css
   .olympus-dice-orbit.active {
     opacity: 1;
     animation: olympusOrbitSpin 0.88s linear infinite;
   }
   @keyframes olympusOrbitSpin {
     0% { transform: translate(-50%, -50%) rotate(0deg); }
     100% { transform: translate(-50%, -50%) rotate(360deg); }
   }
   .olympus-dice-orbit .olympus-orbit-node {
     position: absolute;
     font-size: 16px;
     filter: drop-shadow(0 0 8px #38bdf8) drop-shadow(0 0 16px #fbbf24);
     animation: olympusNodeCounterSpin 0.88s linear infinite;
   }
   ```
3. **Center Hub Immersion**: Add a thematic CSS class to `#monopolyCenterHub` during the roll (e.g., `.olympus-storm`, `.phantom-submersion`, `.astral-submersion`) with animated gradients and glow.
4. **Wiring in `rollDice()`**: Declare `const <theme>OrbitEl = $m('<theme>DiceOrbit')`, activate `.active` on roll start, play custom tick in interval, and include `<theme>OrbitEl` in the landing cleanup array.

### D. High-Visibility Board Domain Imprints (`.tile-<theme>-domain`)
A generic 2px border and an 11px corner emoji is strictly prohibited. Every Mythic domain must feature:
1. **Pulsing/Crawling Border**: An animated shifting gradient or neon pulse (`@keyframes ...DomainPulse`) with multi-layered glow.
2. **Thematic Floor Gradient**: Deep luminous radial gradient matching the element (e.g. electric cyan/stormy slate, midnight velvet/crimson).
3. **Centered Watermark (`::before`)**: Large 28px–32px glowing semi-transparent emblem (`⚡`, `🎭`, `🪐`, `🔱`) hovering with subtle scale/rotation animation.
4. **Luxury Corner Pill Badge (`::after`)**: Dual-icon high-contrast badge with background container, border, and drop-shadow (e.g. `content: '⚡ 🏛️';`).

---

## 3. Pillar 2: In-Board Cinematic Ultimate Eruptions (`monopoly_fx.js`)

Mythic Ultimate abilities (`triggerUltimateEffects`) must never be simple text floats or static toasts. They must trigger full-viewport theatrical set-pieces executing the **4-Phase Cinematic Sequence**:

```
                      4-PHASE CINEMATIC ANATOMY OF A MYTHIC ULTIMATE
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 1. ATMOSPHERIC SHIFT │ Thematic vignette, double flash & camera tremor │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 2. HERO PROP & VECTOR│ Descending master prop + procedural jagged paths│
   ├────────────────────────────────────────────────────────────────────────┤
   │ 3. TOKEN INTERACTION │ Spasming status, reverse conduits, tribute flow │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 4. IMPACT DETONATION │ Scorched crater, shockwave rings & luxe banner  │
   └────────────────────────────────────────────────────────────────────────┘
```

### A. The "Anti-Straight-Line" Mandate for Vectors
* **NEVER** use `<line x1=... y1=... x2=... y2=...>` straight lines for lightning, beams, or magical cords.
* **Jagged Electricity**: Generate multi-segmented procedural paths with random lateral jitter, sinusoidal envelopes, and sub-branch forks:
  ```javascript
  function generateLightning(x1, y1, x2, y2, segments = 16, maxOffset = 36) {
    // Generates main jagged polyline path + randomized sub-branch fork polylines
  }
  ```
* **Curves & Ribbons**: Use arched quadratic or cubic Bézier curves (`d="M ${x1} ${y1} Q ${midX} ${midY - 50} ${x2} ${y2}"`).
* **Dual-Layer Rendering**:
  - Outer Glow: `stroke-width: 14–16px`, outer theme color, opacity 0.85, with SVG blur filter (`#plasma-glow`).
  - Inner Core: `stroke-width: 3.5–4px`, pure `#ffffff`, opacity 1.0.
  - Sub-Forks: `stroke-width: 2–2.5px`, accent color, opacity 0.8.
* **High-Speed Flicker**: Apply an opacity flicker animation (`.fx-lightning-flicker` with `steps(2, start)`) so lightning physically crackles across the screen.

### B. The 4 Phases in Detail
1. **Phase 1: Atmospheric Shift (0–350ms)**:
   - Deep thematic vignette (`.fx-vignette.olympus-storm`, `.phantom-opera`, `.void-tithe`, `.abyss-deep`).
   - Double screen flash (blinding white `flash('rgba(255,255,255,0.96)', 140)` followed by theme color).
   - Heavy camera tremor (`MonoFX.shake('heavy')`).
   - Caster token receives custom wings/glow (`.token-olympus-pegasus-wings`, `.token-phantom-waltz-wings`).
2. **Phase 2: Hero Prop & Procedural Vector Eruption (350–1100ms)**:
   - Plunge the Hero Weapon/Prop from top of sky (e.g. `zeus_masterbolt.png` diving into the tile, or `opera_curtain_left.png` and `opera_curtain_right.png` parting from center).
   - Render procedural jagged lightning or curved velvet cords from sky/caster to target tile and all rival tokens.
3. **Phase 3: Victim Kinetic Reactions & Floating Badges (600–1200ms)**:
   - Impacted rivals receive kinetic animations (`.fx-token-olympus-smote` electric spasm, `.fx-token-marionette-stasis` marionette shake).
   - Sprout floating bespoke badges (`.fx-damage-badge` clamped via `safeVx`, `safeVy`).
   - Extorted/siphoned coins physically fly along vector siphon conduits directly into the caster's wallet.
4. **Phase 4: Detonation & Heroic Banner (1200–1700ms)**:
   - Explode the **Impact Surface Reaction** on the target tile (e.g. `lightning_crater.png` slam with smoke/rubble particles).
   - Concentric expanding rings (`MonoFX.ring`) in 3 harmonized palette colors (e.g., `#38bdf8`, `#fde047`, `#0284c7`).
   - High-prestige banner (`MonoFX.banner(...)`) displaying total impact and tactical payoffs.

### B. Hero-Prop Protection from Particle Pruning
In `public/monopoly_fx.js`, transient ballistic particles are automatically culled when exceeding limits. **Crucial Rule**: Hero summoned props must NEVER be culled by small coin bursts! Always filter out glow-enhanced props:
```javascript
// Protect hero-summoned ultimate visuals from being pruned by small coin fountains:
const items = L.moment.querySelectorAll('.fx-vis:not([class*="fx-glow"])');
```

### C. Responsive 3D Monument Anchoring & Safe Viewport Clamping (The Pyramid & Citadel Rule)
When spawning 3D monuments/structures (e.g. Glacial Ice Citadel, Great Golden Pyramid) or floating badges on tiles:

1. **Never Render Raw Assets Without CSS Clamp Constraints**:
   - High-resolution raw assets (e.g. 1024×1024 PNGs) must NEVER be appended to `#monopolyMomentLayer` without explicit responsive CSS clamp dimensions.
   - Without constraints, images default to their natural 1024px size. Because `#monopolyMomentLayer` has `overflow: hidden`, only a tiny corner or tip at the bottom-right of mobile screens is visible while 90% of the graphic is clipped off!
   - Always enforce responsive clamp rules and centering in `public/monopoly_fx.css`:
     ```css
     .fx-pyramid-rising-wrap, .fx-citadel-rising-wrap {
       position: absolute;
       pointer-events: none;
       z-index: 45;
       display: flex;
       flex-direction: column;
       align-items: center;
       justify-content: center;
       transform: translate(-50%, -50%);
     }
     .fx-pyramid-hero-img, .fx-citadel-hero-img {
       width: clamp(82px, 22vw, 108px);
       height: clamp(82px, 22vw, 108px);
       object-fit: contain;
     }
     ```

2. **Safe Boundary Clamping & Adaptive Badge Inversion (`safeMonumentAnchor`)**:
   - Modern mobile screens (e.g. iPhone 16/17/18 Pro) have compact widths (~380px–430px).
   - Perimeter tiles (Tile 0, 5, 8, 10) lie right along the viewport edges.
   - Placing a monument at `y - offset` or its badge at `y - 88px` on top-row tiles causes negative coordinates (`y < 0`), clipping the badge completely off-screen above `#monopolyMomentLayer`.
   - Always calculate monument and badge coordinates via `safeMonumentAnchor`:
     ```javascript
     function safeMonumentAnchor(targetP, offsetTop = 20) {
       refs();
       const W = (L.moment && L.moment.clientWidth) || 360;
       const H = (L.moment && L.moment.clientHeight) || 600;
       const pt = targetP || center();
       const safeModelX = Math.max(55, Math.min(W - 55, pt.x));
       const safeModelY = Math.max(65, Math.min(H - 65, pt.y - offsetTop));
       const safeBadgeX = Math.max(90, Math.min(W - 90, pt.x));
       // If near the top edge of screen, place badge BELOW the structure so it's fully visible
       const safeBadgeY = safeModelY < 120 ? (safeModelY + 64) : (safeModelY - 60);
       return { modelX: safeModelX, modelY: safeModelY, badgeX: safeBadgeX, badgeY: safeBadgeY };
     }
     ```
   - Also boundary-clamp victim tribute/extortion badges (`safeVx = Math.max(65, Math.min(W - 65, ve.p.x))`, `safeVy = Math.max(25, Math.min(H - 25, ve.p.y - 25))`) so damage indicators never get cut off on edge tiles.

### D. Complete 11-Season Mythic Ultimate Catalogue & Reference
All implemented Mythic Ultimates follow this exact blueprint:

| Season & Mythic Costume | Ultimate ID | Thematic Visual Concept | In-Board Vector & Kinetic Interaction |
|---|---|---|---|
| **S11 Thunder Wolf Sovereign Zeus & Dawn Athena** | `wrath_of_olympus` | Olympus Wrath & Master Lightning Smite | Golden temple thunderstorm vignette; multi-target branching procedural vector lightning; spasming token status (`.fx-token-shocked`); golden shock badges; Zeus thunder detonation (+1000🪙 rent strike). |
| **S10 Phantom Wolf Maestro & Black Swan Empress** | `phantom_curtain_call` | Phantom Masquerade: The Grand Curtain Call | Midnight darkness vignette; Venetian mask descent; floating cyan music notes & baroque ribbons; reverse-rent hex marking; invert next paid rent into player income. |
| **S9 Pharaoh Ramses & Cleopatra** | `nile_seduction` | Nile Seduction & Great Golden Pyramid | Procedural gold solar rays to all rivals & pyramid; extortion tribute coin flows; 3D Great Golden Pyramid rise with pulsing beacon. |
| **S9 Sun God Ra & Sekhmet** | `solar_wrath` | Eye of Ra Solar Wrath | Blazing solar wrath laser beam; property downgrade fire explosions; rival tribute coin scorch; triple-ring solar detonation. |
| **S8 Glacial Empress Elsa** | `absolute_zero` | Absolute Zero & Glacial Ice Citadel | Multi-target branching procedural ice fissures; rivals encased in 3D ice blocks; 3D Glacial Ice Citadel rise; Frost Crown aura. |
| **S7 Midnight Cinderella** | `midnight_paradox` | Midnight Clockwork Paradox | Giant golden clockwork dial; Roman numeral tick cascade; reverse movement stasis field; chiming glass bell acoustic blast. |
| **S6 Astral Sovereign** | `astral_tithe` | Supernova Celestial Tithe | Multi-target branching SVG void lightning to all rivals; victim token spasming; stardust/coin conduits; triple-ring supernova shockwave. |
| **S5 Atlantis Drift** | `abyss_cataclysm` | Abyssal Tidal Cataclysm | Surging vector tsunami foam wall; target dragged backward 3 tiles into whirlpool; waterlogged roll stun; ocean pearl siphon. |
| **S4 Monaco High-Roller** | `monaco_gold_rush` | Royal Flush Gold Rush | 3D spinning Roulette Wheel; fan of 5 golden royal cards (A-K-Q-J-10); vertical chip geyser (+800🪙); locked roll 6 die. |
| **S1 Mekong River Warden** | `naga_surge` | Emerald Naga Surge | Ancient jade serpent emergence from Tile 0; sprouting glowing Lotus Water Domes on owned Bangkok tiles; +500🪙 river hoard. |
| **S2 Solar-Lunar Deity** | `eclipse_convergence` | Solar-Lunar Eclipse Convergence | Totality shadow blackout; diamond ring lens flare; spectral violet stasis chains locking all rival properties (0 rent for 1 round). |
| **S3 Cosmic Djinn** | `djinn_wish` | Cosmic Genie Wish | Brass lamp shake; swirling violet stardust smoke pillar; Midas Touch golden hotel transmutation on lowest property tile (+350🪙). |


---

## 4. Pillar 3: Signature Gameplay Mechanics & Tactical Agency

A Mythic must give the player memorable tactical excitement:

| Pattern | Example | Why It Works |
|---|---|---|
| **Active Tactical Decision** | *Atlantis Abyssal Drift* | Roll dice, then choose whether to stay or surge +1 tile forward. Board highlights both tiles with danger/rent tags. |
| **Dominion Tithe / Tax** | *Astral Star Tithe* | Rivals landing on your property pay an extra 15% celestial tithe with stardust particle flights. |
| **Clutch Resurrection** | *Constellation Rebirth* | Once per game, fatal bankruptcy triggers a supernova explosion, restoring 300 miles and clearing the debt. |
| **Route Express / Warp** | *Monaco VIP Express* | First roll lands directly on Sky Casino with a golden chip trail and high-roller duel buff. |

---

## 5. Pillar 4: Resilient Multiplayer Synchronization & Zero-Deadlock Protocol

Mythic mechanics involve signaling messages across players (`bkk` ↔ `dxb`). Always enforce these safety rules:

### A. Non-Blocking Animation Queuing
Signaling messages that modify player positions or properties arriving during an active avatar hop must be queued in `queuedMessages` and processed only in `flushQueuedMessages()`.
**Exception:** Intermediate decision messages (e.g., `action === 'drift_choice'`) MUST bypass the queue check:
```javascript
if (isAnimating && message.type === 'monopoly_action' && message.action !== 'roll' && message.action !== 'drift_choice') {
  queuedMessages.push(message);
  return;
}
```

### B. Remote Resolver Fallback Timeout
Whenever a remote player waits for their partner's decision (e.g., drift choice), ALWAYS attach a safety fallback timer (e.g., 9 seconds) so network drops or disconnects NEVER freeze the game:
```javascript
pendingRemoteDriftResolver = proceedMove;
setTimeout(() => {
  if (pendingRemoteDriftResolver === proceedMove) {
    console.warn('[Monopoly] Remote decision timeout fallback triggered.');
    pendingRemoteDriftResolver = null;
    const fallback = botChooseFallback(playerKey);
    proceedMove(fallback);
  }
}, 9000);
```

### C. Guaranteed `try...finally` Visual Teardown Protocol
When launching in-board cinematic ultimate animations (`MonoFX.<abilityName>`):
- ALWAYS wrap temporary SVGs, floating badges, and token kinetic classes (`.fx-token-shocked`, `.fx-token-drowning`, `.fx-token-sovereign-charge`) inside a `try...finally` block.
- This guarantees that even if an exception or cancellation occurs, all temporary DOM elements are cleaned up and tokens are restored, preventing avatars from being permanently stuck in spasming or displaced states:
```javascript
try {
  await sleep(duration);
} finally {
  if (svgNode) svgNode.remove();
  badges.forEach(b => b.remove());
  if (casterEl) casterEl.classList.remove('fx-token-sovereign-charge');
  victimEls.forEach(el => el.classList.remove('fx-token-shocked'));
}
```

### D. Hard Operational Constraints
- **NEVER kill, restart, or reload Port 3000** (live Cloudflare tunnel). Run headless verification tests non-intrusively as read-only browser clients.
- Auto-recover stuck locks in `handleUserRollRequest`:
```javascript
if ((monopolyState.isRolling || isAnimating) && now - rollStartedAt > 4000) {
  monopolyState.isRolling = false;
  isAnimating = false;
}
```

### E. AI Bot Wardrobe Isolation & Fallback Integrity
- In bot or 4-player party modes, bots must NEVER inherit or duplicate the human player's equipped wardrobe or custom Mythic perks.
- Always verify player key against wardrobe storage and check `player.isBot`:
  ```javascript
  // Ensure bots resolve to default (Capt. Whiskers) or explicitly assigned bot perks:
  function getEffectivePerk(playerKey) {
    const p = monopolyState.players[playerKey];
    if (!p || p.isBot) return p?.botPerk || null;
    return getEquippedWardrobePerk(playerKey);
  }
  ```
- All tactical decision prompts (e.g. drift choice, arena challenge, casino gamble) must include an immediate automated bot resolver so AI turns never hang waiting for user modal interactions.

---

## 6. Pillar 5: Mobile-First Micro-HUD Aesthetics

When prompting the player for a decision (like Abyssal Drift or Supernova choice):
1. **Never use full-screen dark backdrops**:
   - `background: transparent !important; pointer-events: none;` on overlay.
   - `pointer-events: auto;` on the inner card so the player can inspect the board tiles behind the prompt.
2. **Compact Dimensions**:
   - Max width: 280px–300px.
   - Height: < 120px.
   - Position: Centered over center hub or docked cleanly.
3. **Instant Touch Responsiveness**:
   - Bind BOTH `touchend` and `click` with `e.preventDefault()` and `e.stopPropagation()` for zero-lag mobile reaction.
4. **Urgency Countdown Bar**:
   - 6-second animated countdown bar (50ms interval) that automatically auto-picks the safest option on timeout.

---

## 7. Pillar 6: Masterpiece Gacha Banner & Art Standards

To match top commercial gacha games (*Genshin Impact*, *Honkai: Star Rail*), gacha banners must maintain 100% rock-solid geometric consistency across all seasons with **zero layout shifts** when swiping:

### A. Strict Fixed Banner Dimensions
Banners must NEVER use content-driven height (`min-height: 0` is forbidden):
* **Desktop**: Exactly `380px` (`height: 380px; min-height: 380px; max-height: 380px;`).
* **Mobile (`<= 640px`)**: Exactly `420px` (`height: 420px; min-height: 420px; max-height: 420px;`).
* **Grid Hierarchy**:
  ```css
  .vg-banner {
    grid-template-columns: 1.22fr 0.78fr;
    grid-template-rows: 1fr auto;
    height: 420px;
    box-sizing: border-box;
  }
  ```
  * Row 1 (`1fr`): Contains copy on left and hero character on right.
  * Row 2 (`auto`): Contains `.vg-epics` cleanly pinned along the bottom spanning `grid-column: 1 / -1`.

### B. Grounded Hero Framing & Sprite Artwork Standard
1. **Sprite Proportions**: Character sprites must be full-body, high-resolution portrait illustrations (e.g. `458 × 900` or `512 × 1024` with the character filling ~90% vertical bounds). Never use unanchored, miniature chibis as the banner hero.
2. **Anchoring & Scaling**: The character must be grounded at the bottom-right of Row 1:
   ```css
   .vg-hero-wrap {
     display: flex;
     align-items: flex-end;
     justify-content: flex-end;
     height: 100%;
     overflow: visible;
   }
   .vg-hero {
     height: 94%;
     max-height: 240px;
     width: auto;
     max-width: 135%;
     object-fit: contain;
     object-position: bottom right;
     align-self: flex-end;
   }
   ```
3. **Ambient Halo**: Center the glowing halo behind the character at `right: -10px, bottom: 0`.

### C. Standardized Perk Card Geometry (`.vg-feature`)
* **Fixed Height**: Fixed at `162px` on mobile (`168px` on desktop) so differing perk word counts never stretch the banner.
* **Overflow Handling**: `small` description has `overflow-y: auto; scrollbar-width: none; flex: 1;`.
* **Single-Line Sub-Feature**:
  ```css
  .vg-feature-sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  ```

### D. Dedicated Navigation Bar (Zero Overlap)
* Chevrons (`‹`, `›`) and pagination dots (`● ○ ○`) must ALWAYS live in `.vg-banner-controls` **below** `.vg-banner` and **above** `.vg-pity`.
* **Never** float chevrons or dots inside `.vg-banner` where they could overlap hero character artwork or the 4 Epic costume cards.
* Keep touch swipe gestures active on the banner (`touchstart` / `touchend` with `touch-action: pan-y`).

### E. Container-Only Scrolling (Anti-Viewport Drift)
Never use `element.scrollIntoView()` for horizontal sub-ribbons on iOS/WebKit. Always use container-scoped scrolling:
```javascript
const targetLeft = activeChip.offsetLeft - (ribbon.clientWidth / 2) + (activeChip.offsetWidth / 2);
ribbon.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
if (typeof window !== 'undefined' && (window.scrollX > 0 || window.pageXOffset > 0)) {
  window.scrollTo(0, window.scrollY || window.pageYOffset || 0);
}
```

---

## 8. Mythic Enhancement Checklist

- [ ] Deconstructed costume description into 4 asset tiers (Hero Prop, Surface Crater, Domain Imprint, 3D Orbit).
- [ ] Proactively generated missing supporting VFX sprites via `generate_image`, cut out transparent alpha, and rebuilt 300px thumbnails via `node scripts/make_thumbs.js`.
- [ ] Verified Anti-Straight-Line Rule: used procedural jagged paths or Bézier curves with dual-layer glow halo and core (zero raw `<line>` tags).
- [ ] Verified High-Visibility Domain Imprint (`.tile-<theme>-domain`): animated pulse border + themed floor + centered 28px watermark + 2-icon luxury corner pill.
- [ ] Verified 3D Orbit HTML container in `index.html`, CSS perspective spin in `monopoly.css`, and active activation/cleanup in `rollDice()`.
- [ ] Added `is<Theme>Sovereign(role)` helper in `public/monopoly.js`.
- [ ] Added 3-stage audio synthesis (`play<Theme>Shimmer`, `play<Theme>Tick`, `play<Theme>Impact`) in `AudioFX`.
- [ ] Implemented 4-phase in-board ultimate cinematic sequence in `public/monopoly_fx.js`.
- [ ] Ensured all 3D monument/prop images have explicit responsive `clamp()` CSS dimensions (never unconstrained natural resolution).
- [ ] Applied `safeMonumentAnchor()` coordinate clamping on monuments and badges so top-row/corner tiles never clip off-screen on iPhone portrait viewports.
- [ ] Bound adaptive badge placement (render below monument if `safeModelY < 120px`).
- [ ] Protected hero props from particle burst pruning using `:not([class*="fx-glow"])`.
- [ ] Enforced guaranteed cleanup of SVGs, badges, and token kinetic classes via `try...finally`.
- [ ] Verified AI bots do not inherit or clone the human player's equipped Mythic perks or hang during tactical prompts.
- [ ] Added 3D orbit nodes or center hub submersion CSS in `public/monopoly.css`.
- [ ] Added board domain CSS class (e.g., `.tile-<theme>-domain`).
- [ ] Added signaling action handler in `handleMonopolyMessage`.
- [ ] Verified non-blocking message queue bypass for intermediate actions.
- [ ] Added 9-second timeout fallback for remote player sync.
- [ ] Verified banner geometry: fixed `420px` height on mobile, fixed `380px` on desktop.
- [ ] Verified hero sprite is grounded at bottom-right and maintains consistent visual scale with other mythics.
- [ ] Verified navigation controls (`‹   ● ○ ○ ○ ○   ›`) are below banner with zero overlap on cards or text.
- [ ] Tested on mobile viewport (402x874) and verified zero horizontal page drift and zero layout shift on banner swipe.
- [ ] Tested roll and ultimate execution with isolated test script to verify zero console errors and zero freezes.
- [ ] Bumped script & stylesheet version tags in `public/index.html`.
- [ ] Preserved live port 3000 process untouched.
