import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261108100000_product_purchase_cost_and_gross_profit.sql', import.meta.url), 'utf8');

test('ERP application JavaScript parses without syntax errors', () => {
  assert.doesNotThrow(() => new vm.Script(app));
});

test('product registration captures purchase price, sale price and quantity', () => {
  assert.match(app, /id="pPrecoCompra"/);
  assert.match(app, /id="pPrecoVenda"/);
  assert.match(app, /id="pEstoque"/);
  assert.match(app, /precoCompra, precoVenda/);
  assert.match(app, /Preço de Compra \(Kz\)/);
  assert.match(app, /Preço de Venda \(Kz\)/);
  assert.match(app, /Margem unitária/);
});

test('quick product registration and spreadsheet import/export preserve both prices', () => {
  assert.match(app, /rcPrecoCompra/);
  assert.match(app, /rcPrecoVenda/);
  assert.match(app, /precoCompra: row\.precoCompra === undefined/);
  assert.match(app, /precoVenda: p\.precoVenda !== undefined/);
});

test('cloud sync persists purchase cost and the server snapshots unit cost per sale item', () => {
  assert.match(cloud, /purchase_cost: item\.precoCompra !== undefined/);
  assert.match(cloud, /const unitCost = line\.custoUnitario === null/);
  assert.match(migration, /add column if not exists purchase_cost numeric/);
  assert.match(migration, /add column if not exists unit_cost numeric/);
  assert.match(migration, /ks_capture_sale_item_cost/);
  assert.match(migration, /ks_refresh_sale_profit/);
});

test('POS stores unit cost, cost of goods and gross profit on finalized sales', () => {
  assert.match(app, /custoUnitario: i\.custoUnitario === null/);
  assert.match(app, /custoTotal:/);
  assert.match(app, /lucroBruto:/);
  assert.match(app, /function calcularLucroBrutoVenda/);
  assert.match(app, /Lucro bruto apurado/);
  assert.match(app, /Não apurado/);
});

test('legacy sales without a recorded purchase-cost snapshot are not presented as verified profit', () => {
  assert.match(app, /!itens\.every\(i => i\.custoUnitario !== undefined && i\.custoUnitario !== null\)/);
  assert.match(app, /sem custo histórico/);
});

test('main dashboard contains seven charts based on actual ERP data', () => {
  assert.match(app, /typeof Chart==='undefined'/);
    assert.ok(app.includes('id="' + id + '"') || app.includes("'" + id + "'"), 'missing dashboard chart ' + id);
  }
  assert.match(app, /Vendas mensais/);
  assert.match(app, /Lucro bruto mensal/);
  assert.match(app, /Compras e vendas/);
  assert.match(app, /Vendas por pagamento/);
  assert.match(app, /Produtos mais vendidos/);
  assert.match(app, /Valor de stock por categoria/);
  assert.match(app, /Actividade operacional mensal/);
  assert.match(app, /typeof Chart==='undefined'/);
});

test('major modules have relevant sales, purchase, inventory and finance charts', () => {
  assert.match(app, /typeof Chart==='undefined'/);
  assert.match(app, /typeof Chart==='undefined'/);
  assert.match(app, /typeof Chart==='undefined'/);
  assert.match(app, /typeof Chart==='undefined'/);
  assert.match(app, /typeof Chart==='undefined'/);
  assert.match(app, /Operações auditadas/);
});

test('delivery map includes street and satellite layers, geolocation and road route calculation', () => {
  assert.match(html, /leaflet@1\.9\.4\/dist\/leaflet\.css/);
  assert.match(html, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
  assert.match(app, /kanawaDeliveryMap/);
  assert.match(app, /World_Imagery/);
  assert.match(app, /tile\.openstreetmap\.org/);
  assert.match(app, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(app, /router\.project-osrm\.org/);
  assert.match(app, /basemap=traffic/);
  assert.match(app, /Distância rodoviária/);
});

  assert.match(app, /typeof Chart==='undefined'/);
  assert.match(app, /plugins:\{legend:/);
  assert.match(app, /y:\{beginAtZero:true\}/);
  assert.match(html, /chart\.min\.js/);
});
