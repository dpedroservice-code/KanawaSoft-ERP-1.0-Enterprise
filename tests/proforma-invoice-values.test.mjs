import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app/fatura-modelos.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../app/app.js', import.meta.url), 'utf8');
const context = { window: {}, Intl, Date, JSON, String, Number, Math, localStorage: { getItem: () => null } };
vm.runInNewContext(source, context);
const render = context.window.KanawaInvoiceTemplates.render;

test('invoice template renders line amounts including VAT', () => {
  const html = render({
    tipoDocumento: 'PP', numeroFatura: 'PP-TEST', data: '2026-11-11',
    itens: [{ nome: 'Câmara CCTV', qty: 2, preco: 10000, subtotal: 20000, taxAmount: 2800 }],
    subtotal: 20000, baseIncidencia: 20000, iva: 2800, total: 22800
  }, { firma: 'D.Pedro Soluções Lda' }, null, { showBank: false });
  assert.match(html, /Câmara CCTV/);
  assert.match(html, /22[\s\u00a0]?800/);
  assert.match(html, /20[\s\u00a0]?000/);
});

test('invoice template escapes line descriptions', () => {
  const html = render({
    tipoDocumento: 'PP', itens: [{ nome: '<script>alert(1)<\/script>', qty: 1, preco: 100, subtotal: 100 }]
  }, {}, null, { showBank: false });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('proforma printing falls back to cart lines and recalculates totals', () => {
  assert.match(app, /const sourceLines=Array\.isArray\(quote\.itens\).*quote\.carrinho/);
  assert.match(app, /KanawaFiscalDocuments\.calculateLines/);
  assert.match(app, /baseIncidencia:taxableBase,iva:taxAmount,total/);
  assert.match(app, /Esta pró-forma não contém artigos/);
});
