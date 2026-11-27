import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../app/', import.meta.url);
const [html, app, ui, responsive] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('ui-consistency.css', root), 'utf8'),
  readFile(new URL('responsive.css', root), 'utf8')
]);

test('the interface no longer loads theme or layout customizers', () => {
  assert.doesNotMatch(html, /layout-customizer|workspace-state|workspace-windows/);
  assert.doesNotMatch(app, /abrirSeletorTema|kanawaLayoutCustomizer|aplicarTema\(/);
  assert.doesNotMatch(ui, /data-theme="blue"|data-theme="dark"/);
});

test('the ERP uses one fixed light theme and no interface zoom controls', () => {
  assert.match(html, /<html[^>]*data-theme="light"/);
  assert.match(app, /setAttribute\('data-theme', 'light'\)/);
  assert.doesNotMatch(app, /dashboard-zoom-controls|ajustarZoomInterface|kanawa_ui_zoom/);
  assert.doesNotMatch(ui, /dashboard-zoom-controls|kanawa-ui-zoom/);
});

test('module pages use a full-width flat header and a single content surface', () => {
  assert.match(app, /class="module-page-header"/);
  assert.match(ui, /#app \.main-wrap>\.content\{[^}]*width:100%/);
  assert.match(ui, /#app \.content>\.module-page-header[^}]*border:0/);
});

test('the floating, dockable and resizable module workspace has been removed', () => {
  assert.doesNotMatch(html, /workspace-windows\.js|workspace-state\.js/);
  assert.doesNotMatch(responsive, /kanawa-workspace-layer|kanawa-module-window|kanawa-window-resize/);
});
