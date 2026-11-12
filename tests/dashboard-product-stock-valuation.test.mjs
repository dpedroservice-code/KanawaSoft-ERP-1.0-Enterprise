import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const app = fs.readFileSync(path.join(process.cwd(), 'app/app.js'), 'utf8');

function loadStockSummary() {
  const start = app.indexOf('function calcularResumoStockProdutos(products, sales) {');
  assert.notEqual(start, -1, 'função de resumo de stock por produto deve existir');
  let depth = 0;
  let end = -1;
  for (let i = app.indexOf('{', start); i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.notEqual(end, -1, 'função de resumo de stock deve estar completa');
  return vm.runInNewContext('(' + app.slice(start, end) + ')');
}

test('avalia custo, valor potencial e margem do stock por produto', () => {
  const summarize = loadStockSummary();
  const result = summarize([
    { id: 'p1', nome: 'Câmara', estoque: 4, precoCompra: 10000, precoVenda: 15000 },
    { id: 'p2', nome: 'Router', estoque: 2, precoCompra: 20000, precoVenda: 30000 }
  ], []);
  assert.equal(result.stockCostTotal, 80000);
  assert.equal(result.stockSaleTotal, 120000);
  assert.equal(result.potentialMarginTotal, 40000);
  assert.equal(result.rows.length, 2);
});

test('soma vendas apenas de vendas concluídas e associa linhas aos produtos', () => {
  const summarize = loadStockSummary();
  const result = summarize([
    { id: 'p1', nome: 'Câmara', estoque: 4, precoCompra: 10000, precoVenda: 15000 }
  ], [
    { status: 'finalizada', itens: [{ product_id: 'p1', nome: 'Câmara', quantidade: 2, preco: 15000 }] },
    { status: 'pendente', itens: [{ product_id: 'p1', nome: 'Câmara', quantidade: 5, preco: 15000 }] }
  ]);
  assert.equal(result.rows[0].sales, 30000);
});

test('não inventa custo ou preço quando o produto não tem esses valores', () => {
  const summarize = loadStockSummary();
  const result = summarize([{ id: 'p1', nome: 'Produto sem custo', estoque: 3, precoVenda: 500 }], []);
  assert.equal(result.stockCostTotal, 0);
  assert.equal(result.stockSaleTotal, 1500);
  assert.equal(result.potentialMarginTotal, 0);
  assert.equal(result.rows[0].stockCost, null);
});

test('dashboard reserva a nova análise financeira a perfis com acesso financeiro', () => {
  assert.match(app, /const canViewFinancial = \['admin','gerente','contabilista'\]\.includes\(roleKey\) && podeAcessar\('financeiro'\)/);
  assert.match(app, /id="dashChartProductValues"/);
  assert.match(app, /id="dashStockCostValue"/);
  assert.match(app, /id="dashStockSaleValue"/);
  assert.match(app, /id="dashStockPotentialMargin"/);
});
