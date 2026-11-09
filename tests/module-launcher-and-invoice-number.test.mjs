import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../app/sidebar.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

test('clicking a top-level group opens a module selection screen, not a dropdown list', () => {
  assert.match(app,/function openMenuGroupScreen\(groupId\)/);
  assert.match(sidebar,/class="mega-menu-grid"/);
  assert.match(sidebar,/class="mega-menu-module"/);
  assert.match(sidebar,/onclick="openModule\(/);
  assert.match(app,/function toggleMenuGroup\(groupId\)\{\s*openMenuGroupScreen\(groupId\);/);
  assert.match(html,/\.mega-menu-grid/);
});

test('module launcher respects the user module permissions and opens the selected module', () => {
  assert.match(app,/group\.items\.filter\(item=>podeAcessar\(item\.id\)\)/);
  assert.match(app,/if\(!items\.length\)/);
  assert.match(app,/onclick="openModule/);
  assert.match(app,/const R = \{/);
});

test('official invoice number validation accepts a real FT-year-sequence value', () => {
  const validator = cloud.match(/!\/(\^FT-[^/]+\$)\//);
  assert.ok(validator, 'invoice number format validator must exist');
  const pattern = new RegExp(validator[1]);
  assert.equal(pattern.test('FT-2026-000001'), true);
  assert.equal(pattern.test('FT-2026-1'), false);
  assert.equal(pattern.test('RASCUNHO-2026-000001'), false);
});

test('main navigation exposes exactly 19 shortcuts across 10 categories', () => {
  const groups = app.match(/const MENU_GROUP_DEFINITIONS=\[[\s\S]*?\n\];/);
  assert.ok(groups, 'main navigation categories must be defined');
  assert.equal((groups[0].match(/\{id:'/g) || []).length, 10);
  const shortcuts = [...groups[0].matchAll(/ids:\[([^\]]*)\]/g)]
    .flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]));
  assert.equal(shortcuts.length, 19);
  assert.match(app, /function renderModuleAnchorTabs\(moduleId\)/);
});

test('cashier PDV requires an active cash session', () => {
  assert.match(app, /actor\.role==='caixa'&&window\.KanawaCloud&&KanawaCloud\.ready/);
  assert.match(app, /Abra a sua caixa primeiro/);
  assert.match(app, /Abertura de caixa exige ligação ao servidor/);
  assert.ok(app.includes("openModule(\\'caixa\\')"));
});

test('asset and fleet maintenance routes share the unified maintenance screen', () => {
  assert.match(app, /'ativos-manutencao': renderManutencoesUnificadas, 'frota-manutencao': renderManutencoesUnificadas/);
  assert.match(app, /async function renderManutencoesUnificadas\(\)/);
});
