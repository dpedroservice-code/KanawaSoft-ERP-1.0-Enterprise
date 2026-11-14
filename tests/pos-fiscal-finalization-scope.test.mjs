import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cloud = fs.readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const start = cloud.indexOf('async upsertRecord(store, item, options)');
const end = cloud.indexOf('async deleteRecord(store, id)', start);
assert.ok(start >= 0 && end > start, 'upsertRecord must exist');
const upsert = cloud.slice(start, end);

test('fiscal sale id remains in scope through cache and stock reconciliation', () => {
  assert.match(upsert, /let finalizedSaleId = null;/);
  assert.match(upsert, /finalizedSaleId = finalizeSale\.data && \(finalizeSale\.data\.sale_id \|\| finalizeSale\.data\);/);
  assert.doesNotMatch(upsert, /const finalizedSaleId\s*=/);
  assert.match(upsert, /if \(store === 'vendas' && finalizedSaleId\)/);
});

test('fiscal invoice number returned by the server is copied into the sale cache payload', () => {
  assert.match(upsert, /item\.numeroFatura = finalizeSale\.data\.document_number;/);
  assert.match(upsert, /store_key: store,[\s\S]*?record_id: id,[\s\S]*?payload: item/);
});
