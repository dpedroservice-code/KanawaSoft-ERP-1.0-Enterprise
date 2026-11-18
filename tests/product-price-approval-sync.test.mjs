import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261118120000_guard_unapproved_product_price_sync.sql', import.meta.url),
  'utf8'
);
const cloudBridge = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');

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

test('product sync preserves the existing role boundary', () => {
  assert.match(migration, /ARRAY\['owner','admin','manager','gerente'\]::text\[\]/i);
  assert.match(migration, /ARRAY\['owner','admin'\]::text\[\]/i);
  assert.doesNotMatch(migration, /ARRAY\[[^\]]*'accountant'[^\]]*\]::text\[\]/i);
  assert.match(migration, /USING errcode='42501'/i);
});

test('metadata remains syncable while stock is left to its dedicated workflow', () => {
  for (const field of ['sku=excluded.sku', 'name=excluded.name', 'stock_quantity', 'min_stock', 'purchase_cost=excluded.purchase_cost']) {
    assert.ok(migration.includes(field), 'missing expected field: ' + field);
  }
  assert.match(migration, /duplicate-SKU protection/i);
  assert.doesNotMatch(migration, /stock_quantity\s*=\s*excluded\.stock_quantity/i);
});


test('ks_records receives only the effective server-approved product price', () => {
  assert.match(cloudBridge, /select\('unit_price,price_approved'\)/);
  assert.match(cloudBridge, /const effectivePrice = Math\.max\(0, Number\(effectiveProduct\.data\.unit_price\)/);
  assert.match(cloudBridge, /preco: effectivePrice,[\s\S]*precoVenda: effectivePrice,[\s\S]*precoAprovado: priceWasRejected \? false : effectiveProduct\.data\.price_approved === true/);
});

test('local product entry and import cannot mark accountant prices as approved', () => {
  assert.doesNotMatch(appSource, /(?:priceApproved|financeAuthorized)=\['admin','contabilista'\]\.includes\(actor\.role\)/);
  assert.match(appSource, /priceApproved=actor\.role === 'admin'/);
  assert.match(appSource, /financeAuthorized=actor\.role === 'admin'/);
});


test('sanitized product prices are written back to the local cache after online and queued sync', () => {
  assert.match(appSource, /Object\.assign\(item, record\); if \(store === 'produtos' \|\| store === 'vendas'\) await DB\.put\(store, item\)/);
  assert.match(appSource, /item\.entity==='produtos'&&item\.payload\)await DB\.put\('produtos',item\.payload\)/);
  assert.match(appSource, /upsertRecord\('produtos',record,\{\}\);await DB\.put\('produtos',record\)/);
});


test('Excel import accepts the Portuguese price headers shown in the import instructions', () => {
  assert.match(appSource, /precodecompra:'precoCompra'/);
  assert.match(appSource, /precodevenda:'precoVenda'/);
  assert.match(appSource, /estoqueminimo:'estoqueMin'/);
});
