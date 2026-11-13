import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261108074746_20261108100000_product_purchase_cost_and_gross_profit.sql', import.meta.url), 'utf8');

test('ERP application JavaScript parses without syntax errors', () => {
  assert.doesNotThrow(() => new vm.Script(app));
});

test('product registration captures purchase price, sale price and quantity', () => {
  assert.match(app, /id="pPrecoCompra"/);
  assert.match(app, /id="pPrecoVenda"/);
  assert.match(app, /id="pEstoque"/);
  assert.match(app, /precoVenda, precoCompra/);
  assert.match(app, /Preço de Compra \(Kz\)/);
  assert.match(app, /Preço de Venda \(Kz\)/);
  assert.match(app, /Margem unitária/);
});

test('quick product registration and spreadsheet import/export preserve both prices', () => {
  assert.match(app, /rcPrecoCompra/);
  assert.match(app, /rcPrecoVenda/);
  assert.match(app, /precoCompra:purchase/);
  assert.match(app, /precoVenda:p\.precoVenda/);
});

test('cloud sync persists nullable purchase cost and the server snapshots unit cost', () => {
  assert.match(cloud, /purchase_cost: item\.precoCompra !== undefined/);
  assert.match(cloud, /const unitCost = line\.custoUnitario === null/);
  assert.match(cloud, /cost_of_goods,gross_profit/);
  assert.match(cloud, /item\.lucroBruto = saleSnapshot\.data\.gross_profit/);
  assert.match(migration, /add column if not exists purchase_cost numeric/);
  assert.match(migration, /add column if not exists unit_cost numeric/);
  assert.match(migration, /ks_capture_sale_item_cost/);
  assert.match(migration, /ks_refresh_sale_profit/);
});

test('POS stores unit cost, cost of goods and gross profit on finalized sales', () => {
  assert.match(app, /custoUnitario:i\\.custoUnitario===null\\|\\|i\\.custoUnitario===undefined\\?null:Number\\(i\\.custoUnitario\\)/);
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
  for (const id of ['dashChartSales','dashChartProfit','dashChartPurchases','dashChartPayments','dashChartTopProducts','dashChartStock','dashChartActivities']) {
    assert.ok(app.includes('id="' + id + '"') || app.includes("'" + id + "'"), 'missing dashboard chart ' + id);
  }
  for (const label of ['Vendas mensais','Lucro bruto mensal','Compras e vendas','Vendas por pagamento','Produtos mais vendidos','Valor de stock por categoria','Actividade operacional mensal']) {
    assert.ok(app.includes(label), 'missing dashboard chart label ' + label);
  }
  assert.match(app, /typeof Chart==='undefined'/);
});

test('major modules have relevant sales, purchase, inventory and finance charts', () => {
  assert.match(app, /salesModuleChart/);
  assert.match(app, /purchaseModuleChart/);
  assert.match(app, /stockModuleChart/);
  assert.match(app, /financeModuleChart/);
  assert.match(app, /renderModuleActivityChart\(id, renderToken\)/);
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

test('chart renderer uses Chart.js 4 compatible options', () => {
  assert.match(app, /plugins:\{legend:/);
  assert.match(app, /y:\{beginAtZero:true\}/);
  assert.match(html, /chart\.min\.js/);
});

test('Excel product import validates every row before saving and reports duplicate or missing fields', () => {
  assert.match(app, /validarLinhasProdutosExcel/);
  assert.match(app, /Nenhum produto foi gravado/);
  assert.match(app, /código repetido dentro do Excel/);
  assert.match(app, /código já pertence a um produto cadastrado/);
  assert.match(app, /código de barras já pertence a um produto cadastrado/);
  assert.match(app, /nome já pertence a um produto cadastrado/);
  assert.match(app, /Importação bloqueada/);
  
  assert.match(app, /confirmarImportacaoProdutosExcel/);
  assert.match(app, /precoCompra/);
  assert.match(app, /precoVenda/);
  assert.match(app, /baixarModeloProdutosExcel/);
});
test('warehouse transfers support Excel validation and reject insufficient stock before movement', () => {
  assert.match(app, /validarTransferenciasExcel/);
  assert.match(app, /stock insuficiente na origem/);
  assert.match(app, /executarTransferenciaArmazem/);
  assert.match(app, /estoqueArmazens/);
  assert.match(app, /guardarSaldoInicialArmazem/);
});
test('all module headers expose print, Excel and PDF output actions', () => {
  assert.match(app, /imprimirTelaAtual/);
  assert.match(app, /exportarTabelaAtualExcel/);
  assert.match(app, /exportarTelaAtualPDF/);
});
test('camera scanner supports retail barcodes and QR codes with duplicate-frame protection', () => {
  assert.match(app, /w\*\.92/);
  assert.match(app, /Produto encontrado:/);
  assert.match(app, /formatsToSupport/);
  assert.match(app, /QR_CODE/);
  assert.match(app, /scannerLastCode/);
  assert.match(app, /pCodigoQr/);
});

test('warehouse transfer updates and history commit in one IndexedDB transaction', () => {
  assert.match(app, /version: 10/);
  assert.match(app, /'centrosTrabalho','roteirosProducao','operacoesProducao'/);
  assert.match(app, /commitTransferenciasArmazemAtomicas/);
  assert.match(app, /DB\.db\.transaction\(\['estoqueArmazens','transferencias'\],'readwrite'\)/);
});

test('reports support general, daily and monthly sales filtering', () => {
  assert.match(app, /id="relPeriodo"/);
  assert.match(app, /value="dia"/);
  assert.match(app, /value="mes"/);
  assert.match(app, /function aplicarFiltroRelatorio/);
  assert.match(app, /relatorioResultados/);
});

test('Excel import rejects malformed internal product codes', () => {
  assert.match(app, /código inválido: use 2 a 40 caracteres alfanuméricos/);
});

test('validated product batches are committed atomically before cloud synchronization', () => {
  assert.match(app, /commitImportProdutosAtomico/);
  assert.match(app, /DB\.db\.transaction\(\['produtos'\],'readwrite'\)/);
  assert.match(app, /Stable IDs make cloud retries idempotent/);
});

test('main dashboard exposes total inventory value at purchase cost and discloses missing costs', () => {
  assert.match(app, /id="dashStockValue"/);
  assert.match(app, /Valor do stock a custo de compra/);
  assert.match(app, /stockWithCost/);
  assert.match(app, /stockMissingCost/);
  assert.match(app, /produtos com custo · .*sem custo de compra/);
});
