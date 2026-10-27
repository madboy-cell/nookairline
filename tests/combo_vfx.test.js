import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SKILL_VFX_DEFS,
  ALPHA_ELITE_AURA_SPEC,
  COMBO_VFX_DEFS,
  resolveSkillVfxRecipe,
} from '../shared/skill_vfx_defs.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = path.join(rootDir, 'client');

const EXPECTED_COMBO_IDS = [
  'reaction_conduction',
  'reaction_deep_freeze',
  'reaction_shatter',
  'reaction_wildfire',
  'reaction_scald',
  'reaction_crush',
  'reaction_exposed',
  'guard_break',
  'mob_ward',
  'reaction_frostwind',
  'reaction_judgement',
  'reaction_siphon',
  'resonance_prime',
];

test('Combo VFX: all 13 required ids exist with valid recipes and 1-2 layers each', () => {
  assert.ok(COMBO_VFX_DEFS && typeof COMBO_VFX_DEFS === 'object', 'COMBO_VFX_DEFS must be an exported object');
  assert.equal(Object.keys(COMBO_VFX_DEFS).length, 13, 'Must define exactly 13 combo VFX entries');

  for (const id of EXPECTED_COMBO_IDS) {
    const rec = COMBO_VFX_DEFS[id];
    assert.ok(rec, `Missing COMBO_VFX_DEFS entry for ${id}`);
    assert.equal(rec.id, id, `${id}: rec.id must match key`);
    assert.ok(rec.label && typeof rec.label === 'string', `${id}: label must be a non-empty string`);
    assert.equal(rec.category, 'combo_reaction', `${id}: category must be 'combo_reaction'`);
    assert.ok(rec.biomeHint && typeof rec.biomeHint === 'string', `${id}: biomeHint must be defined`);
    assert.equal(rec.isDirectional, false, `${id}: isDirectional must be false`);
    assert.ok(rec.durationMs > 0, `${id}: durationMs must be positive`);
    assert.ok(rec.screenJuice && typeof rec.screenJuice === 'object', `${id}: screenJuice must be defined`);
    assert.ok(rec.effekseer && typeof rec.effekseer === 'object', `${id}: effekseer spec must be defined`);
    assert.ok(rec.effekseer.peakMs > 0, `${id}: peakMs must be positive`);
    assert.ok(Array.isArray(rec.effekseer.layers), `${id}: effekseer.layers must be an array`);
    assert.ok(
      rec.effekseer.layers.length >= 1 && rec.effekseer.layers.length <= 2,
      `${id}: must have 1-2 layers, got ${rec.effekseer.layers.length}`
    );

    for (const layer of rec.effekseer.layers) {
      assert.ok(layer.url && layer.url.startsWith('/assets/effekseer/'), `${id}: invalid layer url ${layer.url}`);
      assert.ok(layer.url.endsWith('.efkefc'), `${id}: layer url must end with .efkefc`);
      assert.equal(layer.at, 'caster', `${id}: layer.at must be 'caster'`);
      assert.ok(layer.scale > 0, `${id}: layer.scale must be positive`);
    }
  }
});

test('Combo VFX: every .efkefc exists on disk under client/', () => {
  for (const [id, rec] of Object.entries(COMBO_VFX_DEFS)) {
    for (const layer of rec.effekseer.layers) {
      const fullPath = path.join(clientDir, layer.url);
      assert.ok(fs.existsSync(fullPath), `${id}: .efkefc file does not exist on disk: ${fullPath}`);
    }
  }
});

test('Combo VFX: zero URL overlap across SKILL_VFX_DEFS + ALPHA_ELITE_AURA_SPEC + COMBO_VFX_DEFS', () => {
  const ownerByUrl = new Map();

  for (const [id, rec] of Object.entries(SKILL_VFX_DEFS)) {
    for (const layer of rec.effekseer.layers) {
      const existing = ownerByUrl.get(layer.url);
      assert.ok(
        !existing || existing === id,
        `Duplicate URL '${layer.url}' in SKILL_VFX_DEFS between ${existing} and ${id}`
      );
      ownerByUrl.set(layer.url, id);
    }
  }

  for (const layer of ALPHA_ELITE_AURA_SPEC.effekseer.layers) {
    const existing = ownerByUrl.get(layer.url);
    assert.ok(
      !existing || existing === 'alpha_elite_aura',
      `Duplicate URL '${layer.url}' between ${existing} and alpha_elite_aura`
    );
    ownerByUrl.set(layer.url, 'alpha_elite_aura');
  }

  for (const [id, rec] of Object.entries(COMBO_VFX_DEFS)) {
    for (const layer of rec.effekseer.layers) {
      const existing = ownerByUrl.get(layer.url);
      assert.ok(
        !existing,
        `Effekseer URL '${layer.url}' in combo '${id}' overlaps with '${existing}' — every combo must own exclusive FX!`
      );
      ownerByUrl.set(layer.url, id);
    }
  }
});

test('Combo VFX: resolveSkillVfxRecipe resolves all combo ids and falls back correctly', () => {
  for (const id of EXPECTED_COMBO_IDS) {
    assert.equal(
      resolveSkillVfxRecipe(id),
      COMBO_VFX_DEFS[id],
      `resolveSkillVfxRecipe('${id}') must return COMBO_VFX_DEFS.${id}`
    );
  }
  assert.equal(
    resolveSkillVfxRecipe('reaction_shatter'),
    COMBO_VFX_DEFS.reaction_shatter,
    "resolveSkillVfxRecipe('reaction_shatter') must return COMBO_VFX_DEFS.reaction_shatter"
  );
  assert.equal(
    resolveSkillVfxRecipe('alpha_elite_aura'),
    ALPHA_ELITE_AURA_SPEC,
    "resolveSkillVfxRecipe('alpha_elite_aura') must return ALPHA_ELITE_AURA_SPEC"
  );
  assert.equal(
    resolveSkillVfxRecipe('sk_pollen_ring'),
    SKILL_VFX_DEFS.sk_pollen_ring,
    "resolveSkillVfxRecipe('sk_pollen_ring') must return SKILL_VFX_DEFS.sk_pollen_ring"
  );
  assert.equal(
    resolveSkillVfxRecipe('non_existent_key'),
    SKILL_VFX_DEFS.ult_charm_sanctuary,
    'resolveSkillVfxRecipe unknown fallback must be ult_charm_sanctuary'
  );
});
