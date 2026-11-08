import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261108094500_preserve_agt_integration_provider.sql', import.meta.url), 'utf8');

test('payment provider expansion preserves the existing AGT provider', () => {
  assert.match(sql, /'agt'/);
  for (const provider of ['paypal','stripe','paypay','multicaixa']) assert.match(sql, new RegExp("'" + provider + "'"));
});
