import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cloud = readFileSync(join(root, 'app/cloud.js'), 'utf8');
const app = readFileSync(join(root, 'app/app.js'), 'utf8');

test('initial company reconciliation fetches record keys only, not large JSON payloads', () => {
  assert.match(cloud, /async getAllRecordKeys\(\)[\s\S]*?select\('store_key, record_id'\)/);
  assert.match(app, /remoteRows = await KanawaCloud\.getAllRecordKeys\(\)/);
});

test('cloud record reads use the compact tenant-scoped RPC, updated_at cursor, and tombstone filtering', () => {
  assert.match(cloud, /async getAllRecords\(updatedSince\)[\s\S]*?p_updated_since: updatedSince \|\| null/);
  assert.match(cloud, /async getStore\(store, includeMedia\)[\s\S]*?rpc\('ks_get_records_compact'/);
  assert.match(cloud, /async getStore\(store, includeMedia\)[\s\S]*?payload\._deleted === true/);
  assert.match(cloud, /async countRecords\(\)[\s\S]*?or\('payload->>_deleted.is.null,payload->>_deleted.neq.true'\)/);
});

test('server deletion is represented as a timestamped tombstone for cross-device delta sync', () => {
  assert.match(cloud, /async deleteRecord\(store, id\)[\s\S]*?payload: \{ id: id, _deleted: true, deleted_at: deletedAt \}/);
  assert.match(cloud, /\.upsert\(\{[\s\S]*?updated_at: deletedAt/);
});

test('incremental pull batches IndexedDB writes and deletions per store', () => {
  assert.match(app, /bulkPut\(s, items\)[\s\S]*?store\.put\(item\)/);
  assert.match(app, /bulkDel\(s, ids\)[\s\S]*?store\.delete\(id\)/);
  const pull = app.match(/async function pullFromServer\(\) \{[\s\S]*?\n\}/);
  assert.ok(pull, 'pullFromServer must exist');
  assert.match(pull[0], /writesByStore/);
  assert.match(pull[0], /deletesByStore/);
  assert.match(pull[0], /DB\.bulkPut\(store, items\)/);
  assert.match(pull[0], /DB\.bulkDel\(store, ids\)/);
  assert.match(pull[0], /offset \+= 8/);
  assert.match(pull[0], /if \(!dirty\.size\) localStorage\.setItem\(cursorKey,syncStartedAt\)/);
});

test('only one cloud sync cycle can run at a time', () => {
  assert.match(app, /let syncNowRunning = false;[\s\S]*?async function syncNow\(showMessage\) \{[\s\S]*?if \(syncNowRunning\) return false;[\s\S]*?syncNowRunning = true;/);
  assert.match(app, /finally \{[\s\S]*?syncNowRunning = false;[\s\S\S]*?function toggleSync/);
});
