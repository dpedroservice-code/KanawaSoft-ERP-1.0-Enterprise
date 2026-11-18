import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261118120000_guard_unapproved_product_price_sync.sql', import.meta.url),
  'utf8'
);

test('the public product sync RPC used by the application is guarded', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ks_sync_product/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.ks_sync_product\(uuid,jsonb\) FROM PUBLIC,anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.ks_sync_product\(uuid,jsonb\) TO authenticated/i);
});

test('non-finance sync cannot overwrite an existing effective sale price', () => {
  assert.match(migration, /unit_price\s*=\s*CASE\s+WHEN\s+v_finance\s+THEN\s+excluded\.unit_price\s+ELSE\s+current_product\.unit_price\s+END/is);
});

test('only finance roles can write an effective sale price', () => {
  assert.match(migration, /ARRAY\['owner','admin','accountant','contabilista'\]::text\[\]/i);
});

test('metadata and inventory fields remain in the product upsert', () => {
  for (const field of ['sku=excluded.sku', 'name=excluded.name', 'stock_quantity,\n    min_stock', 'purchase_cost=excluded.purchase_cost']) {
    assert.ok(migration.includes(field), 'missing expected field: ' + field);
  }
});
