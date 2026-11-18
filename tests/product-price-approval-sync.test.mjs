import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261118120000_guard_unapproved_product_price_sync.sql', import.meta.url),
  'utf8'
);

test('the public RPC remains a SECURITY INVOKER wrapper to the private implementation', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.ks_sync_product/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ks_sync_product/i);
  assert.match(migration, /LANGUAGE sql\s+SECURITY INVOKER/i);
  assert.match(migration, /SELECT private\.ks_sync_product\(\$1,\$2\)/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.ks_sync_product\(uuid,jsonb\) FROM PUBLIC,anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.ks_sync_product\(uuid,jsonb\) TO authenticated/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.ks_sync_product\(uuid,jsonb\) FROM PUBLIC,anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION private\.ks_sync_product\(uuid,jsonb\) TO authenticated/i);
});

test('non-finance sync cannot overwrite an existing effective sale price', () => {
  assert.match(migration, /unit_price\s*=\s*CASE\s+WHEN\s+v_finance\s+THEN\s+excluded\.unit_price\s+ELSE\s+current_product\.unit_price\s+END/is);
});

test('only finance roles can write an effective sale price', () => {
  assert.match(migration, /ARRAY\['owner','admin'\]::text\[\]/i);\n  assert.match(migration, /ARRAY\['owner','admin','manager','gerente'\]::text\[\]/i);\n  assert.doesNotMatch(migration, /ARRAY\[[^\]]*'accountant'[^\]]*\]::text\[\]/i);\n  assert.match(migration, /USING errcode='42501'/i);
});

test('metadata and inventory fields remain in the product upsert', () => {
  for (const field of ['sku=excluded.sku', 'name=excluded.name', 'stock_quantity', 'min_stock', 'purchase_cost=excluded.purchase_cost']) {
    assert.ok(migration.includes(field), 'missing expected field: ' + field);
  }
  assert.match(migration, /duplicate-SKU protection/i);\n  assert.doesNotMatch(migration, /stock_quantity\\s*=\\s*excluded\\.stock_quantity/i);
});
