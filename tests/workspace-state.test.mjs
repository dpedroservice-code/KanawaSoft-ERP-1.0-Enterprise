import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../app/', import.meta.url);
const [html, app, responsive, ui] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('responsive.css', root), 'utf8'),
  readFile(new URL('ui-consistency.css', root), 'utf8')
]);

test('the shell does not load a separate workspace state or floating-window engine', () => {
  assert.doesNotMatch(html, /workspace-state\.js|workspace-windows\.js|layout-customizer\.js/);
  assert.doesNotMatch(responsive, /kanawa-window-tabs|kanawa-module-window|kanawa-workspace-layer/);
});

test('opening a module replaces the current content instead of creating another window', () => {
  assert.match(app, /async function openModule\(id\)[\s\S]*?currentModule = id;[\s\S]*?const c = \$\('content'\);[\s\S]*?c\.innerHTML =/);
  assert.doesNotMatch(app, /kanawaWorkspace|kanawa-module-window|kanawa-window-resize/);
});

test('module navigation menu is available only on the dashboard', () => {
  assert.match(app, /function toggleMegaMenu\(force\)\{\s*if \(currentModule !== 'dashboard'\)/);
  assert.match(ui, /kanawa-topbar-collapsed #topbarModulesToggle\{display:none!important\}/);
  assert.match(ui, /kanawa-topbar-collapsed \.main-wrap>#sidebar\{display:none!important\}/);
});
