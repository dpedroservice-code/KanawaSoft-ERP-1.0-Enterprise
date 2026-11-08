import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');

test('offline queue records the tenant, originating user and event metadata', () => {
  const start = source.indexOf('async function queueSync');
  const end = source.indexOf('async function processSyncQueue', start);
  assert.ok(start >= 0 && end > start);
  const queueSync = source.slice(start, end);
  assert.match(queueSync, /company_id:\s*companyId/);
  assert.match(queueSync, /user_id:\s*userId/);
  assert.match(queueSync, /event_id:\s*eventId/);
  assert.match(queueSync, /created_at_client:\s*new Date\(\)\.toISOString\(\)/);
});

test('offline queue only sends operations from the active company and user', () => {
  const start = source.indexOf('async function processSyncQueue');
  const end = source.indexOf('async function pullFromServer', start);
  assert.ok(start >= 0 && end > start);
  const processQueue = source.slice(start, end);
  assert.match(processQueue, /item\.company_id === companyId/);
  assert.match(processQueue, /item\.user_id === userId/);
  assert.match(processQueue, /Date\.parse\(a\.created_at_client/);
});

test('sync UI reports pending operations rather than claiming full success', () => {
  const start = source.indexOf('async function syncNow');
  const end = source.indexOf('function toggleSync', start);
  assert.ok(start >= 0 && end > start);
  const syncNow = source.slice(start, end);
  assert.match(syncNow, /remainingQueue\.length/);
  assert.match(syncNow, /Sincronização parcial/);
});


test('tenant changes clear cached records but preserve scoped offline queue entries', () => {
  const start = source.indexOf('async function activateCloudSession');
  const end = source.indexOf('async function', start + 20);
  assert.ok(start >= 0 && end > start);
  const activation = source.slice(start, end);
  assert.match(activation, /if \(store !== '_sync_queue'\) await DB\.clear\(store\)/);
});

test('server pulls and local refreshes ignore pending events belonging to another tenant', () => {
  assert.match(source, /x\.company_id === activeCompanyId/);
  assert.match(source, /const dirty = new Set\(queue\.filter\(x => !x\.synced && x\.company_id === activeCompanyId\)/);
});
