import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261113100000_saas_security_isolation_hardening.sql', import.meta.url),
  'utf8'
);

test('tenant roles cannot directly create, change or delete company licences', () => {
  assert.match(migration, /drop policy if exists mg_ks_company_licenses_ins/i);
  assert.match(migration, /drop policy if exists mg_ks_company_licenses_upd/i);
  assert.match(migration, /drop policy if exists mg_ks_company_licenses_del/i);
  assert.match(migration, /if v_module='licenca' then\s+return false/i);
});

test('company users cannot approve or rewrite their own SaaS payment requests', () => {
  for (const action of ['ins', 'sel', 'upd', 'del']) {
    assert.match(migration, new RegExp(`drop policy if exists mg_ks_payment_requests_${action}`, 'i'));
  }
  assert.match(migration, /private\.ks_is_platform_admin\(\)/);
});

test('licence activation audit is immutable for normal authenticated users', () => {
  assert.match(migration, /drop policy if exists ks_license_activation_audit_manager_insert/i);
  assert.match(migration, /drop policy if exists ks_license_activation_audit_manager_update/i);
  assert.match(migration, /drop policy if exists ks_license_activation_audit_admin_delete/i);
  assert.match(migration, /drop policy if exists mg_ks_license_activation_audit_ins/i);
  assert.match(migration, /drop policy if exists mg_ks_license_activation_audit_upd/i);
  assert.match(migration, /drop policy if exists mg_ks_license_activation_audit_del/i);
});

test('private privileged functions explicitly deny anonymous execution', () => {
  assert.match(migration, /revoke all on function private\.ks_issue_license_key_by_term\(text,text,uuid\) from public, anon/i);
  assert.match(migration, /revoke all on function private\.ks_has_company_role\(uuid,text\[\]\) from public, anon/i);
  assert.match(migration, /revoke all on function private\.ks_has_company_permission\(uuid,text,text\) from public, anon/i);
});

test('sale cancellation resolves exactly one company from the caller membership', () => {
  assert.match(migration, /array_agg\(distinct s\.company_id\)/i);
  assert.match(migration, /m\.user_id=auth\.uid\(\)/i);
  assert.match(migration, /m\.status='active'/i);
  assert.match(migration, /lower\(m\.role\) in \('owner','admin','administrator'\)/i);
  assert.match(migration, /coalesce\(cardinality\(v_companies\),0\) <> 1/i);
  assert.match(migration, /where company_id=v_company\s+and external_id=p_sale_external_id\s+for update/i);
  assert.match(migration, /revoke all on function public\.ks_admin_cancel_sale\(text,text\) from public, anon/i);
});
