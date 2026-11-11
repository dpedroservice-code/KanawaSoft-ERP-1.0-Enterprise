import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = await readFile(new URL('../app/cloud.js', import.meta.url), 'utf8');

test('PDV exposes a pro-forma action and keeps it separate from fiscal sales', () => {
  assert.match(app, /id="pdvProformaButton"[^>]*onclick="pdvSalvarOrcamento\(\)"/);
  assert.match(app, /Guardar \/ emitir pró-forma/);
  assert.match(app, /async function pdvSalvarOrcamento\(\)/);
  assert.match(app, /documentoFiscal:false,movimentaStock:false,movimentaFinanceiro:false/);
  assert.match(app, /Não é factura fiscal e não movimenta stock nem caixa/);
  assert.match(app, /Nova pró-forma/);
  assert.match(app, /async function imprimirProforma\(id\)/);
});

test('finalized sales expose a return / credit-note action for management roles', () => {
  assert.match(app, /Cancelar venda/);
  assert.match(app, /Emitir Nota de Crédito/);
  assert.match(app, /function abrirModalNotaCredito\(id\)/);
  assert.match(app, /function confirmarNotaCredito\(id\)/);
  assert.match(app, /emitirNotaCreditoVenda\(sale,amountCents,taxCents,reason\)/);
  assert.match(app, /stockAdjustmentStatus:'pending_manual_review'/);
});

test('fiscal summary reads the protected Supabase credit-note ledger and caches it for offline use', () => {
  assert.match(app, /async function getIssuedCreditNotes\(\)/);
  assert.match(app, /KanawaCloud\.getSalesCreditNotes\(\)/);
  assert.match(app, /await DB\.put\('devolucoes',note\)/);
  assert.match(cloud, /async getSalesCreditNotes\(\)/);
  assert.match(cloud, /from\('ks_sales_returns'\)/);
  assert.match(cloud, /from\('ks_fiscal_documents'\)/);
});

test('fiscal summary reads the protected Supabase credit-note ledger and caches it for offline use', () => {
  assert.match(app, /async function getIssuedCreditNotes\(\)/);
  assert.match(app, /KanawaCloud\.getSalesCreditNotes\(\)/);
  assert.match(app, /await DB\.put\('devolucoes',note\)/);
  assert.match(cloud, /async getSalesCreditNotes\(\)/);
  assert.match(cloud, /from\('ks_sales_returns'\)/);
  assert.match(cloud, /from\('ks_fiscal_documents'\)/);
});
