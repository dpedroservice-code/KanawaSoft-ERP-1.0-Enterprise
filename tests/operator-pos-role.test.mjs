import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261112210000_operator_pos_permissions.sql',import.meta.url),'utf8');

test('operator can open a cash session and use POS while retaining the cash-session requirement',()=>{
  assert.ok(app.includes("cashier=['caixa','operador','operator'].includes(actor.role)"));
  assert.ok(app.includes("if(['caixa','operador','operator'].includes(actor.role))"));
  assert.ok(app.includes("if(!['admin','caixa','operador','operator'].includes(actor.role))"));
  assert.ok(app.includes("cashierUserId:['caixa','operador','operator'].includes(actor.role)?actor.id:null"));
  assert.ok(migration.includes("m.role IN ('cashier','caixa','operator','operador')"));
  assert.ok(migration.includes("array['owner','admin','cashier','caixa','operator','operador']::text[]"));
});

test('operator can request cancellation but cannot approve their own request',()=>{
  assert.ok(app.includes("if(!['caixa','operador','operator'].includes(role))"));
  assert.ok(app.includes("canReview&&r.status==='pending'&&!(['operador','operator'].includes(actor.role)"));
  assert.ok(migration.includes("Apenas o Caixa ou Operador pode solicitar cancelamento."));
  assert.ok(migration.includes("não pode aprovar o próprio pedido"));
  assert.ok(migration.includes("ARRAY['owner','admin','manager','gerente','operator','operador']"));
});

test('operator POS retains approved price, stock, discount, and idempotency enforcement',()=>{
  assert.ok(migration.includes("if v_product.stock_quantity < v_qty then"));
  assert.ok(migration.includes("abs(coalesce((v_item->>'unit_price')::numeric,0)-v_product.unit_price) > 0.01"));
  assert.ok(migration.includes("v_discount_percent > v_max_discount + 0.001"));
  assert.ok(migration.includes("v_request_fingerprint"));
  assert.ok(migration.includes("ALTER POLICY ks_records_module_insert"));
});
