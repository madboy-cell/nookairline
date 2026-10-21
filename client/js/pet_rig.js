// client/js/pet_rig.js — Reusable 7-Bone 2.5D Skeletal Pet Rig & Directional Locomotion Solver.
// Shared across all 3D modules (Village, Town Hall, Couple Sanctuary, Monopoly 2.5D, Cloud Dash)
// and 2D/DOM stages (Pet Sanctuary, Wardrobe Avatar Card, Gacha Opera Catwalk).
//
// 7 Virtual Bones (UV-Skinned on a 14x18 subdivided plane in 3D, or strip-deformed in 2D):
//   1. PAW_L      — Left / Hind paw scissor-step & foot-lift arc
//   2. PAW_R      — Right / Front paw scissor-step & foot-lift arc
//   3. TORSO      — Chest breathing, stride pitch, and flight banking
//   4. HEAD       — Neck counter-tilt (stabilizes head against torso sway) & curious nod
//   5. EARS_CREST — Secondary spring lag & twitch on upper ears, horns, frills, and crowns
//   6. WINGS      — Aerodynamic 3D wing-beat flap & span pulse (Nyx dragon & winged forms)
//   7. TAIL       — Travelling multi-segment sinusoidal S-wave along tail / fluke / cape hem

import { petLocomotion, normalizePetId } from '../../shared/pet_catalog.js';

export const PET_LOCO_MODE = Object.freeze({
  HOP_WADDLE: 0,
  FLY_FLUTTER: 1,
  FLOAT_SPIRIT: 2,
  SKY_SWIM: 3,
});

export const PET_VIEW_MODE = Object.freeze({
  front: 0,
  side: 1,
  move: 1,
  back: 2,
  cast: 3,
  happy: 3,
  sleep: 3,
  lifted: 3,
});

/**
 * Resolves the active directional/locomotion sprite pose ('front' | 'side' | 'back' | 'move')
 * when the pet is moving or idle, ensuring ZERO sprite-swap strobing:
 *  - Walking/flying UP (nz < -0.15 or directionalView === 'back', away from camera) ALWAYS holds 'back'.
 *  - Walking/flying sideways or forward holds the streamlined 'move' pose steadily (with hysteresis
 *    via currentPose so it never flickers at speed thresholds), while the 7-bone vertex shader
 *    animates smooth continuous wing-flapping, paw stepping, and tail waving.
 *  - Stationary / pop-turn states use 'front', 'side', or 'back'.
 */
export function resolveDirectionalPetPose({
  vx = 0,
  vz = 0,
  speed = Math.hypot(vx, vz),
  directionalView = 'front',
  currentPose = 'front',
  turning = false,
  loco = 'HOP_WADDLE',
  walkPhase = 0,
  hasSide = true,
  hasBack = true,
  hasMove = true,
} = {}) {
  // Hysteresis threshold: enter movement pose at 0.22 m/s, stay in movement pose down to 0.10 m/s
  const wasMovingPose = currentPose === 'move' || currentPose === 'back';
  const moveThreshold = wasMovingPose ? 0.10 : 0.22;

  // 1. Stationary / Idle: respect facing ('front', 'side' during pop-turn, or 'back')
  if (speed <= moveThreshold) {
    if (directionalView === 'back' && hasBack) return 'back';
    if (directionalView === 'side' && hasSide) return 'side';
    return 'front';
  }

  const nx = vx / Math.max(speed, 1e-4);
  const nz = vz / Math.max(speed, 1e-4);

  // 2. Moving UP (away from camera, nz < -0.18 or FacingState in back mode):
  //    Hold 'back' steadily so the pet faces away from camera with smooth 7-bone motion!
  const backThreshold = currentPose === 'back' ? -0.10 : -0.18;
  if ((nz < backThreshold || directionalView === 'back') && hasBack) {
    return 'back';
  }

  // 3. Pop-turn mid-crouch transition frame (only when not actively holding 'move')
  if (turning && directionalView === 'side' && hasSide && currentPose !== 'move') {
    return 'side';
  }

  // 4. Moving sideways, diagonally, or forward:
  //    Hold 'move' steadily (no rapid side <-> move texture swapping!) so the 7-bone shader
  //    delivers 100% smooth continuous flight/trot animation.
  if (hasMove) {
    return 'move';
  }
  if (Math.abs(nx) >= 0.30 && hasSide) {
    return 'side';
  }
  return 'front';
}

/**
 * Pure, deterministic 7-bone skeletal state solver for any pet species, view, and motion state.
 * Unit-testable in Node and used by both the 3D WebGL ShaderMaterial and 2D stage previewers.
 *
 * CRITICAL SMOOTHNESS INVARIANT:
 * Never multiply accumulated time `t` by a `walkWeight`-dependent frequency (`t * f(w)`),
 * because `d/dt [t * f(w)] = f(w) + t * f'(w) * dw/dt` creates huge phase-velocity spikes
 * whenever `w` changes. Always use incrementally integrated `walkPhase` for locomotion cycles
 * and fixed-frequency `t * const` for idle breathing.
 */
export function computePetBoneState({
  petId = 'pet_ragdoll',
  loco = petLocomotion(normalizePetId(petId)),
  pose = 'front',
  t = 0,
  speed = 0,
  vx = 0,
  vz = 0,
  walkWeight = speed > 0.1 ? 1 : 0,
  walkPhase = t * 5.0,
  mirror = 1,
  action = null,
  trick = null,
  mounted = false,
  rideStyle = null,
} = {}) {
  const locoMode = PET_LOCO_MODE[loco] ?? 0;
  const viewMode = PET_VIEW_MODE[pose] ?? 0;
  const w = mounted ? Math.max(0.85, Math.min(1, walkWeight)) : Math.max(0, Math.min(1, walkWeight));

  let legL = 0;
  let legR = 0;
  let footLiftL = 0;
  let footLiftR = 0;
  let torso = 0;
  let breath = 0;
  let head = 0;
  let earFlutter = 0;
  let wingFlap = 0;
  let tailWave = walkPhase;
  let tailAmp = 0.032;
  let cloth = 0.006;
  let bobY = 0;
  let rollZ = 0;
  let scaleX = 1;
  let scaleY = 1;

  if (loco === 'FLY_FLUTTER') {
    // -------------------------------------------------------------------------
    // NYX (Midnight Drake) — Silky-Smooth Aerodynamic Wing-Beat & Glide
    // Uses continuous `walkPhase` (no `t * f(w)` phase jumps!)
    // -------------------------------------------------------------------------
    const flapSin = Math.sin(walkPhase);
    const flapCos = Math.cos(walkPhase);

    // Smooth, graceful wing-beat arc (gentle in hover, fuller in active flight)
    wingFlap = flapSin * (0.065 + w * 0.055);
    bobY = 0.28 + w * 0.05 - flapCos * (0.028 + w * 0.018);

    // Smooth forward flight pitch & gentle bank into horizontal velocity
    const forwardPitch = w * (pose === 'back' ? 0.03 : -0.055);
    torso = forwardPitch + flapCos * 0.022;
    const bankTarget = -Math.max(-1, Math.min(1, vx / 4.5)) * 0.045 * w;
    rollZ = Math.sin(t * 1.8) * 0.016 * (1 - w * 0.5) + bankTarget;

    // Head stabilizes smoothly against torso pitch
    head = -torso * 0.45 + Math.sin(t * 1.7) * 0.022 * (1 - w * 0.4);
    breath = Math.sin(t * 2.4) * 0.016;

    // Plasma ear-frills & dorsal spines trail smoothly with phase lag
    earFlutter = Math.sin(walkPhase - 0.7) * (0.025 + w * 0.025);

    // Hanging paws tuck and sway gently in sync with the wing-beat
    legL = Math.sin(walkPhase - 0.5) * (0.05 + w * 0.07);
    legR = -Math.sin(walkPhase - 0.5) * (0.05 + w * 0.07);

    // Continuous dragon tail S-wave driven by incremental walkPhase
    tailWave = walkPhase * 1.15;
    tailAmp = 0.036 + w * 0.028;
    cloth = 0.006 + w * 0.008;
  } else if (loco === 'SKY_SWIM') {
    // -------------------------------------------------------------------------
    // SKY WHALE — Serene Cetacean Air-Swimming Wave & Pectoral Fin Paddle
    // -------------------------------------------------------------------------
    const swimSin = Math.sin(walkPhase * 0.85);
    const swimCos = Math.cos(walkPhase * 0.85);
    bobY = 0.30 + w * 0.04 + swimSin * (0.035 + w * 0.020);
    torso = swimCos * (0.032 + w * 0.035);
    rollZ = Math.sin(t * 1.6) * 0.024;
    head = -torso * 0.4 + Math.sin(walkPhase * 0.85 + 0.5) * 0.02;
    breath = Math.sin(t * 2.2) * 0.020;

    // Pectoral fins paddle smoothly
    wingFlap = swimSin * (0.05 + w * 0.045);
    legL = swimSin * (0.09 + w * 0.10);
    legR = -legL;
    earFlutter = swimCos * 0.022;

    // Rainbow tail fluke propulsion wave
    tailWave = walkPhase * 1.05;
    tailAmp = 0.042 + w * 0.035;
  } else if (loco === 'FLOAT_SPIRIT') {
    // -------------------------------------------------------------------------
    // SAKURA KITSUNE — Graceful Fox-Trot + Floating Nine-Tail Silk Ripple
    // -------------------------------------------------------------------------
    const strideSin = Math.sin(walkPhase);
    const strideCos = Math.cos(walkPhase);
    const doubleStep = 0.5 - 0.5 * Math.cos(walkPhase * 2.0); // C^infty smooth (no sharp abs() corner!)

    bobY = 0.16 + (0.03 + doubleStep * 0.045) * w + Math.sin(t * 2.2) * 0.020 * (1 - w);
    legL = strideSin * 0.24 * w;
    legR = -strideSin * 0.24 * w;
    footLiftL = Math.max(0, strideSin) * 0.045 * w;
    footLiftR = Math.max(0, -strideSin) * 0.045 * w;

    torso = (strideCos * 0.035 - 0.025) * w + Math.sin(t * 1.8) * 0.018 * (1 - w);
    head = -torso * 0.5 + strideSin * 0.022 * w + Math.sin(t * 1.6) * 0.022 * (1 - w);
    breath = Math.sin(t * 2.4) * 0.018 * (1 - w * 0.4);
    earFlutter = Math.sin(walkPhase - 0.5) * 0.03 * w + Math.sin(t * 2.4) * 0.015;

    tailWave = walkPhase * 1.1;
    tailAmp = 0.040 + w * 0.032;
    cloth = 0.008 + w * 0.010;
  } else {
    // -------------------------------------------------------------------------
    // PRINCESS RAGDOLL (`HOP_WADDLE`) — Smooth Cat Trot, Paw Scissor-Step & Cape Sway
    // -------------------------------------------------------------------------
    const strideSin = Math.sin(walkPhase);
    const strideCos = Math.cos(walkPhase);
    // Use smooth harmonic `0.5 - 0.5 * cos(2 * walkPhase)` instead of `Math.abs(sin)` so
    // there is zero sharp C^0 cusp/bounce-snap at the bottom of each step!
    const doubleStep = 0.5 - 0.5 * Math.cos(walkPhase * 2.0);

    bobY = doubleStep * 0.055 * w;
    const stepSquash = (doubleStep - 0.5) * 0.055 * w;
    scaleY = 1 + stepSquash;
    scaleX = 1 - stepSquash * 0.55;

    legL = strideSin * 0.26 * w;
    legR = -strideSin * 0.26 * w;
    footLiftL = Math.max(0, strideSin) * 0.050 * w;
    footLiftR = Math.max(0, -strideSin) * 0.050 * w;

    if (pose === 'front' || pose === 'back') {
      rollZ = strideSin * 0.032 * w;
      torso = strideCos * 0.024 * w + Math.sin(t * 1.9) * 0.016 * (1 - w);
    } else {
      torso = (strideCos * 0.036 - 0.022) * w + Math.sin(t * 1.9) * 0.016 * (1 - w);
      rollZ = strideSin * 0.018 * w;
    }

    head = -torso * 0.5 + strideSin * 0.024 * w + Math.sin(t * 1.7) * 0.022 * (1 - w);
    breath = Math.sin(t * 2.3) * 0.018 * (1 - w * 0.5);
    earFlutter = Math.sin(walkPhase - 0.6) * 0.032 * w + Math.sin(t * 2.3) * 0.015;

    tailWave = walkPhase * 1.1;
    tailAmp = 0.038 + w * 0.028;
    cloth = 0.007 + w * 0.010;
  }

  // Mounted species gait enhancements (zero extra allocations)
  if (mounted) {
    const canonId = normalizePetId(petId);
    const effStyle = rideStyle
      || (canonId === 'pet_nyx' ? 'flight'
        : canonId === 'pet_kitsune' ? 'blink'
        : canonId === 'pet_skywhale' ? 'surf'
        : 'pounce');

    if (effStyle === 'flight' || canonId === 'pet_nyx') {
      // Majestic wyvern sky-flight: powerful sweeping wingbeats, aerodynamic breath surge, sinuous tail rudder sway
      wingFlap *= 1.38;
      breath += Math.sin(walkPhase) * 0.018;
      tailWave = walkPhase * 1.32;
      tailAmp *= 1.24;
    } else if (effStyle === 'blink' || canonId === 'pet_kitsune') {
      // Shrine-spirit fox dash: rapid floating stride, lush multi-tail figure-8 wave, alert fox-ear canting
      legL *= 1.28;
      legR *= 1.28;
      footLiftL *= 1.28;
      footLiftR *= 1.28;
      tailWave = walkPhase * 1.35;
      tailAmp *= 1.35;
      earFlutter += Math.cos(walkPhase - 0.35) * 0.026;
    } else if (effStyle === 'surf' || canonId === 'pet_skywhale') {
      // Celestial leviathan wave-carve: smooth undulating body wave, pectoral fin paddle, fluke tail sweep
      torso += Math.sin(walkPhase * 0.85) * 0.022;
      breath += Math.cos(walkPhase * 0.85) * 0.018;
      wingFlap *= 1.25;
      tailWave = walkPhase * 1.25;
      tailAmp *= 1.26;
    } else {
      // pet_ragdoll (pounce): elastic feline bounding stride, amplified paw reach, fluffy tail counterbalance wave, joyful ear flutter
      legL *= 1.32;
      legR *= 1.32;
      footLiftL *= 1.35;
      footLiftR *= 1.35;
      tailWave = walkPhase * 1.25;
      tailAmp *= 1.25;
      earFlutter += Math.sin(walkPhase - 0.4) * 0.024;
    }
  }

  // Special pose overrides (sleep, happy, cast, lifted)
  if (!mounted && pose === 'sleep') {
    legL = 0;
    legR = 0;
    wingFlap = 0;
    torso = Math.sin(t * 1.6) * 0.012;
    head = Math.sin(t * 1.6 - 0.4) * 0.016;
    breath = Math.sin(t * 2.0) * 0.030;
    tailWave = t * 2.0;
    tailAmp = 0.016;
    earFlutter = Math.sin(t * 1.6) * 0.010;
  } else if (pose === 'happy') {
    const cheer = Math.sin(t * 6.5);
    legL = cheer * 0.12;
    legR = -cheer * 0.12;
    head = Math.sin(t * 3.8) * 0.045;
    earFlutter = Math.sin(t * 6.5 - 0.4) * 0.045;
    wingFlap = Math.sin(t * 7.5) * 0.085;
    tailWave = t * 6.5;
    tailAmp = 0.052;
  } else if (pose === 'cast') {
    const pulse = Math.sin(t * 6.0);
    torso = -0.04 + pulse * 0.024;
    head = 0.03 + pulse * 0.024;
    wingFlap = 0.06 + pulse * 0.075;
    tailWave = t * 6.0;
    tailAmp = 0.055;
    earFlutter = pulse * 0.045;
  } else if (pose === 'lifted') {
    const dangle = Math.sin(t * 7.5);
    legL = dangle * 0.18;
    legR = -dangle * 0.18;
    head = Math.sin(t * 4.2) * 0.04;
    tailWave = t * 6.0;
    tailAmp = 0.048;
  }

  if (trick && trick.kind === 'ear_wiggle') {
    const k = Math.max(0, 1 - (trick.t || 0));
    earFlutter += Math.sin((trick.t || 0) * 24) * 0.10 * k;
    head += Math.sin((trick.t || 0) * 12) * 0.045 * k;
  }

  return {
    locoMode,
    viewMode,
    walkWeight: w,
    mirror: mirror >= 0 ? 1 : -1,
    legL,
    legR,
    footLiftL,
    footLiftR,
    torso,
    breath,
    head,
    earFlutter,
    wingFlap,
    tailWave,
    tailAmp,
    cloth,
    bobY,
    rollZ,
    scaleX,
    scaleY,
  };
}

/**
 * 7-Bone UV-Skinned GLSL Vertex Shader for 3D PetController (14x18 subdivided plane).
 * Evaluates in canonical facing space (`xFacing = (uv.x - 0.5) * uSize.x * uMirror`)
 * so left/right mirroring in the fragment shader keeps every anatomical bone aligned 1:1.
 */
export const PET_RIG_VERTEX_SHADER = /* glsl */ `
  uniform vec2 uSize;
  uniform float uMirror;
  uniform float uViewMode;   // 0 = front, 1 = side/move, 2 = back, 3 = action/sleep
  uniform float uLocoMode;   // 0 = HOP_WADDLE, 1 = FLY_FLUTTER, 2 = FLOAT_SPIRIT, 3 = SKY_SWIM
  uniform float uLegL;
  uniform float uLegR;
  uniform float uFootLiftL;
  uniform float uFootLiftR;
  uniform float uTorso;
  uniform float uBreath;
  uniform float uHead;
  uniform float uEarFlutter;
  uniform float uWingFlap;
  uniform float uTailWave;
  uniform float uTailAmp;
  uniform float uCloth;
  uniform float uTime;
  varying vec2 vUv;

  vec2 rot2d(vec2 p, vec2 pivot, float a) {
    vec2 d = p - pivot;
    float c = cos(a), s = sin(a);
    return pivot + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  }

  void main() {
    vUv = uv;
    float w = max(0.25, uSize.x);
    float h = max(0.25, uSize.y);

    // Euclidean metre coordinates with origin at bottom-center (0, 0)
    vec2 m = vec2((uv.x - 0.5) * w, uv.y * h);
    // Normalized facing X (-0.5..+0.5): + is ALWAYS the snout/facing side, - is ALWAYS the tail/trailing side
    float xNorm = (uv.x - 0.5) * uMirror;

    // -------------------------------------------------------------------------
    // BONE 1 & 2: PAW_L / PAW_R (Scissor-Step & Quadruped Stride with Foot-Lift)
    // -------------------------------------------------------------------------
    float pawBand = 1.0 - smoothstep(0.22, 0.34, uv.y);
    if (pawBand > 0.001 && uViewMode < 2.5) {
      float hipY = 0.28 * h;
      if (uViewMode > 0.5 && uViewMode < 1.5) {
        // Side / Move profile: xNorm > 0 is front paws, xNorm <= 0 is hind paws
        float isFrontPaw = smoothstep(-0.04, 0.06, xNorm);
        float frontPivotX = 0.14 * w * uMirror;
        float hindPivotX = -0.14 * w * uMirror;
        vec2 pFront = rot2d(m, vec2(frontPivotX, hipY), uLegR * uMirror);
        pFront.y += uFootLiftR * h * (1.0 - uv.y / 0.32);
        vec2 pHind = rot2d(m, vec2(hindPivotX, hipY), uLegL * uMirror);
        pHind.y += uFootLiftL * h * (1.0 - uv.y / 0.32);
        vec2 pMix = mix(pHind, pFront, isFrontPaw);
        m = mix(m, pMix, pawBand);
      } else {
        // Front / Back 3/4 view: left & right paws alternate scissor-stepping
        float isRightSide = smoothstep(-0.03, 0.03, uv.x - 0.5);
        float legPivotX = 0.13 * w;
        vec2 pL = rot2d(m, vec2(-legPivotX, hipY), uLegL * 0.65);
        pL.y += uFootLiftL * h * (1.0 - uv.y / 0.32);
        vec2 pR = rot2d(m, vec2( legPivotX, hipY), uLegR * 0.65);
        pR.y += uFootLiftR * h * (1.0 - uv.y / 0.32);
        m = mix(m, mix(pL, pR, isRightSide), pawBand);
      }
    }

    // -------------------------------------------------------------------------
    // BONE 7: TAIL & CAPE / FLUKE WAVE (Multi-Segment Travelling Sinusoid)
    // -------------------------------------------------------------------------
    if (uViewMode > 1.5 && uViewMode < 2.5) {
      // Back-3/4 view: tail/fluke is centered in lower-to-mid back (0.06..0.56) and swishes left-right!
      float backTailW = smoothstep(0.05, 0.16, uv.y) * (1.0 - smoothstep(0.48, 0.62, uv.y))
                      * (1.0 - smoothstep(0.18, 0.36, abs(xNorm)));
      float wave = sin(uTailWave - uv.y * 5.5);
      m.x += wave * uTailAmp * w * 1.15 * backTailW;
      m.y += cos(uTailWave * 2.0 - uv.y * 4.0) * uTailAmp * h * 0.35 * backTailW;
    } else {
      // Front / Side / Move views: tail is on the trailing side (xNorm < -0.06)
      float trailDist = clamp((-xNorm - 0.06) / 0.42, 0.0, 1.0);
      float tailBandY = smoothstep(0.10, 0.22, uv.y) * (1.0 - smoothstep(0.68, 0.82, uv.y));
      float tailW = trailDist * tailBandY;
      float wave = sin(uTailWave - trailDist * 4.8);
      m.y += wave * uTailAmp * h * (0.4 + 0.9 * trailDist) * tailW;
      m.x += cos(uTailWave - trailDist * 4.2) * uTailAmp * w * 0.35 * tailW * uMirror;
    }

    // Soft cape / ribbon hem wave (Ragdoll royal cape & Kitsune shrine ribbons)
    float hemBand = smoothstep(0.14, 0.24, uv.y) * (1.0 - smoothstep(0.44, 0.56, uv.y));
    m.x += sin(uTime * 3.4 - uv.y * 8.5) * uCloth * w * hemBand;

    // -------------------------------------------------------------------------
    // BONE 6: WINGS (3D Aerodynamic Wing-Beat for Nyx & Fin-Lift for Sky Whale)
    // -------------------------------------------------------------------------
    if (abs(uWingFlap) > 0.001) {
      float wingY = smoothstep(0.32, 0.46, uv.y) * (1.0 - smoothstep(0.78, 0.90, uv.y));
      if (uViewMode > 1.5 && uViewMode < 2.5) {
        // Back view: BOTH left and right wings spread out laterally (abs(xNorm) > 0.10)
        float spanDist = clamp((abs(xNorm) - 0.08) / 0.38, 0.0, 1.0);
        float wingW = wingY * spanDist;
        m.y += uWingFlap * h * (0.45 + 0.85 * spanDist) * wingW;
        m.x += sign(uv.x - 0.5) * uWingFlap * w * 0.38 * spanDist * wingW;
      } else {
        // Side / Move / Front views: wing arches upward and behind torso (xNorm < 0.10)
        float dorsalDist = clamp((0.10 - xNorm) / 0.44, 0.0, 1.0);
        float wingW = wingY * dorsalDist;
        m.y += uWingFlap * h * (0.40 + 0.80 * dorsalDist) * wingW;
        m.x -= uWingFlap * w * 0.25 * dorsalDist * wingW * uMirror;
      }
    }

    // -------------------------------------------------------------------------
    // BONE 4 & 5: HEAD (Neck Counter-Tilt) & EARS_CREST (Secondary Lag & Twitch)
    // -------------------------------------------------------------------------
    float neckY = 0.46 * h;
    float neckX = (uViewMode > 0.5 && uViewMode < 1.5) ? (0.10 * w * uMirror) : 0.0;
    float headRegionX = (uViewMode > 0.5 && uViewMode < 1.5)
      ? smoothstep(-0.12, 0.08, xNorm)
      : 1.0;
    float headW = smoothstep(0.42, 0.55, uv.y) * headRegionX;
    m = mix(m, rot2d(m, vec2(neckX, neckY), (uHead - uTorso * 0.55) * uMirror), headW);

    // Upper ear / horn / frill / crown tip flutter
    float earW = smoothstep(0.72, 0.86, uv.y) * headRegionX;
    m.x += uEarFlutter * w * 0.45 * earW * uMirror;
    m.y += abs(uEarFlutter) * h * 0.18 * earW;

    // -------------------------------------------------------------------------
    // BONE 3: TORSO (Chest Breathing, Gait Pitch & Flight Banking)
    // -------------------------------------------------------------------------
    float waistY = 0.26 * h;
    float torsoW = smoothstep(0.18, 0.30, uv.y);
    vec2 tp = m;
    tp.y = waistY + (tp.y - waistY) * (1.0 + uBreath);
    tp = rot2d(tp, vec2(0.0, waistY), uTorso * uMirror);
    m = mix(m, tp, torsoW);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(m.x / w, m.y / h, 0.0, 1.0);
  }
`;

/**
 * Fragment shader for 3D PetController:
 *  - Mirrors in UV space (`uMirror`) so geometry pivots and normals stay right-handed
 *  - Applies warm Tree-of-Savior storybook rim light (`uRim`)
 *  - Applies ★2/★3 holographic starlight shimmer band (`uShimmer`)
 */
export const PET_RIG_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uMirror;
  uniform vec3 uTint;
  uniform float uShimmer;
  uniform float uRim;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vec2(uMirror > 0.0 ? vUv.x : 1.0 - vUv.x, vUv.y);
    vec4 tex = texture2D(uMap, uv);
    if (tex.a < 0.06) discard;
    vec3 col = tex.rgb * uTint;
    float rim = smoothstep(0.52, 0.98, uv.y) * uRim;
    col += vec3(1.0, 0.85, 0.62) * rim * 0.08;
    if (uShimmer > 0.01) {
      float diag = uv.x * 0.85 + uv.y * 1.15;
      float wave = sin(diag * 7.0 - uTime * 2.8);
      float band = smoothstep(0.75, 0.99, wave);
      vec3 glowCol = mix(vec3(1.0, 0.92, 0.68), vec3(0.78, 0.94, 1.0), 0.5 + 0.5 * sin(uTime * 1.9 + uv.y * 4.0));
      col = mix(col, col + glowCol * 0.38, band * uShimmer);
    }
    gl_FragColor = vec4(col, tex.a);
  }
`;
