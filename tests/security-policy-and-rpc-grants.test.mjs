import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261108094349_security_policy_and_rpc_grants.sql', import.meta.url), 'utf8');

test('membership, module and invitation policies are consolidated without role expansion', () => {
  assert.match(sql, /ks_memberships_admin_insert/);
  assert.match(sql, /ks_memberships_admin_update/);
  assert.match(sql, /ks_company_modules_read/);
  assert.match(sql, /ks_company_modules_insert/);
  assert.match(sql, /ks_team_invitations_admin_insert/);
  assert.match(sql, /accountant.*contabilista/);
  assert.doesNotMatch(sql, /create policy[^;]+for all/i);
});

test('tax catalog writes remain restricted to platform administrators', () => {
  assert.match(sql, /ks_tax_rule_catalog_read[\s\S]*using \(true\)/i);
  assert.match(sql, /ks_tax_rule_catalog_platform_insert[\s\S]*private\.ks_is_platform_admin\(\)/i);
  assert.match(sql, /ks_tax_rule_catalog_platform_update[\s\S]*private\.ks_is_platform_admin\(\)/i);
  assert.match(sql, /ks_tax_rule_catalog_platform_delete[\s\S]*private\.ks_is_platform_admin\(\)/i);
});

test('anonymous role cannot execute privileged public RPCs', () => {
  for (const fn of ['ks_accounting_reports','ks_seed_angola_chart_of_accounts','ks_set_company_module_enabled']) {
    assert.match(sql, new RegExp('revoke all on function public\\.' + fn + '[^;]+from public, anon', 'i'));
    assert.match(sql, new RegExp('grant execute on function public\\.' + fn + '[^;]+to authenticated', 'i'));
  }
});
