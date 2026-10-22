// tests/world_zones.test.js — unit & persistence tests for world_zones in Database
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Database } from '../server/db.js';

test('world_zones: put, get, list, mark, and delete API in-memory', async () => {
  const db = new Database(':memory:');
  await db.init();

  try {
    // 1. Initial empty state
    assert.equal(db.getWorldZone('zone_alpha'), null);
    assert.deepEqual(db.listWorldZones(), []);
    assert.deepEqual(db.listWorldZones('wilds'), []);

    // 2. putWorldZone creates and marks dirty
    const created = db.putWorldZone('zone_alpha', 'wilds', { flora: 'lush', nodes: [1, 2] });
    assert.ok(created);
    assert.equal(created.zone_id, 'zone_alpha');
    assert.equal(created.kind, 'wilds');
    assert.deepEqual(created.state, { flora: 'lush', nodes: [1, 2] });
    assert.ok(created.updated_at);
    assert.equal(db.dirtyZones.has('zone_alpha'), true);
    assert.equal(db.dirty, true);

    // 3. getWorldZone retrieves record
    const retrieved = db.getWorldZone('zone_alpha');
    assert.deepEqual(retrieved, created);

    // 4. listWorldZones with and without kind filter
    db.putWorldZone('zone_beta', 'dungeon', { floor: 1 });
    db.putWorldZone('zone_gamma', 'wilds', { flora: 'desert' });

    assert.equal(db.listWorldZones().length, 3);
    const wildsOnly = db.listWorldZones('wilds');
    assert.equal(wildsOnly.length, 2);
    assert.ok(wildsOnly.every((z) => z.kind === 'wilds'));

    const dungeonsOnly = db.listWorldZones('dungeon');
    assert.equal(dungeonsOnly.length, 1);
    assert.equal(dungeonsOnly[0].zone_id, 'zone_beta');

    assert.deepEqual(db.listWorldZones('nonexistent'), []);

    // 5. markWorldZone updates timestamp and marks dirty
    await db.flush();
    assert.equal(db.dirtyZones.size, 0);
    assert.equal(db.dirty, false);

    const prevUpdated = db.getWorldZone('zone_alpha').updated_at;
    db.markWorldZone('zone_alpha');
    assert.equal(db.dirtyZones.has('zone_alpha'), true);
    assert.equal(db.dirty, true);
    const postMarkUpdated = db.getWorldZone('zone_alpha').updated_at;
    assert.ok(postMarkUpdated >= prevUpdated);

    // Marking non-existent zone does not add to dirty
    db.markWorldZone('zone_unknown');
    assert.equal(db.dirtyZones.has('zone_unknown'), false);

    // 6. deleteWorldZone removes locally and marks dirty
    assert.equal(db.deleteWorldZone('zone_beta'), true);
    assert.equal(db.getWorldZone('zone_beta'), null);
    assert.equal(db.listWorldZones('dungeon').length, 0);
    assert.equal(db.listWorldZones().length, 2);
    assert.equal(db.deletedZones.has('zone_beta'), true);

    // Deleting again returns false
    assert.equal(db.deleteWorldZone('zone_beta'), false);
    assert.equal(db.deleteWorldZone(''), false);
  } finally {
    await db.close();
  }
});

test('world_zones: persistence across fresh Database instances loading from same dataFile', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-wz-'));
  const dataFile = path.join(tmpDir, 'world_zones_db.json');

  try {
    // Instance 1: populate world zones and flush to file
    const db1 = new Database(dataFile);
    await db1.init();

    db1.putWorldZone('zone_forest', 'wilds', { trees: 500, weather: 'rain' });
    db1.putWorldZone('zone_shrine', 'sacred', { blessings: ['speed', 'luck'] });
    db1.putWorldZone('zone_arena', 'pvp', { open: true });

    await db1.close();

    // Verify snapshot file written to disk
    assert.equal(fs.existsSync(dataFile), true);
    const rawDisk = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.ok(Array.isArray(rawDisk.worldZones));
    assert.equal(rawDisk.worldZones.length, 3);

    // Instance 2: reload from disk and check integrity
    const db2 = new Database(dataFile);
    await db2.init();

    assert.equal(db2.worldZones.size, 3);
    const forest = db2.getWorldZone('zone_forest');
    assert.ok(forest);
    assert.equal(forest.zone_id, 'zone_forest');
    assert.equal(forest.kind, 'wilds');
    assert.deepEqual(forest.state, { trees: 500, weather: 'rain' });

    assert.equal(db2.listWorldZones('sacred').length, 1);
    assert.equal(db2.listWorldZones('pvp').length, 1);
    assert.equal(db2.listWorldZones().length, 3);

    // Delete one zone in db2 and flush
    db2.deleteWorldZone('zone_arena');
    await db2.close();

    // Instance 3: ensure deleted zone does not reappear
    const db3 = new Database(dataFile);
    await db3.init();

    assert.equal(db3.getWorldZone('zone_arena'), null);
    assert.equal(db3.listWorldZones().length, 2);
    assert.ok(db3.getWorldZone('zone_forest'));
    assert.ok(db3.getWorldZone('zone_shrine'));

    await db3.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('world_zones: backward compatibility with legacy snapshots missing worldZones key', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-legacy-wz-'));
  const legacyFile = path.join(tmpDir, 'legacy_local_db.json');

  try {
    // Write pre-existing JSON file without worldZones property
    const legacyData = {
      version: 1,
      savedAt: '2026-10-01T00:00:00.000Z',
      profiles: [{ id: 'player_one', coins: 500 }],
      sessions: { tok_abc: { userId: 'player_one', created: 123456789 } },
      socialLinks: [{ a: 'player_one', b: 'player_two', status: 'friend', streak: 5 }],
    };
    fs.writeFileSync(legacyFile, JSON.stringify(legacyData));

    // Load with Database
    const db = new Database(legacyFile);
    await db.init();

    // Legacy fields loaded properly
    assert.equal(db.profiles.size, 1);
    assert.equal(db.getProfile('player_one')?.id, 'player_one');
    assert.equal(db.sessions.size, 1);
    assert.equal(db.socialLinks.length, 1);

    // worldZones initializes cleanly as empty map
    assert.equal(db.worldZones.size, 0);
    assert.deepEqual(db.listWorldZones(), []);
    assert.equal(db.getWorldZone('any'), null);

    // Appending world zone to legacy DB and flushing updates the file seamlessly
    db.putWorldZone('new_frontier', 'wilds', { claimedBy: 'player_one' });
    await db.close();

    const updatedRaw = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
    assert.ok(Array.isArray(updatedRaw.worldZones));
    assert.equal(updatedRaw.worldZones.length, 1);
    assert.equal(updatedRaw.worldZones[0].zone_id, 'new_frontier');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('world_zones: Supabase batch upsert in chunks of 100 and retains dirty on error', async () => {
  const db = new Database(':memory:');
  await db.init();

  const upsertedBatches = [];
  let shouldFail = false;

  db.supabase = {
    from(table) {
      if (table === 'world_zones') {
        return {
          upsert: async (batch) => {
            if (shouldFail) {
              return { error: new Error('Supabase network failure simulation') };
            }
            upsertedBatches.push(batch);
            return { error: null };
          },
        };
      }
      return {
        upsert: async () => ({ error: null }),
        delete: () => ({ in: async () => ({ error: null }) }),
        select: () => ({ data: [], error: null }),
      };
    },
  };

  try {
    // Insert 150 zones to test 100-batch splitting
    for (let i = 0; i < 150; i++) {
      db.putWorldZone(`zone_${i}`, 'chunk', { index: i });
    }
    assert.equal(db.dirtyZones.size, 150);

    // 1. Simulate failure: dirtyZones must stay dirty
    shouldFail = true;
    await db.flush();

    assert.equal(db.dirtyZones.size, 150);
    assert.equal(db.dirty, true);
    assert.equal(upsertedBatches.length, 0);

    // 2. Simulate success: flushes 2 batches (100 and 50) and clears dirty
    shouldFail = false;
    await db.flush();

    assert.equal(db.dirtyZones.size, 0);
    assert.equal(db.dirty, false);
    assert.equal(upsertedBatches.length, 2);
    assert.equal(upsertedBatches[0].length, 100);
    assert.equal(upsertedBatches[1].length, 50);

    // Verify row structure sent to Supabase
    const firstRow = upsertedBatches[0][0];
    assert.equal(firstRow.zone_id, 'zone_0');
    assert.equal(firstRow.kind, 'chunk');
    assert.deepEqual(firstRow.state, { index: 0 });
    assert.ok(firstRow.updated_at);
  } finally {
    await db.close();
  }
});
