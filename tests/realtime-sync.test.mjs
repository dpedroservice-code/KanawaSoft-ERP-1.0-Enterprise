import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261126100000_ks_records_realtime_publication.sql', import.meta.url), 'utf8');

test('Realtime publication migration adds ks_records idempotently and fails on missing prerequisites', () => {
  assert.match(migration, /to_regclass\('public\.ks_records'\)/);
  assert.match(migration, /pubname = 'supabase_realtime'/);
  assert.match(migration, /pg_publication_tables[\s\S]*tablename = 'ks_records'/);
  assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.ks_records/);
});

test('Realtime subscription is filtered to the authenticated company', () => {
  assert.match(cloud, /subscribeToRecordChanges\(onChange\)/);
  assert.match(cloud, /table: 'ks_records'/);
  assert.match(cloud, /filter: 'company_id=eq\.' \+ companyId/);
  assert.match(cloud, /String\(row\.company_id \|\| ''\) !== companyId/);
});

test('Realtime events trigger a debounced incremental sync and preserve active editing', () => {
  assert.match(app, /KanawaCloud\.subscribeToRecordChanges\(function \(change\)/);
  assert.match(app, /realtimeSyncDebounceTimer = setTimeout/);
  assert.match(app, /syncNow\(false\)\.finally/);
  assert.match(app, /!editing && !modalOpen && currentModule/);
  assert.match(app, /syncTimer = setInterval\([\s\S]*?syncNow\(false\)[\s\S]*?\}, 60000\)/);
});
