import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261113095239_saas_entitlements_effective_state.sql', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const renderStart = app.indexOf('async function renderLicenca() {');
const renderEnd = app.indexOf('\nfunction atualizarTotalLicenca(){', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'renderLicenca must exist');
const render = app.slice(renderStart, renderEnd);

test('entitlements calculate active, grace, expired and suspended effective states', () => {
  for (const state of ['active','grace','expired','suspended']) assert.ok(migration.includes(`'${state}'`));
  assert.match(migration, /'in_grace_period'/);
  assert.match(migration, /'read_only'/);
});

test('accountant roles may read entitlements without bypassing company membership', () => {
  assert.match(migration, /'accountant','contabilista'/);
  assert.match(migration, /private\.ks_has_company_role/);
});

test('all four legacy company-license permission policies are removed', () => {
  for (const action of ['ins','sel','upd','del']) {
    assert.match(migration, new RegExp(`DROP POLICY IF EXISTS mg_ks_company_licenses_${action}`, 'i'));
  }
});

test('unique license-key indexes are retained or created only when absent', () => {
  assert.match(migration, /CREATE UNIQUE INDEX ks_license_keys_key_hash_uidx/);
  assert.match(migration, /CREATE UNIQUE INDEX ks_company_licenses_license_key_uidx/);
  assert.match(migration, /i\.indisunique/);
});

test('license screen uses Promise.allSettled and fails closed on missing entitlements', () => {
  assert.match(render, /Promise\.allSettled/);
  assert.match(render, /ent\.status/);
  assert.match(render, /ent\.read_only/);
  assert.match(render, /readOnly=!entitlementsAvailable\|\|ent\.read_only!==false/);
  assert.doesNotMatch(render, /getLicense\(\)/);
  assert.doesNotMatch(app, /getLicense\(\)/);
  assert.match(app, /function getKanawaPlanCode\(\).*kanawa_entitlements/s);
  assert.match(app, /function planoPermiteModulo\(moduleId\).*rank>0&&required>0&&rank>=required/);
});
