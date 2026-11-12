import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../app/sidebar.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

test('clicking one of the 10 slim category shortcuts opens a hub with module tabs and launch cards', () => {
  assert.match(app,/function openMenuGroupScreen\(groupId\)/);
  assert.match(app,/renderCategoryHub\(groupId\)/);
  assert.match(sidebar,/class="kanawa-category-nav"/);
  assert.match(sidebar,/kanawa-category-shortcut/);
  assert.match(sidebar,/function renderCategoryHub\(groupId, activeAnchorId\)/);
  assert.match(sidebar,/data-hub-anchor/);
  assert.match(sidebar,/data-hub-module/);
  assert.match(sidebar,/openModule\(id\)/);
  assert.match(app,/function toggleMenuGroup\(groupId\)\{\s*openMenuGroupScreen\(groupId\);/);
  assert.match(html,/\.kanawa-hub-grid/);
  assert.match(html,/scrollbar-width:none/);
});

test('module launcher respects the user module permissions and opens the selected module', () => {
  assert.match(app,/group\.items\.filter\(item=>podeAcessar\(item\.id\)\)/);
  assert.match(app,/if\(!items\.length\)/);
  assert.match(app,/onclick="openModule/);
  assert.match(app,/const R = \{/);
});

test('invoice numbers cannot be reserved by the client before issuance', () => {
  assert.match(cloud,/A numeração é atribuída atomicamente pelo servidor/);
  assert.match(cloud,/ks_finalize_fiscal_sale/);
  assert.doesNotMatch(cloud,/client\.rpc\('ks_next_invoice_number'/);
  assert.match(app,/numeroFatura:\s*null/);
});

test('main navigation exposes 21 shortcuts across 11 categories', () => {
  const groups = app.match(/const MENU_GROUP_DEFINITIONS=\[[\s\S]*?\n\];/);
  assert.ok(groups, 'main navigation categories must be defined');
  assert.equal((groups[0].match(/\{id:'/g) || []).length, 11);
  const shortcuts = [...groups[0].matchAll(/ids:\[([^\]]*)\]/g)]
    .flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]));
  assert.equal(shortcuts.length, 21);
  assert.match(app, /function renderModuleAnchorTabs\(moduleId\)/);
});

test('cashier PDV requires an active cash session', () => {
  assert.match(app, /actor\.role==='caixa'&&\(!window\.KanawaCloud\|\|!KanawaCloud\.ready\)/);
  assert.match(app, /const activeSession=await KanawaCloud\.getActiveCashSession\(\)/);
  assert.match(app, /Abra a sua caixa primeiro/);
  assert.match(app, /Abertura de caixa exige ligação ao servidor/);
  assert.ok(app.includes("openModule(\\'caixa\\')"));
});

test('asset and fleet maintenance routes share the unified maintenance screen', () => {
  assert.match(app, /'ativos-manutencao': renderManutencoesUnificadas, 'frota-manutencao': renderManutencoesUnificadas/);
  assert.match(app, /async function renderManutencoesUnificadas\(\)/);
});
