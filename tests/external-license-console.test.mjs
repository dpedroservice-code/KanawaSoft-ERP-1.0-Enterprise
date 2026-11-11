import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261111120000_external_license_console.sql', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/centro-licencas.html', import.meta.url), 'utf8');

test('licensing console authorization is enforced by authenticated database identity', () => {
  assert.match(migration, /private\.ks_is_platform_admin\(\)/);
  assert.match(migration, /private\.ks_is_license_distributor\(\)/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /revoke all on public\.ks_license_distributors from public, anon, authenticated/i);
  assert.match(migration, /revoke all on public\.ks_license_management_audit from public, anon, authenticated/i);
});

test('only platform owner can issue internal or lifetime licenses', () => {
  assert.match(migration, /if \(v_term\.internal_only or v_term\.is_lifetime or p_plan_code = 'internal_lifetime'\) and not v_owner/i);
  assert.match(migration, /p\.plan_code <> 'internal_lifetime' and private\.ks_can_issue_license_plan/);
  assert.match(migration, /'owner_terms'[\s\S]+?v_owner and \(t\.internal_only or t\.is_lifetime\)/i);
});

test('distributor plan permissions are checked again during server-side issuance', () => {
  assert.match(migration, /p_plan_code = any\(d\.allowed_plan_codes\)/i);
  assert.match(migration, /not v_owner and not private\.ks_can_issue_license_plan\(p_plan_code\)/i);
  assert.match(migration, /ks_license_console_manage_distributor/);
});

test('console never reads or displays stored plaintext license keys', () => {
  assert.doesNotMatch(migration, /select\s+[^;]*license_key\s+from\s+public\.ks_license_keys/i);
  assert.match(migration, /'prefix',k\.key_prefix/);
  assert.match(page, /shouldCreateUser:false/);
  assert.match(page, /ks_license_console_bootstrap/);
  assert.match(page, /ks_license_console_overview/);
  assert.match(page, /ks_issue_license_key_by_term/);
});

test('standalone console does not use email text as an authorization check', () => {
  assert.doesNotMatch(page, /dpedroservice@gmail\.com/i);
  assert.match(page, /Centro Externo de Licenças/);
  assert.match(page, /ks_license_console_manage_distributor/);
});

test('paid distributor keys require an assigned pending payment request', () => {
  assert.match(migration, /not v_owner and p_plan_code <> 'trial' and p_payment_request_id is null/i);
  assert.match(migration, /assigned_distributor_id uuid references auth\.users/i);
  assert.match(migration, /ks_license_console_assign_payment_request/);
  assert.match(migration, /r\.plan_code=any\(d\.allowed_plan_codes\)/i);
  assert.match(page, /paymentRequest/);
  assert.match(page, /ks_license_console_assign_payment_request/);
});

test('monitor includes installation and upcoming expiry metrics without exposing full keys', () => {
  assert.match(migration, /'installations'/);
  assert.match(migration, /'expiring_soon'/);
  assert.match(migration, /interval '14 days'/);
  assert.match(page, /Licenças a expirar \(14 dias\)/);
});
