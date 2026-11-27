import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../app/cloud.js',import.meta.url),'utf8');

test('cash movements are read from the active company and session',()=>{
  assert.match(cloud,/async listCashMovements\(sessionId, limit\)/);
  assert.match(cloud,/from\('ks_cash_movements'\)/);
  assert.match(cloud,/\.eq\('company_id',context\.company\.id\)\.eq\('cash_session_id',sessionId\)/);
});

test('cash movements validate type, positive amount, reason and open session',()=>{
  assert.match(cloud,/\['sangria','suprimento'\]\.includes\(movementType\)/);
  assert.match(cloud,/amount <= 0/);
  assert.match(cloud,/reason\.length < 3/);
  assert.match(cloud,/getActiveCashSession\(\)/);
  assert.match(cloud,/idempotency_key:idempotencyKey/);
});

test('cash management UI exposes sangria and suprimento and refreshes movements',()=>{
  assert.match(app,/renderCashMovementPanel\(active,movements\)/);
  assert.match(app,/value="sangria"/);
  assert.match(app,/value="suprimento"/);
  assert.match(app,/async function registarMovimentoCaixa\(\)/);
  assert.match(app,/cashMovementIdempotencyKey/);
});
