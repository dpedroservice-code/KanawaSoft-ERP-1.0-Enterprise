import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261108095000_payment_gateway_environment.sql', import.meta.url), 'utf8');

test('payment gateway environment metadata is non-secret and constrained', () => {
  assert.match(sql, /add column if not exists environment text/i);
  assert.match(sql, /environment is null or environment in \('sandbox','production'\)/i);
});
