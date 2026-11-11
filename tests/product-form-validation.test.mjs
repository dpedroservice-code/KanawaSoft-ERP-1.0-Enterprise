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
