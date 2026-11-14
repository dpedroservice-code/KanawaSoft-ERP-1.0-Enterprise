import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../config/permissions/kanawasoft-permissions-catalog-v1.0.0.json', import.meta.url), 'utf8'));
const idMap = JSON.parse(readFileSync(new URL('../config/permissions/module-id-map-v1.0.0.json', import.meta.url), 'utf8'));
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20261113130000_saas_limits_module_enforcement.sql', import.meta.url), 'utf8');

const canonicalIds = catalog.canonical_modules.flatMap(module => module.module_ids);
const sqlTierEntries = [...sql.matchAll(/WHEN '([^']+)' THEN '(mini|standard|premium|enterprise)'/g)]
  .map(([, id, tier]) => [id, tier]);
const menuStart = app.indexOf('const MENU_MODULE_MIN_PLAN=');
const menuEnd = app.indexOf('\\nfunction getKanawaPlanCode', menuStart);
assert.ok(menuStart >= 0 && menuEnd > menuStart, 'frontend plan map must exist');
const menuTierEntries = [...app.slice(menuStart, menuEnd).matchAll(/(?:'([^']+)'|([A-Za-z0-9_-]+))\\s*:\\s*'(mini|standard|premium|enterprise)'/g)]
  .map(([, quotedId, bareId, tier]) => [quotedId || bareId, tier]);

function asMap(entries) {
  return new Map(entries);
}

test('catalog and ID lookup map contain the same 108 unique canonical module IDs', () => {
  assert.equal(canonicalIds.length, 108);
  assert.equal(new Set(canonicalIds).size, 108);
  assert.equal(idMap.distinct_module_ids, 108);
  assert.deepEqual(Object.keys(idMap.mapping).sort(), [...canonicalIds].sort());
});

test('SQL and frontend plan maps contain exactly the canonical IDs with identical minimum tiers', () => {
  const expectedIds = [...canonicalIds].sort();
  const sqlMap = asMap(sqlTierEntries);
  const menuMap = asMap(menuTierEntries);
  assert.equal(sqlTierEntries.length, 108, 'SQL must not contain orphan or duplicate module IDs');
  assert.equal(menuTierEntries.length, 108, 'frontend must not contain orphan or duplicate module IDs');
  assert.equal(sqlMap.size, 108);
  assert.equal(menuMap.size, 108);
  assert.deepEqual([...sqlMap.keys()].sort(), expectedIds);
  assert.deepEqual([...menuMap.keys()].sort(), expectedIds);
  for (const id of canonicalIds) {
    assert.equal(menuMap.get(id), sqlMap.get(id), `frontend/SQL minimum tier mismatch for ${id}`);
  }
});

test('canonical module tier distribution is Start 21, Comercial 61, Gestão Pro 24 and Enterprise 2', () => {
  const sqlMap = asMap(sqlTierEntries);
  const counts = { mini: 0, standard: 0, premium: 0, enterprise: 0 };
  for (const id of canonicalIds) counts[sqlMap.get(id)] += 1;
  assert.deepEqual(counts, { mini: 21, standard: 61, premium: 24, enterprise: 2 });
  assert.equal(sqlMap.get('pdv'), 'standard');
  assert.equal(sqlMap.get('comunicacao'), 'enterprise');
});
