import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../config/permissions/kanawasoft-permissions-catalog-v1.0.0.json', import.meta.url), 'utf8'));
const map = JSON.parse(readFileSync(new URL('../config/permissions/module-id-map-v1.0.0.json', import.meta.url), 'utf8'));

test('canonical permission catalog contains 19 modules and 108 unique real module IDs', () => {
  assert.equal(catalog.canonical_modules.length, 19);
  const ids = catalog.canonical_modules.flatMap(item => item.module_ids);
  assert.equal(ids.length, 108);
  assert.equal(new Set(ids).size, 108);
  assert.equal(Object.keys(map.mapping).length, 108);
});

test('catalog and lookup map agree without touching tenant custom permissions', () => {
  for (const item of catalog.canonical_modules) {
    for (const id of item.module_ids) assert.equal(map.mapping[id], item.key);
  }
  assert.ok(catalog.preservation_rules.some(rule => rule.includes('ks_company_memberships.permissions')));
  assert.deepEqual(catalog.permission_actions, [
    'can_view','can_create','can_edit','can_delete','can_export','can_approve','can_cancel','can_configure'
  ]);
});

test('platform SaaS administration is explicitly not a tenant module', () => {
  const platform = catalog.canonical_modules.find(item => item.id === 'M18');
  assert.ok(platform);
  assert.deepEqual(platform.module_ids, []);
});
