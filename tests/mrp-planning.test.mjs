import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function normalizarChaveMRP');
const end = source.indexOf('async function renderMRP', start);
assert.ok(start >= 0 && end > start, 'helpers MRP devem existir');
const calcularNecessidadesMRP = new Function(source.slice(start, end) + '; return calcularNecessidadesMRP;')();

test('MRP calcula necessidade líquida de produção e materiais com stock real', () => {
  const result = calcularNecessidadesMRP({
    produtos: [{ id: 1, nome: 'Mesa', estoque: 2 }, { id: 2, nome: 'Perna', estoque: 3 }],
    boms: [{ produto: 'Mesa', material: 'Perna', quantidade: 4, perdaPercentual: 0, estoqueSeguranca: 1, leadTimeDias: 5 }],
    planosProducao: [{ produto: 'Mesa', quantidade: 10, status: 'ativo' }],
    previsoesVendas: [], periodoDias: 30
  });
  assert.equal(result.demanda[0].necessidade, 8);
  assert.equal(result.demanda[0].status, 'produzir');
  assert.equal(result.materiais[0].demanda, 32);
  assert.equal(result.materiais[0].necessidade, 30);
  assert.equal(result.materiais[0].status, 'comprar');
});

test('MRP soma previsões e planos, aplica desperdício e stock de segurança', () => {
  const result = calcularNecessidadesMRP({
    produtos: [{ id: 1, nome: 'Caderno', estoque: 5 }, { id: 2, nome: 'Papel', estoque: 10 }],
    boms: [{ produto: 'Caderno', material: 'Papel', quantidade: 2, perdaPercentual: 10, estoqueSeguranca: 4 }],
    planosProducao: [{ produto: 'Caderno', quantidade: 10, status: 'pendente' }],
    previsoesVendas: [{ produto: 'Caderno', quantidade: 5, status: 'prevista' }],
    periodoDias: 45
  });
  assert.equal(result.demanda[0].demanda, 15);
  assert.equal(result.demanda[0].necessidade, 10);
  assert.equal(result.materiais[0].demanda, 22);
  assert.equal(result.materiais[0].necessidade, 16);
});

test('MRP identifica produto sem BOM e não inventa procura', () => {
  const result = calcularNecessidadesMRP({
    produtos: [{ id: 1, nome: 'Produto sem ficha', estoque: 0 }],
    boms: [], planosProducao: [{ produto: 'Produto sem ficha', quantidade: 3, status: 'ativo' }],
    previsoesVendas: [], periodoDias: 30
  });
  assert.equal(result.demanda[0].status, 'sem_bom');
  assert.equal(result.totais.semBOM, 1);
  assert.equal(result.materiais.length, 0);
});

test('MRP ignora planos concluídos e procura fora do horizonte', () => {
  const result = calcularNecessidadesMRP({
    produtos: [{ id: 1, nome: 'Produto', estoque: 0 }],
    boms: [], planosProducao: [{ produto: 'Produto', quantidade: 8, status: 'concluido' }],
    previsoesVendas: [{ produto: 'Produto', quantidade: 12, data: '2099-01-01' }],
    periodoDias: 10
  });
  assert.equal(result.demanda.length, 0);
  assert.equal(result.totais.produtos, 0);
});
