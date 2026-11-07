import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../supabase/migrations/20261106150517_kanawa_rls_policy_overlap_cleanup.sql', import.meta.url),
  'utf8'
);

test('RLS overlap migration splits admin ALL policies into write-only operations', () => {
  assert.match(sql, /ks_company_licenses_admin_insert/);
  assert.match(sql, /ks_installations_admin_insert/);
  assert.match(sql, /ks_usage_daily_admin_insert/);
  assert.match(sql, /ks_saas_plans_admin_insert/);
  assert.doesNotMatch(sql, /FOR ALL TO authenticated/);
});

test('combined read policies preserve self, company admin and platform admin paths', () => {
  assert.match(sql, /OR private\.ks_is_platform_admin\(\)/);
  assert.match(sql, /user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /ks_has_company_permission\(company_id,'financeiro','ver'\)[\s\S]*OR private\.ks_has_company_permission\(company_id,'financeiro','editar'\)/);
  assert.match(sql, /ks_has_company_permission\(company_id,'fiscal','ver'\)[\s\S]*OR private\.ks_has_company_permission\(company_id,'fiscal','editar'\)/);
});
