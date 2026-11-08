import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app=fs.readFileSync(path.join(process.cwd(),'app/app.js'),'utf8');

test('production costs screen shows category totals, quantities and unit cost',()=>{
  assert.match(app,/async function renderCustosProducao\(\)/);
  assert.match(app,/Custo médio por unidade/);
  assert.match(app,/custoUnitario: total \/ quantidade/);
  assert.match(app,/Materiais/);
  assert.match(app,/Mão de obra/);
  assert.match(app,/Custos indirectos/);
});

test('production cost form validates quantity and non-negative costs before saving',()=>{
  assert.match(app,/async function salvarCustoProducao\(id\)/);
  assert.match(app,/quantidade <= 0/);
  assert.match(app,/v < 0/);
  assert.match(app,/total <= 0/);
});

test('production costs expose print, Excel and PDF exports',()=>{
  assert.match(app,/onclick="imprimirTelaAtual\(\)"/);
  assert.match(app,/onclick="exportarTabelaAtualExcel\(\)"/);
  assert.match(app,/onclick="exportarTelaAtualPDF\(\)"/);
});

test('production cost activity uses the same module id as the activity chart',()=>{
  assert.match(app,/custosProducao:'custos-producao'/);
  assert.match(app,/resourceType=modulo==='custosProducao'\?'custos-producao':modulo/);
});

test('module activity chart reads tenant-scoped Supabase audit events',()=>{
  assert.match(app,/KanawaCloud\.listAuditEvents\(500\)/);
  assert.match(app,/resource_type/);
  assert.match(app,/resourceType=modulo==='custosProducao'\?'custos-producao':modulo/);
});
