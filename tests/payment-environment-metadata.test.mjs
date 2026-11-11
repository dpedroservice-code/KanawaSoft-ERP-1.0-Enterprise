import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261108095000_payment_gateway_environment.sql', import.meta.url), 'utf8');
const integrations = readFileSync(new URL('../supabase/functions/company-integrations/index.ts', import.meta.url), 'utf8');

test('payment gateway environment metadata is non-secret and constrained', () => {
  assert.match(sql, /add column if not exists environment text/i);
  assert.match(sql, /environment is null or environment in \('sandbox','production'\)/i);
});

test('license activation keys are emailed to the platform owner by a server-side provider', () => {
  assert.match(integrations, /send_license_key_email/);
  assert.match(integrations, /ks_is_platform_admin/);
  assert.match(integrations, /RESEND_API_KEY/);
  assert.match(integrations, /LICENSE_EMAIL_FROM/);
  assert.match(integrations, /dpedroservice@gmail\.com/);
});
