import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'app/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');

test('PDV apresenta catálogo e carrinho no mesmo ecrã', () => {
  assert.match(app, /class="pdv-workspace"/);
  assert.match(app, /class="pdv-products-panel card"/);
  assert.match(app, /class="pdv-cart-panel card"/);
  assert.match(app, /id="pdvCarrinhoFull"/);
  assert.match(app, /onclick="pdvAbrirFechoVenda\(\)"/);
  assert.match(html, /kanawa-pdv-split-screen/);
  assert.match(html, /@media\(max-width:850px\)/);
});

test('fecho da venda mantém o fluxo central e apresenta troco em tempo real', () => {
  assert.match(app, /function pdvAbrirFechoVenda\(\)/);
  assert.match(app, /function pdvAtualizarValores\(\)/);
  assert.match(app, /id="pdvValorRecebidoInput"/);
  assert.match(app, /id="pdvTrocoValue"/);
  assert.match(app, /c\.total<=0/);
  assert.match(app, /pdvState\.valorRecebido<c\.total/);
  assert.match(app, /clientEventId:\s*generateUuid\(\)/);
  assert.match(app, /pdvPendingFinalSale/);
});

test('PDV disponibiliza atalhos de teclado sem interceptar escrita nos campos', () => {
  assert.match(app, /event\.key==='F2'/);
  assert.match(app, /event\.key==='F8'/);
  assert.match(app, /event\.key==='\+'/);
  assert.match(app, /event\.key==='-'/);
  assert.match(app, /if\(!editing&&/);
});

test('validação do NIF contempla BI nacional e numeração sequencial', () => {
  assert.match(app, /function pdvValidarNif\(nif,clienteAnonimo\)/);
  assert.match(app, /\\d\{9\}\[A-Z\]\{2\}\\d\{3\}/);
  assert.match(app, /\\d\{10\}/);
  assert.match(app, /NIF fictício/);
});
