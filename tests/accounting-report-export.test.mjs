import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app=fs.readFileSync(path.join(process.cwd(),'app/app.js'),'utf8');

test('accounting report export uses existing tenant-scoped RPCs, not generic raw tables',()=>{
  assert.match(app,/async function exportarRelatorioContabilCSV\(\)/);
  assert.match(app,/KanawaCloud\.getAccountingSnapshot\(\)/);
  assert.match(app,/KanawaCloud\.getAccountingReports\(from,to\)/);
  assert.doesNotMatch(app,/from\(['"]contabilidade_diario_linhas['"]\)/);
});

test('CSV export escapes values and includes an Excel-compatible UTF-8 BOM',()=>{
  assert.ok(app.includes("replace(/\\"/g, '\\"\\"')"));
  assert.match(app,/new Blob\(\['\\uFEFF',csv\]/);
  assert.match(app,/text\/csv;charset=utf-8/);
});

test('accounting screen exposes CSV export and print actions',()=>{
  assert.match(app,/onclick="exportarRelatorioContabilCSV\(\)"/);
  assert.match(app,/onclick="imprimirRelatorioContabil\(\)"/);
  assert.match(app,/'exportarRelatorioContabilCSV','imprimirRelatorioContabil'/);
});
