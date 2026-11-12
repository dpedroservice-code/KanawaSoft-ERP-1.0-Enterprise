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

test('incremental pull applies changed rows without clearing stores on every sync', () => {
  const pull = app.match(/async function pullFromServer\(\) \{[\s\S]*?\n\}/);
  assert.ok(pull, 'pullFromServer must exist');
  assert.match(pull[0], /kanawa_sync_cursor:/);
  assert.match(pull[0], /getAllRecords\(previousCursor \|\| null\)/);
  assert.match(pull[0], /if \(!previousCursor\)[\s\S]*?DB\.clear\(store\)/);
  assert.match(pull[0], /payload\._deleted === true[\s\S]*?DB\.del\(store,id\)/);
  assert.match(pull[0], /if \(!dirty\.size\) localStorage\.setItem\(cursorKey,syncStartedAt\)/);
});

test('module refreshes use per-store updated_at cursors instead of re-downloading entire stores', () => {
  assert.match(cloud, /async getStoreDelta\(store, updatedSince, includeMedia\)[\s\S]*?p_updated_since: updatedSince \|\| null/);
  assert.match(app, /kanawa_store_cursor:/);
  assert.match(app, /KanawaCloud\.getStoreDelta\(store, previousCursor, includeMedia === true\)/);
  assert.match(app, /if \(!previousCursor\) await DB\.clear\(store\)/);
});
