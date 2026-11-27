import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../app/cloud.js',import.meta.url),'utf8');

test('POS suspended sales are persisted in the tenant-scoped Supabase draft table',()=>{
  assert.match(cloud,/async saveSuspendedPosSale\(draft\)/);
  assert.match(cloud,/from\('ks_pos_sale_drafts'\)\.upsert/);
  assert.match(cloud,/onConflict:\s*'company_id,draft_uuid'/);
  assert.match(cloud,/company_id:\s*context\.company\.id/);
});

test('POS suspended sales can be listed and atomically claimed once',()=>{
  assert.match(cloud,/async listSuspendedPosSales\(limit\)/);
  assert.match(cloud,/\.eq\('status','suspended'\)/);
  assert.match(cloud,/async resumeSuspendedPosSale\(draftId\)/);
  assert.match(cloud,/\.eq\('status','suspended'\)[\s\S]*?\.select\(/);
  assert.match(cloud,/já foi recuperada|deixou de estar suspensa/);
});

test('POS UI exposes suspend, list and resume actions without using generic sales drafts',()=>{
  assert.match(app,/async function pdvSuspenderVenda\(\)/);
  assert.match(app,/async function pdvListarVendasSuspensas\(\)/);
  assert.match(app,/async function pdvRetomarVendaSuspensa\(id\)/);
  assert.match(app,/onclick="pdvSuspenderVenda\(\)"/);
  assert.match(app,/onclick="pdvListarVendasSuspensas\(\)"/);
  assert.doesNotMatch(app,/async function pdvSalvarRascunho\(\)\s*\{[^}]*ks_pos_sale_drafts/);
});

test('resuming a suspended sale restores its discount percentage, tax regime and payment method',()=>{
  assert.match(app,/descontoPercentual:Number\(pdvState\.desconto\)/);
  assert.match(app,/desconto:Number\(draft\.customer_snapshot[\s\S]*?descontoPercentual/);
  assert.match(app,/aplicarIVA:/);
  assert.match(app,/regime:draft\.customer_snapshot/);
});
