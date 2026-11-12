import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const app = fs.readFileSync('app/app.js', 'utf8');
const html = fs.readFileSync('app/index.html', 'utf8');
const tables = fs.readFileSync('app/table-enhancements.js', 'utf8');

test('módulo de tabelas é válido e carregado depois do núcleo ERP', () => {
  assert.doesNotThrow(() => new vm.Script(tables));
  assert.ok(html.includes('src="table-enhancements.js'));
  assert.ok(html.indexOf('src="app.js') < html.indexOf('src="table-enhancements.js'));
  assert.ok(app.includes('window.KanawaTableEnhancements.apply(c)'));
});

test('todas as tabelas renderizadas recebem pesquisa, ordenação e contador sem alterar registos', () => {
  for (const feature of ['Pesquisar nesta tabela', 'aria-sort', 'aria-live', 'body.appendChild(item.row)', 'row.hidden']) {
    assert.ok(tables.includes(feature), 'Funcionalidade de tabela ausente: ' + feature);
  }
  assert.ok(app.includes("function table(headers, rows)"));
  assert.ok(app.includes("class=\"table-wrap\""));
});

test('cada módulo do menu tem um renderizador único', () => {
  const menuMatch = app.match(/const MENU = \[([\s\S]*?)\n\];/);
  const renderMatch = app.match(/const R = \{([\s\S]*?)\n  \};/);
  assert.ok(menuMatch, 'Definição MENU não encontrada');
  assert.ok(renderMatch, 'Mapa de renderizadores não encontrado');
  const menuIds = [...menuMatch[1].matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  const rendererKeys = [...renderMatch[1].matchAll(/(?:^|,)\s*(['"]?[A-Za-z0-9_-]+['"]?)\s*:/gm)]
    .map(match => match[1].replace(/^['"]|['"]$/g, ''));
  const duplicates = rendererKeys.filter((key, index) => rendererKeys.indexOf(key) !== index);
  assert.deepEqual(duplicates, [], 'Existem chaves de módulo duplicadas no mapa R');
  const missing = menuIds.filter(id => !rendererKeys.includes(id));
  assert.deepEqual(missing, [], 'Módulos sem renderizador: ' + missing.join(', '));
});

test('todas as colecções usadas pelos módulos existem no registo IndexedDB', () => {
  const storesMatch = app.match(/const DB_STORES\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(storesMatch, 'DB_STORES não encontrado');
  const stores = [...storesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
  const appScripts = fs.readdirSync('app', { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => ({ name: entry.name, source: fs.readFileSync(path.join('app', entry.name), 'utf8') }));
  const referenced = [...new Set(appScripts.flatMap(file =>
    [...file.source.matchAll(/(?:getData|saveData|deleteData|DB\.get|DB\.put|DB\.add|DB\.del|DB\.clear)\s*\(\s*['"]([^'"]+)['"]/g)]
      .map(match => match[1])
  ))];
  const missing = referenced.filter(store => !stores.includes(store));
  assert.deepEqual(missing, [], 'Colecções sem object store IndexedDB: ' + missing.join(', '));
  assert.equal(new Set(stores).size, stores.length, 'Existem object stores duplicados');
});

test('falhas de renderização preservam o módulo e exibem a pilha técnica segura', () => {
  assert.ok(app.includes('window.__kanawaLastModuleError'));
  assert.ok(app.includes('Detalhes técnicos para suporte'));
  assert.ok(app.includes("split('\\n').slice(0, 10)"));
});

test('ordenação mantém cabeçalhos originais para impressão e exportação', () => {
  assert.ok(tables.includes("cell.addEventListener('click', sortByColumn)"));
  assert.ok(tables.includes("cell.classList.add('ks-table-sortable')"));
  assert.ok(!tables.includes('button.innerHTML = cell.innerHTML'));
  assert.ok(!tables.includes("cell.textContent = ''"));
});
