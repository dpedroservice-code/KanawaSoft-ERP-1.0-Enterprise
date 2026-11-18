import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261118120000_guard_unapproved_product_price_sync.sql', import.meta.url),
  'utf8'
);

test('product sync keeps the normalized sale price unchanged for non-finance actors', () => {
  assert.match(migration, /v_finance\\s+boolean/i);
  assert.match(
    migration,
    /unit_price\\s*=\\s*CASE\\s+WHEN\\s+v_finance\\s+THEN\\s+excluded\\.unit_price\\s+ELSE\\s+current_product\\.unit_price\\s+END/is
  );
});

test('new products from non-finance actors start with no active approved price', () => {
  assert.match(
    migration,
    /CASE\\s+WHEN\\s+v_finance\\s+THEN\\s+greatest\\(coalesce\\(\\(p_product->>'unit_price'\\)::numeric,0\\),0\\)\\s+ELSE\\s+0\\s+END/is
  );
});

test('only finance roles can write an effective product price', () => {
  assert.match(
    migration,
    /ARRAY\\['owner','admin','accountant','contabilista'\\]::text\\[\\]/i
  );
  assert.match(migration, /REVOKE ALL ON FUNCTION private\\.ks_sync_product\\(uuid,jsonb\\) FROM PUBLIC,anon,authenticated/i);
});

test('existing product metadata and stock fields remain synchronized', () => {
  for (const field of ['sku=excluded.sku', 'name=excluded.name', 'stock_quantity', 'purchase_cost=excluded.purchase_cost']) {
    if (field === 'stock_quantity') {
      assert.match(migration, /stock_quantity, min_stock/i);
    } else {
      assert.ok(migration.includes(field), `missing expected sync field: ${field}`);
    }
  }
});
