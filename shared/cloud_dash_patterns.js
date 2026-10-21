// shared/cloud_dash_patterns.js — Obstacle & reward pattern library for Sky Cloud Dash V2.
// Pure data module for 3-lane race track generation (lanes: -1 left, 0 center, +1 right).
// Conforms to CLOUD_DASH_V2.md sections 3, 7.

export const PATTERN_ITEM_TYPES = ['coin', 'berry', 'star', 'orb', 'cloud', 'pad', 'pit'];

/**
 * Validates a single pattern object against Cloud Dash fairness and structure rules.
 * @param {object} p - Pattern object
 * @returns {string[]} Array of error messages, empty if valid
 */
export function validatePattern(p) {
  const errors = [];
  if (!p || typeof p !== 'object') {
    return ['Pattern must be an object'];
  }

  // 1. Basic properties
  if (typeof p.id !== 'string' || !p.id.trim()) {
    errors.push('Pattern id must be a non-empty string');
  }

  if (!Array.isArray(p.zones) || p.zones.length === 0) {
    errors.push('Pattern zones must be a non-empty array');
  } else {
    for (const z of p.zones) {
      if (![1, 2, 3, 4].includes(z)) {
        errors.push(`Pattern zone must be 1, 2, 3, or 4 (got ${z})`);
      }
    }
    const lowestZone = Math.min(...p.zones);
    if (typeof p.id === 'string' && !p.id.startsWith(`z${lowestZone}_`)) {
      errors.push(`Pattern id '${p.id}' must start with 'z${lowestZone}_' matching lowest zone`);
    }
  }

  if (![1, 2, 3].includes(p.difficulty)) {
    errors.push(`Difficulty must be 1, 2, or 3 (got ${p.difficulty})`);
  }

  if (typeof p.length !== 'number' || p.length < 25 || p.length > 60) {
    errors.push(`Length must be between 25 and 60 (got ${p.length})`);
  }

  if (!Array.isArray(p.items)) {
    errors.push('Pattern items must be an array');
    return errors;
  }

  // 2. Item-level checks & counts
  let starCount = 0;
  let orbCount = 0;
  const pits = [];
  const clouds = [];

  p.items.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Item #${idx} must be an object`);
      return;
    }
    if (!PATTERN_ITEM_TYPES.includes(item.t)) {
      errors.push(`Item #${idx} has invalid type '${item.t}'`);
    }
    if (typeof item.d !== 'number' || item.d < 0 || (typeof p.length === 'number' && item.d >= p.length)) {
      errors.push(`Item #${idx} (${item.t}) d=${item.d} must be in [0, length)`);
    }
    if (![-1, 0, 1].includes(item.lane)) {
      errors.push(`Item #${idx} (${item.t}) lane=${item.lane} must be -1, 0, or 1`);
    }
    if (item.y !== undefined) {
      if (typeof item.y !== 'number' || item.y < 0 || item.y > 2.6) {
        errors.push(`Item #${idx} (${item.t}) y=${item.y} must be in [0, 2.6]`);
      }
    }

    if (item.t === 'star') starCount++;
    if (item.t === 'orb') orbCount++;
    if (item.t === 'cloud') clouds.push(item);
    if (item.t === 'pit') pits.push(item);
  });

  if (starCount > 2) {
    errors.push(`At most 2 stars allowed per pattern (found ${starCount})`);
  }
  if (orbCount > 1) {
    errors.push(`At most 1 orb allowed per pattern (found ${orbCount})`);
  }
  if (orbCount > 0 && p.difficulty < 2) {
    errors.push(`Orb is only allowed in difficulty >= 2 patterns (got difficulty ${p.difficulty})`);
  }

  // 3. Pit-specific rules
  for (const pit of pits) {
    if (typeof pit.len !== 'number' || pit.len < 4 || pit.len > 9) {
      errors.push(`Pit at d=${pit.d} len=${pit.len} must be in [4, 9]`);
    }
    if (Array.isArray(p.zones) && p.zones.includes(1)) {
      errors.push(`Pit at d=${pit.d} not allowed in zone 1 (pits only allowed in zones 2, 3, 4)`);
    }
    if (typeof p.length === 'number' && pit.d + (pit.len || 0) > p.length) {
      errors.push(`Pit at d=${pit.d} len=${pit.len} exceeds pattern length ${p.length}`);
    }

    const pitEnd = pit.d + (pit.len || 0);

    // Never put clouds within 6m before a pit or 4m after (landing zone)
    for (const cloud of clouds) {
      if (cloud.d < pit.d && (pit.d - cloud.d) < 6 - 1e-6) {
        errors.push(`Cloud at d=${cloud.d} is within 6m before pit at d=${pit.d} (dist: ${(pit.d - cloud.d).toFixed(2)}m)`);
      } else if (cloud.d >= pitEnd && (cloud.d - pitEnd) < 4 - 1e-6) {
        errors.push(`Cloud at d=${cloud.d} is within 4m after pit landing at d=${pitEnd} (dist: ${(cloud.d - pitEnd).toFixed(2)}m)`);
      } else if (cloud.d >= pit.d && cloud.d < pitEnd) {
        errors.push(`Cloud at d=${cloud.d} cannot be placed inside pit [${pit.d}, ${pitEnd})`);
      }
    }

    // Must have a coin arc over pit (at least one coin with y >= 1.2 within pit span)
    const arcCoins = p.items.filter(it => it.t === 'coin' && it.d >= pit.d && it.d <= pitEnd && (it.y || 0) >= 1.2);
    if (arcCoins.length === 0) {
      errors.push(`Pit at d=${pit.d} must have a coin arc over it with y >= 1.2`);
    }

    // No coins or items at y < 1.2 inside pit span
    for (const it of p.items) {
      if (it !== pit && it.d >= pit.d && it.d <= pitEnd) {
        const yVal = it.y !== undefined ? it.y : 0;
        if (yVal < 1.2) {
          errors.push(`Item '${it.t}' at d=${it.d} inside pit [${pit.d}, ${pitEnd}] has y=${yVal} < 1.2`);
        }
      }
    }
  }

  // 4. Fairness Rule 1: At any d, clouds must never occupy all 3 lanes within 3m window
  for (const c1 of clouds) {
    const inWindow = clouds.filter(c => c.d >= c1.d && c.d <= c1.d + 3.0 + 1e-6);
    const blockedLanes = new Set(inWindow.map(c => c.lane));
    if (blockedLanes.size >= 3) {
      errors.push(`Clouds occupy all 3 lanes within 3m window starting at d=${c1.d}`);
    }
  }

  // 5. Fairness Rule 2: Consecutive obstacles (cloud/pit) spacing
  // Diff 1: >= 8m, Diff 2: >= 6m, Diff 3: >= 4.5m (measure by d, any lane)
  const minGap = p.difficulty === 1 ? 8 : (p.difficulty === 2 ? 6 : 4.5);
  const obstacles = p.items
    .filter(it => it.t === 'cloud' || it.t === 'pit')
    .slice()
    .sort((a, b) => a.d - b.d);

  for (let i = 0; i < obstacles.length - 1; i++) {
    const o1 = obstacles[i];
    const o2 = obstacles[i + 1];
    const gap = o2.d - o1.d;
    if (gap < minGap - 1e-6) {
      errors.push(`Consecutive obstacles (${o1.t} at d=${o1.d}, ${o2.t} at d=${o2.d}) are closer than ${minGap}m (diff ${p.difficulty}, gap=${gap.toFixed(2)}m)`);
    }
    if (o1.t === 'pit') {
      const pitEnd = o1.d + o1.len;
      const minAfterPit = o2.t === 'cloud' ? 4 : minGap;
      if (o2.d - pitEnd < minAfterPit - 1e-6) {
        errors.push(`Obstacle at d=${o2.d} is too close to end of pit at d=${pitEnd} (< ${minAfterPit}m)`);
      }
    }
  }

  // 6. Fairness Rule 3: Items must not overlap (no two items with same lane within 1.2m d)
  // Pits exempt as they span all lanes (ground items inside pit already validated).
  // Jump arcs / airborne items over cloud hurdles (y >= 1.2) are allowed.
  const laneItems = p.items.filter(it => it.t !== 'pit');
  for (let i = 0; i < laneItems.length; i++) {
    for (let j = i + 1; j < laneItems.length; j++) {
      const a = laneItems[i];
      const b = laneItems[j];
      if (a.lane === b.lane) {
        const dist = Math.abs(a.d - b.d);
        if (dist < 1.2 - 1e-6) {
          const isArcOverCloud =
            (a.t === 'cloud' && (b.y || 0) >= 1.2) ||
            (b.t === 'cloud' && (a.y || 0) >= 1.2);
          if (!isArcOverCloud) {
            errors.push(`Items overlap in lane ${a.lane}: '${a.t}' (d=${a.d}) and '${b.t}' (d=${b.d}), dist=${dist.toFixed(2)}m < 1.2m`);
          }
        }
      }
    }
  }

  return errors;
}

export const DASH_PATTERNS = [
  // =========================================================================
  // Section 1: Zone 1 Patterns (Difficulty 1, 8 patterns)
  // Introductory density, smooth jelly ribbons, gentle lane weaves, single clouds
  // =========================================================================

  // Pattern 1: Straight center coin ribbon with tutorial speed pad and berry reward.
  {
    id: 'z1_straight_ribbon_intro',
    zones: [1, 2],
    difficulty: 1,
    length: 35,
    items: [
      { t: 'coin', d: 0.0, lane: 0 },
      { t: 'coin', d: 2.5, lane: 0 },
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'coin', d: 10.0, lane: 0 },
      { t: 'pad', d: 15.0, lane: 0 },
      { t: 'coin', d: 20.0, lane: 0 },
      { t: 'coin', d: 22.5, lane: 0 },
      { t: 'coin', d: 25.0, lane: 0 },
      { t: 'coin', d: 27.5, lane: 0 },
      { t: 'berry', d: 30.0, lane: 0 },
    ],
  },

  // Pattern 2: Gentle S-curve ribbon weaving from left lane to right lane.
  {
    id: 'z1_gentle_weave_lr',
    zones: [1, 2],
    difficulty: 1,
    length: 40,
    items: [
      { t: 'coin', d: 2.5, lane: -1 },
      { t: 'coin', d: 5.0, lane: -1 },
      { t: 'coin', d: 7.5, lane: -1 },
      { t: 'coin', d: 12.5, lane: 0 },
      { t: 'coin', d: 15.0, lane: 0 },
      { t: 'coin', d: 17.5, lane: 0 },
      { t: 'coin', d: 22.5, lane: 1 },
      { t: 'coin', d: 25.0, lane: 1 },
      { t: 'coin', d: 27.5, lane: 1 },
      { t: 'berry', d: 32.5, lane: 1 },
    ],
  },

  // Pattern 3: Single cloud hurdle in center lane with coins guiding safe left bypass.
  {
    id: 'z1_single_cloud_dodge_center',
    zones: [1, 2],
    difficulty: 1,
    length: 35,
    items: [
      { t: 'coin', d: 2.5, lane: 0 },
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 10.0, lane: -1 },
      { t: 'coin', d: 12.5, lane: -1 },
      { t: 'cloud', d: 15.0, lane: 0 },
      { t: 'coin', d: 15.0, lane: -1 },
      { t: 'coin', d: 17.5, lane: -1 },
      { t: 'berry', d: 22.5, lane: -1 },
      { t: 'coin', d: 27.5, lane: 0 },
      { t: 'coin', d: 30.0, lane: 0 },
    ],
  },

  // Pattern 4: Single cloud hurdle in center lane with a 3-coin jump arc over it.
  {
    id: 'z1_single_cloud_jump_arc',
    zones: [1, 2],
    difficulty: 1,
    length: 35,
    items: [
      { t: 'coin', d: 2.5, lane: 0 },
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'coin', d: 12.5, lane: 0, y: 1.2 },
      { t: 'cloud', d: 15.0, lane: 0 },
      { t: 'coin', d: 15.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 17.5, lane: 0, y: 1.2 },
      { t: 'pad', d: 25.0, lane: 0 },
      { t: 'coin', d: 28.5, lane: 0 },
      { t: 'coin', d: 31.0, lane: 0 },
    ],
  },

  // Pattern 5: Cloud in left lane, coin ribbon weaving safely through right lane.
  {
    id: 'z1_side_cloud_weave',
    zones: [1, 2],
    difficulty: 1,
    length: 35,
    items: [
      { t: 'coin', d: 5.0, lane: 1 },
      { t: 'coin', d: 7.5, lane: 1 },
      { t: 'coin', d: 10.0, lane: 1 },
      { t: 'coin', d: 12.5, lane: 1 },
      { t: 'cloud', d: 14.0, lane: -1 },
      { t: 'coin', d: 15.0, lane: 1 },
      { t: 'coin', d: 17.5, lane: 1 },
      { t: 'coin', d: 20.0, lane: 1 },
      { t: 'berry', d: 25.0, lane: 1 },
      { t: 'coin', d: 28.5, lane: 0 },
      { t: 'coin', d: 31.0, lane: 0 },
    ],
  },

  // Pattern 6: Speed pad into a long straightaway coin ribbon ending in a star.
  {
    id: 'z1_pad_dash_sprint',
    zones: [1, 2],
    difficulty: 1,
    length: 40,
    items: [
      { t: 'coin', d: 2.5, lane: 0 },
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'pad', d: 12.5, lane: 0 },
      { t: 'coin', d: 17.5, lane: 0 },
      { t: 'coin', d: 20.0, lane: 0 },
      { t: 'coin', d: 22.5, lane: 0 },
      { t: 'coin', d: 25.0, lane: 0 },
      { t: 'coin', d: 27.5, lane: 0 },
      { t: 'coin', d: 30.0, lane: 0 },
      { t: 'star', d: 35.0, lane: 0 },
    ],
  },

  // Pattern 7: Split path offering safe coin lane on left or pad boost on right.
  {
    id: 'z1_wide_split_choice',
    zones: [1, 2],
    difficulty: 1,
    length: 36,
    items: [
      { t: 'coin', d: 2.5, lane: 0 },
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 10.0, lane: -1 },
      { t: 'coin', d: 12.5, lane: -1 },
      { t: 'pad', d: 12.5, lane: 1 },
      { t: 'cloud', d: 15.0, lane: 0 },
      { t: 'coin', d: 15.0, lane: -1 },
      { t: 'coin', d: 17.5, lane: -1 },
      { t: 'coin', d: 20.0, lane: 1 },
      { t: 'coin', d: 22.5, lane: 1 },
      { t: 'berry', d: 22.5, lane: -1 },
      { t: 'coin', d: 28.0, lane: 0 },
      { t: 'coin', d: 30.5, lane: 0 },
    ],
  },

  // Pattern 8: Two clouds well-spaced (12m apart) with coin weave between them.
  {
    id: 'z1_double_cloud_spaced',
    zones: [1, 2],
    difficulty: 1,
    length: 45,
    items: [
      { t: 'coin', d: 5.0, lane: 1 },
      { t: 'coin', d: 7.5, lane: 1 },
      { t: 'coin', d: 10.0, lane: 1 },
      { t: 'cloud', d: 12.0, lane: -1 },
      { t: 'coin', d: 12.5, lane: 1 },
      { t: 'coin', d: 17.0, lane: 0 },
      { t: 'coin', d: 19.5, lane: 0 },
      { t: 'cloud', d: 24.0, lane: 1 },
      { t: 'coin', d: 24.0, lane: -1 },
      { t: 'coin', d: 26.5, lane: -1 },
      { t: 'coin', d: 29.0, lane: -1 },
      { t: 'pad', d: 36.0, lane: 0 },
      { t: 'coin', d: 40.0, lane: 0 },
    ],
  },

  // =========================================================================
  // Section 2: Zone 1-2 Patterns (Difficulty 1-2, 8 patterns)
  // Double-cloud chicanes, jump arcs, and short pits (zone 2 only)
  // =========================================================================

  // Pattern 9: Two-cloud chicane forcing a left-to-right dodge.
  {
    id: 'z1_cloud_chicane_lr',
    zones: [1, 2],
    difficulty: 2,
    length: 40,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'cloud', d: 12.0, lane: -1 },
      { t: 'coin', d: 12.0, lane: 1 },
      { t: 'coin', d: 16.0, lane: 0 },
      { t: 'cloud', d: 20.0, lane: 1 },
      { t: 'coin', d: 20.0, lane: -1 },
      { t: 'coin', d: 24.0, lane: -1 },
      { t: 'pad', d: 30.0, lane: 0 },
      { t: 'berry', d: 34.0, lane: 0 },
    ],
  },

  // Pattern 10: Two clouds in center lane each with a coin jump arc over it.
  {
    id: 'z1_cloud_jump_double_arc',
    zones: [1, 2],
    difficulty: 2,
    length: 42,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'coin', d: 9.5, lane: 0, y: 1.2 },
      { t: 'cloud', d: 12.0, lane: 0 },
      { t: 'coin', d: 12.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 14.5, lane: 0, y: 1.2 },
      { t: 'coin', d: 19.5, lane: 0, y: 1.2 },
      { t: 'cloud', d: 22.0, lane: 0 },
      { t: 'coin', d: 22.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 24.5, lane: 0, y: 1.2 },
      { t: 'pad', d: 31.0, lane: 0 },
      { t: 'coin', d: 35.0, lane: 0 },
      { t: 'coin', d: 37.5, lane: 0 },
    ],
  },

  // Pattern 11: Center cloud followed by outer cloud chicane with berry reward.
  {
    id: 'z1_cloud_chicane_center_split',
    zones: [1, 2],
    difficulty: 2,
    length: 40,
    items: [
      { t: 'coin', d: 5.0, lane: 1 },
      { t: 'coin', d: 7.5, lane: 1 },
      { t: 'cloud', d: 10.0, lane: 0 },
      { t: 'coin', d: 10.0, lane: 1 },
      { t: 'coin', d: 12.5, lane: 1 },
      { t: 'coin', d: 16.0, lane: 1 },
      { t: 'cloud', d: 18.0, lane: -1 },
      { t: 'coin', d: 18.5, lane: 1 },
      { t: 'coin', d: 21.0, lane: 1 },
      { t: 'berry', d: 25.0, lane: 1 },
      { t: 'pad', d: 30.0, lane: 0 },
      { t: 'coin', d: 34.0, lane: 0 },
    ],
  },

  // Pattern 12: Cloud hurdle with a high-risk Ult Orb suspended directly above it.
  {
    id: 'z1_cloud_arc_with_orb',
    zones: [1, 2],
    difficulty: 2,
    length: 38,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'coin', d: 10.0, lane: 0 },
      { t: 'coin', d: 12.5, lane: 0, y: 1.3 },
      { t: 'cloud', d: 15.0, lane: 0 },
      { t: 'orb', d: 15.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 17.5, lane: 0, y: 1.3 },
      { t: 'coin', d: 22.5, lane: 0 },
      { t: 'coin', d: 25.0, lane: 0 },
      { t: 'berry', d: 30.0, lane: 0 },
    ],
  },

  // Pattern 13: Cloud on right lane, long coin ribbon in center leading to speed pad.
  {
    id: 'z1_cloud_flank_sprint',
    zones: [1, 2],
    difficulty: 1,
    length: 40,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'coin', d: 10.0, lane: 0 },
      { t: 'coin', d: 12.5, lane: 0 },
      { t: 'coin', d: 15.0, lane: 0 },
      { t: 'cloud', d: 16.0, lane: 1 },
      { t: 'coin', d: 17.5, lane: 0 },
      { t: 'coin', d: 20.0, lane: 0 },
      { t: 'pad', d: 25.0, lane: 0 },
      { t: 'berry', d: 32.0, lane: 0 },
    ],
  },

  // Pattern 14: Basic 4m pit jump with smooth coin arc and clean landing zone.
  {
    id: 'z2_short_pit_intro',
    zones: [2],
    difficulty: 1,
    length: 40,
    items: [
      { t: 'coin', d: 6.0, lane: 0 },
      { t: 'coin', d: 8.5, lane: 0 },
      { t: 'coin', d: 11.0, lane: 0 },
      { t: 'coin', d: 13.5, lane: 0 },
      { t: 'pit', d: 16.0, lane: 0, len: 4 },
      { t: 'coin', d: 16.0, lane: 0, y: 1.4 },
      { t: 'coin', d: 18.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 20.0, lane: 0, y: 1.4 },
      { t: 'coin', d: 23.0, lane: 0 },
      { t: 'coin', d: 25.5, lane: 0 },
      { t: 'coin', d: 28.0, lane: 0 },
      { t: 'berry', d: 33.0, lane: 0 },
    ],
  },

  // Pattern 15: Speed pad into 5m pit jump with coin arc and star reward.
  {
    id: 'z2_short_pit_pad_launch',
    zones: [2, 3],
    difficulty: 2,
    length: 45,
    items: [
      { t: 'pad', d: 8.0, lane: 0 },
      { t: 'coin', d: 12.0, lane: 0 },
      { t: 'coin', d: 14.5, lane: 0 },
      { t: 'pit', d: 18.0, lane: 0, len: 5 },
      { t: 'coin', d: 18.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 20.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 23.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 26.5, lane: 0 },
      { t: 'coin', d: 29.0, lane: 0 },
      { t: 'coin', d: 31.5, lane: 0 },
      { t: 'star', d: 36.5, lane: 0 },
    ],
  },

  // Pattern 16: 5m pit jump followed after safe landing distance by a center cloud.
  {
    id: 'z2_short_pit_cloud_follow',
    zones: [2],
    difficulty: 2,
    length: 48,
    items: [
      { t: 'coin', d: 6.0, lane: 0 },
      { t: 'coin', d: 8.5, lane: 0 },
      { t: 'coin', d: 11.0, lane: 0 },
      { t: 'pit', d: 14.0, lane: 0, len: 5 },
      { t: 'coin', d: 14.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 16.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 19.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 22.0, lane: 1 },
      { t: 'coin', d: 24.5, lane: 1 },
      { t: 'cloud', d: 25.0, lane: 0 },
      { t: 'coin', d: 27.0, lane: 1 },
      { t: 'berry', d: 33.0, lane: 1 },
      { t: 'pad', d: 39.0, lane: 0 },
    ],
  },

  // =========================================================================
  // Section 3: Zone 2-3 Patterns (Difficulty 2, 7 patterns)
  // Pits with glide (len 7..9), zig-zag clouds, and orb risk spots
  // =========================================================================

  // Pattern 17: Long 7m chasm requiring jump and glide, guided by a high coin arc.
  {
    id: 'z2_glide_pit_classic',
    zones: [2, 3],
    difficulty: 2,
    length: 50,
    items: [
      { t: 'coin', d: 6.0, lane: 0 },
      { t: 'coin', d: 8.5, lane: 0 },
      { t: 'coin', d: 11.0, lane: 0 },
      { t: 'coin', d: 13.5, lane: 0 },
      { t: 'pit', d: 16.0, lane: 0, len: 7 },
      { t: 'coin', d: 16.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 18.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 20.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 23.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 26.5, lane: 0 },
      { t: 'coin', d: 29.0, lane: 0 },
      { t: 'coin', d: 31.5, lane: 0 },
      { t: 'pad', d: 37.0, lane: 0 },
      { t: 'berry', d: 42.0, lane: 0 },
    ],
  },

  // Pattern 18: 8m chasm with mid-air star reward at the apex of the glide.
  {
    id: 'z2_glide_pit_8m_star',
    zones: [2, 3],
    difficulty: 2,
    length: 54,
    items: [
      { t: 'coin', d: 8.0, lane: 0 },
      { t: 'coin', d: 10.5, lane: 0 },
      { t: 'coin', d: 13.0, lane: 0 },
      { t: 'coin', d: 15.5, lane: 0 },
      { t: 'pit', d: 18.0, lane: 0, len: 8 },
      { t: 'coin', d: 18.0, lane: 0, y: 1.4 },
      { t: 'coin', d: 20.5, lane: 0, y: 1.8 },
      { t: 'star', d: 22.0, lane: 0, y: 2.1 },
      { t: 'coin', d: 23.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 26.0, lane: 0, y: 1.4 },
      { t: 'coin', d: 29.5, lane: 0 },
      { t: 'coin', d: 32.0, lane: 0 },
      { t: 'coin', d: 34.5, lane: 0 },
      { t: 'pad', d: 42.0, lane: 0 },
      { t: 'berry', d: 47.0, lane: 0 },
    ],
  },

  // Pattern 19: Triple zig-zag clouds (-1, 0, 1) spaced 7m apart with slalom coin ribbon.
  {
    id: 'z2_zigzag_clouds_triple',
    zones: [2, 3],
    difficulty: 2,
    length: 48,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'cloud', d: 12.0, lane: -1 },
      { t: 'coin', d: 12.0, lane: 1 },
      { t: 'coin', d: 14.5, lane: 1 },
      { t: 'cloud', d: 19.0, lane: 0 },
      { t: 'coin', d: 19.0, lane: -1 },
      { t: 'cloud', d: 26.0, lane: 1 },
      { t: 'coin', d: 24.0, lane: -1 },
      { t: 'coin', d: 26.5, lane: -1 },
      { t: 'pad', d: 34.0, lane: 0 },
      { t: 'berry', d: 39.0, lane: 0 },
    ],
  },

  // Pattern 20: Alternating outer lane clouds (lane -1 then lane 1) with center sprint.
  {
    id: 'z2_zigzag_clouds_outer_weave',
    zones: [2, 3],
    difficulty: 2,
    length: 46,
    items: [
      { t: 'coin', d: 6.0, lane: 0 },
      { t: 'coin', d: 8.5, lane: 0 },
      { t: 'coin', d: 11.0, lane: 0 },
      { t: 'cloud', d: 14.0, lane: -1 },
      { t: 'coin', d: 13.5, lane: 0 },
      { t: 'coin', d: 16.0, lane: 0 },
      { t: 'coin', d: 18.5, lane: 0 },
      { t: 'coin', d: 21.0, lane: 0 },
      { t: 'cloud', d: 22.0, lane: 1 },
      { t: 'coin', d: 23.5, lane: 0 },
      { t: 'pad', d: 30.0, lane: 0 },
      { t: 'berry', d: 36.0, lane: 0 },
    ],
  },

  // Pattern 21: Cloud hurdle with Ult Orb at peak jump height and pad reward after.
  {
    id: 'z2_cloud_orb_temptation',
    zones: [2, 3],
    difficulty: 2,
    length: 42,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'coin', d: 10.0, lane: 0 },
      { t: 'coin', d: 13.5, lane: 0, y: 1.3 },
      { t: 'cloud', d: 16.0, lane: 0 },
      { t: 'orb', d: 16.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 18.5, lane: 0, y: 1.3 },
      { t: 'pad', d: 26.0, lane: 0 },
      { t: 'coin', d: 30.0, lane: 0 },
      { t: 'coin', d: 32.5, lane: 0 },
      { t: 'coin', d: 35.0, lane: 0 },
    ],
  },

  // Pattern 22: 7m glide pit with an Ult Orb placed high in the arc over the chasm.
  {
    id: 'z2_pit_glide_orb_risk',
    zones: [2, 3],
    difficulty: 2,
    length: 52,
    items: [
      { t: 'coin', d: 6.0, lane: 0 },
      { t: 'coin', d: 8.5, lane: 0 },
      { t: 'coin', d: 11.0, lane: 0 },
      { t: 'coin', d: 13.5, lane: 0 },
      { t: 'pit', d: 16.0, lane: 0, len: 7 },
      { t: 'coin', d: 16.0, lane: 0, y: 1.3 },
      { t: 'orb', d: 19.5, lane: 0, y: 1.9 },
      { t: 'coin', d: 23.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 27.0, lane: 0 },
      { t: 'coin', d: 29.5, lane: 0 },
      { t: 'coin', d: 32.0, lane: 0 },
      { t: 'pad', d: 38.0, lane: 0 },
      { t: 'berry', d: 43.0, lane: 0 },
    ],
  },

  // Pattern 23: Early cloud hurdle followed by safe transition into a 6m pit jump.
  {
    id: 'z2_cloud_into_pit_sequence',
    zones: [2, 3],
    difficulty: 2,
    length: 52,
    items: [
      { t: 'coin', d: 5.0, lane: 1 },
      { t: 'coin', d: 7.5, lane: 1 },
      { t: 'cloud', d: 10.0, lane: 0 },
      { t: 'coin', d: 10.0, lane: 1 },
      { t: 'coin', d: 12.5, lane: 1 },
      { t: 'coin', d: 15.0, lane: 0 },
      { t: 'coin', d: 17.5, lane: 0 },
      { t: 'pit', d: 20.0, lane: 0, len: 6 },
      { t: 'coin', d: 20.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 23.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 26.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 30.0, lane: 0 },
      { t: 'coin', d: 32.5, lane: 0 },
      { t: 'pad', d: 38.0, lane: 0 },
      { t: 'berry', d: 43.0, lane: 0 },
    ],
  },

  // =========================================================================
  // Section 4: Zone 3-4 Patterns (Difficulty 2-3, 7 patterns)
  // Dense chicanes, pit + chicane combos, pad chains, and star rewards
  // =========================================================================

  // Pattern 24: Dense 3-cloud chicane spaced 5m apart requiring rapid lane changes.
  {
    id: 'z3_dense_chicane_sprint',
    zones: [3, 4],
    difficulty: 3,
    length: 45,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'cloud', d: 10.0, lane: -1 },
      { t: 'coin', d: 10.0, lane: 1 },
      { t: 'cloud', d: 15.0, lane: 1 },
      { t: 'coin', d: 15.0, lane: -1 },
      { t: 'cloud', d: 20.0, lane: 0 },
      { t: 'coin', d: 20.0, lane: 1 },
      { t: 'coin', d: 24.0, lane: 1 },
      { t: 'pad', d: 29.0, lane: 0 },
      { t: 'star', d: 36.0, lane: 0 },
    ],
  },

  // Pattern 25: Fast alternating clouds at 5.5m spacing with an Ult Orb at the exit.
  {
    id: 'z3_dense_chicane_double_dodge',
    zones: [3, 4],
    difficulty: 3,
    length: 42,
    items: [
      { t: 'coin', d: 5.5, lane: 1 },
      { t: 'coin', d: 8.0, lane: 1 },
      { t: 'cloud', d: 11.0, lane: 0 },
      { t: 'coin', d: 11.0, lane: 1 },
      { t: 'cloud', d: 16.5, lane: -1 },
      { t: 'coin', d: 16.5, lane: 0 },
      { t: 'cloud', d: 22.0, lane: 1 },
      { t: 'coin', d: 22.0, lane: -1 },
      { t: 'orb', d: 27.5, lane: -1 },
      { t: 'pad', d: 33.0, lane: 0 },
      { t: 'berry', d: 37.0, lane: 0 },
    ],
  },

  // Pattern 26: 6m pit jump immediately followed by a tight 2-cloud chicane.
  {
    id: 'z3_pit_chicane_combo',
    zones: [3, 4],
    difficulty: 3,
    length: 52,
    items: [
      { t: 'coin', d: 5.0, lane: 0 },
      { t: 'coin', d: 7.5, lane: 0 },
      { t: 'pit', d: 12.0, lane: 0, len: 6 },
      { t: 'coin', d: 12.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 15.0, lane: 0, y: 1.8 },
      { t: 'coin', d: 18.0, lane: 0, y: 1.3 },
      { t: 'cloud', d: 23.0, lane: -1 },
      { t: 'coin', d: 23.0, lane: 1 },
      { t: 'cloud', d: 28.0, lane: 1 },
      { t: 'coin', d: 28.0, lane: -1 },
      { t: 'pad', d: 35.0, lane: 0 },
      { t: 'star', d: 42.0, lane: 0 },
    ],
  },

  // Pattern 27: Chained speed pads rewarding clean lane changes between spaced hurdles.
  {
    id: 'z3_pad_chain_overdrive',
    zones: [3, 4],
    difficulty: 2,
    length: 46,
    items: [
      { t: 'pad', d: 6.0, lane: -1 },
      { t: 'coin', d: 11.0, lane: 0 },
      { t: 'cloud', d: 14.0, lane: -1 },
      { t: 'coin', d: 13.5, lane: 0 },
      { t: 'coin', d: 16.0, lane: 0 },
      { t: 'pad', d: 21.0, lane: 1 },
      { t: 'coin', d: 26.0, lane: 0 },
      { t: 'cloud', d: 28.0, lane: 1 },
      { t: 'coin', d: 28.5, lane: 0 },
      { t: 'pad', d: 34.0, lane: 0 },
      { t: 'berry', d: 40.0, lane: 0 },
    ],
  },

  // Pattern 28: Cloud hurdle, clean entry into 7m glide pit, safe landing into star.
  {
    id: 'z3_glide_pit_flank_clouds',
    zones: [3, 4],
    difficulty: 3,
    length: 56,
    items: [
      { t: 'coin', d: 4.0, lane: 0 },
      { t: 'cloud', d: 8.0, lane: 0 },
      { t: 'coin', d: 8.0, lane: 1 },
      { t: 'coin', d: 10.5, lane: 1 },
      { t: 'coin', d: 13.0, lane: 0 },
      { t: 'pit', d: 16.0, lane: 0, len: 7 },
      { t: 'coin', d: 16.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 18.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 20.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 23.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 27.0, lane: 1 },
      { t: 'cloud', d: 29.0, lane: -1 },
      { t: 'coin', d: 29.5, lane: 1 },
      { t: 'coin', d: 32.0, lane: 1 },
      { t: 'pad', d: 38.0, lane: 1 },
      { t: 'star', d: 46.0, lane: 1 },
    ],
  },

  // Pattern 29: 4-cloud dense slalom (-1, 0, 1, 0) with alternating lane escapes.
  {
    id: 'z3_dense_quad_slalom',
    zones: [3, 4],
    difficulty: 3,
    length: 50,
    items: [
      { t: 'coin', d: 5.0, lane: 1 },
      { t: 'coin', d: 7.5, lane: 1 },
      { t: 'cloud', d: 10.0, lane: -1 },
      { t: 'coin', d: 10.0, lane: 1 },
      { t: 'cloud', d: 15.0, lane: 0 },
      { t: 'coin', d: 15.0, lane: -1 },
      { t: 'cloud', d: 20.0, lane: 1 },
      { t: 'coin', d: 20.0, lane: -1 },
      { t: 'cloud', d: 25.0, lane: 0 },
      { t: 'coin', d: 25.0, lane: 1 },
      { t: 'pad', d: 33.0, lane: 0 },
      { t: 'berry', d: 38.0, lane: 0 },
      { t: 'star', d: 43.0, lane: 0 },
    ],
  },

  // Pattern 30: Dramatic 9m max-length chasm requiring full jump+glide with star reward.
  {
    id: 'z3_mega_glide_pit_finale',
    zones: [3, 4],
    difficulty: 3,
    length: 58,
    items: [
      { t: 'coin', d: 6.0, lane: 0 },
      { t: 'coin', d: 8.5, lane: 0 },
      { t: 'coin', d: 11.0, lane: 0 },
      { t: 'coin', d: 13.5, lane: 0 },
      { t: 'coin', d: 16.0, lane: 0 },
      { t: 'pit', d: 18.0, lane: 0, len: 9 },
      { t: 'coin', d: 18.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 20.5, lane: 0, y: 1.8 },
      { t: 'star', d: 22.5, lane: 0, y: 2.2 },
      { t: 'coin', d: 24.5, lane: 0, y: 1.8 },
      { t: 'coin', d: 27.0, lane: 0, y: 1.3 },
      { t: 'coin', d: 30.5, lane: 0 },
      { t: 'coin', d: 33.0, lane: 0 },
      { t: 'coin', d: 35.5, lane: 0 },
      { t: 'pad', d: 42.0, lane: 0 },
      { t: 'pad', d: 48.0, lane: 0 },
      { t: 'berry', d: 53.0, lane: 0 },
    ],
  },
];
