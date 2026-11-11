import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const app = fs.readFileSync(path.join(process.cwd(), 'app/app.js'), 'utf8');

function loadProductValidator() {
  const start = app.indexOf('function validarCamposProduto(input) {');
  assert.notEqual(start, -1, 'validador de produto deve existir');
  let depth = 0;
  let end = -1;
  for (let i = app.indexOf('{', start); i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.notEqual(end, -1, 'validador de produto deve estar completo');
  return vm.runInNewContext('(' + app.slice(start, end) + ')');
}

test('produto exige nome e os dois preços indicados como obrigatórios', () => {
  const validate = loadProductValidator();
  assert.equal(validate({ nome: '', precoCompra: '10', precoVenda: '20' }).field, 'pNome');
  assert.equal(validate({ nome: 'Produto', precoCompra: '', precoVenda: '20' }).field, 'pPrecoCompra');
  assert.equal(validate({ nome: 'Produto', precoCompra: '10', precoVenda: '' }).field, 'pPrecoVenda');
});

test('produto rejeita preços inválidos ou negativos', () => {
  const validate = loadProductValidator();
  assert.equal(validate({ nome: 'Produto', precoCompra: '-1', precoVenda: '20' }).field, 'pPrecoCompra');
  assert.equal(validate({ nome: 'Produto', precoCompra: '10', precoVenda: 'abc' }).field, 'pPrecoVenda');
  assert.equal(validate({ nome: 'Produto', precoCompra: '10', precoVenda: '20' }), null);
});

test('stock e stock mínimo não aceitam valores negativos, decimais ou inválidos', () => {
  const validate = loadProductValidator();
  const base = { nome: 'Produto', precoCompra: '10', precoVenda: '20', estoque: '2', estoqueMin: '1' };
  assert.equal(validate({ ...base, estoque: '-1' }).field, 'pEstoque');
  assert.equal(validate({ ...base, estoque: '1.5' }).field, 'pEstoque');
  assert.equal(validate({ ...base, estoqueMin: 'abc' }).field, 'pEstoqueMin');
  assert.equal(validate({ ...base, estoqueMin: '-2' }).field, 'pEstoqueMin');
  assert.equal(validate({ ...base, estoque: '', estoqueMin: '' }), null);
});

test('formulário visual marca os dois preços como obrigatórios e o guardar chama o validador', () => {
  assert.match(app, /id="pPrecoCompra"[^>]*required/);
  assert.match(app, /id="pPrecoVenda"[^>]*required/);
  assert.match(app, /const validacao = validarCamposProduto\(/);
  assert.match(app, /if \(campo\) campo\.focus\(\)/);
});

test('fornecedor valida nome, email e NIF duplicado antes de guardar', () => {
  assert.match(app, /Informe o nome do fornecedor/);
  assert.match(app, /Introduza um email válido/);
  assert.match(app, /Já existe um fornecedor registado com este NIF/);
  assert.match(app, /id="fNome" maxlength="180" required/);
  assert.match(app, /id="fEmail" type="email" maxlength="160"/);
});

test('transportadora rejeita custo base vazio, inválido ou negativo', () => {
  assert.match(app, /const custoBase = custoRaw === '' \? NaN : Number\(custoRaw\)/);
  assert.match(app, /!Number\.isFinite\(custoBase\) \|\| custoBase < 0/);
  assert.match(app, /id="tCusto" type="number" min="0" step="0\.01" value="0" required/);
});

test('compra exige produto, quantidade inteira positiva e valor válido', () => {
  assert.match(app, /Informe o produto da compra/);
  assert.match(app, /Number\.isSafeInteger\(q\) \|\| q <= 0/);
  assert.match(app, /!Number\.isFinite\(v\) \|\| v < 0/);
  assert.match(app, /id="cProd" maxlength="180" required/);
  assert.match(app, /id="cQtd" type="number" value="1" min="1" step="1" required/);
});

test('movimento de stock valida tipo, produto, quantidade e stock disponível', () => {
  assert.match(app, /!\['entrada','saida','ajuste'\]\.includes\(tipo\)/);
  assert.match(app, /Number\.isSafeInteger\(qtd\)/);
  assert.match(app, /Stock insuficiente\. Disponível:/);
  assert.match(app, /tipo === 'ajuste' \? 0 : 1/);
  assert.match(app, /id="movQtd" type="number"/);
});

test('despesa geral exige descrição e valor superior a zero', () => {
  assert.match(app, /Informe a descrição da despesa/);
  assert.match(app, /!Number\.isFinite\(amount\)\s*\|\|\s*amount\s*<=\s*0/);
  assert.match(app, /id="dgDescricao" maxlength="240" required/);
  assert.match(app, /id="dgValor" type="number" min="0\.01" step="0\.01" required/);
});
