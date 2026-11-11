import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = fs.readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20261108204100_idempotent_pos_sale_confirmation.sql', import.meta.url), 'utf8');

test('each pending POS finalization gets one stable UUID and timestamp', () => {
  assert.match(app, /clientEventId:\s*generateUuid\(\)/);
  assert.match(app, /clientCreatedAt:\s*now\(\)/);
  assert.match(app, /if\s*\(!pdvPendingFinalSale\)/);
  assert.match(app, /const venda\s*=\s*pdvPendingFinalSale/);
});

test('cloud RPC sends event metadata with the finalized sale', () => {
  assert.match(cloud, /client_event_id:\s*item\.clientEventId \|\| item\.client_event_id \|\| null/);
  assert.match(cloud, /client_created_at:\s*item\.clientCreatedAt \|\| item\.data \|\| item\.created_at_client \|\| null/);
  assert.match(cloud, /client\.rpc\('ks_finalize_fiscal_sale'/);
});

test('database enforces unique event IDs per company and fingerprints the sale payload', () => {
  assert.match(migration, /unique index if not exists ks_sales_company_client_event_uidx\s+on public\.ks_sales\(company_id,client_event_id\)\s+where client_event_id is not null/i);
  assert.match(migration, /request_fingerprint text/i);
  assert.match(migration, /md5\(jsonb_build_object\(/i);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/i);
});

test('replays return the original committed sale and concurrent conflicts are re-read', () => {
  assert.match(migration, /Fast path: a confirmed replay returns the original sale/i);
  assert.match(migration, /on conflict do nothing\s+returning id into v_sale_id/i);
  assert.match(migration, /select id,external_id,client_event_id,request_fingerprint[\s\S]*?for update/i);
  assert.match(migration, /select count\(\*\)::integer into v_existing_item_count[\s\S]*?return v_existing_sale_id/i);
});

test('server-side stock locking and insufficient-stock guard remain in the sale transaction', () => {
  assert.match(migration, /from public\.ks_products[\s\S]*?for update/i);
  assert.match(migration, /if v_product\.stock_quantity < v_qty then/i);
  assert.match(migration, /set stock_quantity = stock_quantity - v_qty/i);
  assert.match(migration, /insert into public\.ks_sale_items/i);
});
