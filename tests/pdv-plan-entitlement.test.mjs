import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const planMigration = readFileSync(new URL('../supabase/migrations/20261113130000_saas_limits_module_enforcement.sql', import.meta.url), 'utf8');
const guardMigration = readFileSync(new URL('../supabase/migrations/20261114100000_pdv_plan_server_enforcement.sql', import.meta.url), 'utf8');

test('PDV canonical minimum tier is Comercial (standard) in the browser and SQL catalog', () => {
  assert.match(app, /['"]pdv['"]\s*:\s*['"]standard['"]/);
  assert.match(planMigration, /WHEN 'pdv' THEN 'standard'/);
  assert.match(guardMigration, /v_required_plan\s*:=\s*private\.ks_module_min_plan\('pdv'\)/);
});

test('frontend upsell fails closed when entitlements are absent or read-only', () => {
  const start = app.indexOf('function mostrarUpsellModulo(moduleId)');
  const end = app.indexOf('\nfunction podeFazer(', start);
  assert.ok(start >= 0 && end > start, 'mostrarUpsellModulo must exist');
  const modal = app.slice(start, end);
  assert.match(modal, /const readOnly=!valid\|\|entitlements\.read_only!==false/);
  assert.match(modal, /Licença em modo de leitura/);
  assert.match(modal, /Ver planos e fazer upgrade/);
  assert.match(modal, /standard:'Comercial'/);
});

test('server blocks finalized PDV writes when license is read-only or cannot be validated', () => {
  assert.match(guardMigration, /coalesce\(\(v_entitlements->>'read_only'\)::boolean,\s*true\)/);
  assert.match(guardMigration, /LICENCE_READ_ONLY/);
  assert.match(guardMigration, /LICENCE_SUSPENDED/);
  assert.match(guardMigration, /LICENCE_CANCELLED/);
  const readOnlyGate = guardMigration.indexOf("coalesce((v_entitlements->>'read_only')::boolean, true)");
  const nonFinalReturn = guardMigration.indexOf("IF NEW.status NOT IN ('finalizada','finalizado')");
  const pdvTierGate = guardMigration.indexOf("v_required_plan := private.ks_module_min_plan('pdv')");
  assert.ok(readOnlyGate >= 0 && nonFinalReturn > readOnlyGate && pdvTierGate > nonFinalReturn,
    'read-only must cover every sale write; the PDV tier gate applies only after finalization is confirmed');
});

test('server recognizes the four commercial tiers and the owner lifetime tier', () => {
  for (const [code, rank] of [
    ['mini', 1],
    ['trial', 4],
    ['standard', 2],
    ['premium', 3],
    ['enterprise', 4],
    ['internal_lifetime', 4]
  ]) {
    assert.match(guardMigration, new RegExp(`WHEN '${code}' THEN ${rank}`));
  }
  assert.match(guardMigration, /v_plan_rank\s*=\s*0\s+OR\s+v_plan_rank\s*<\s*v_required_rank/);
});

test('server guard covers INSERT and UPDATE, including transition to finalized', () => {
  assert.match(guardMigration, /BEFORE INSERT OR UPDATE ON public\.ks_sales/);
  assert.match(guardMigration, /NEW\.status NOT IN \('finalizada','finalizado'\)/);
  assert.match(guardMigration, /CREATE TRIGGER ks_sales_entitlement_guard/);
});

test('PDV entitlement patch does not alter membership permissions or create duplicate tables', () => {
  assert.doesNotMatch(guardMigration, /ks_company_memberships\.permissions/i);
  assert.doesNotMatch(guardMigration, /CREATE TABLE/i);
});
