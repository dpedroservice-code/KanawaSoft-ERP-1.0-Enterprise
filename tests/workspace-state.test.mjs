import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [storeScript, customizer, windows, html, uiCss] = await Promise.all([
  readFile(new URL('../app/workspace-state.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/layout-customizer.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/workspace-windows.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/ui-consistency.css', import.meta.url), 'utf8')
]);

function createRuntime() {
  const values = new Map();
  const listeners = {};
  const window = {
    KanawaCloud: { context: { user: { id: 'user-a' }, company: { id: 'company-a' } } },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    dispatchEvent() {},
    podeAcessar: id => id !== 'restricted-module',
    planoPermiteModulo: () => true
  };
  const context = vm.createContext({
    window,
    document: {},
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value))
    },
    CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options.detail; },
    console,
    Set,
    Map,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Math,
    encodeURIComponent,
  });
  vm.runInContext(storeScript, context);
  return { window, values, context };
}

test('global workspace state is namespaced by authenticated user and company', () => {
  const runtime = createRuntime();
  const store = runtime.window.KanawaWorkspaceState;
  store.setLayout('mode-enterprise');
  assert.equal(store.getState().preferences.layout, 'mode-enterprise');

  runtime.window.KanawaCloud.context.company.id = 'company-b';
  store.reload();
  assert.equal(store.getState().preferences.layout, 'mode-classic');

  runtime.window.KanawaCloud.context.company.id = 'company-a';
  store.reload();
  assert.equal(store.getState().preferences.layout, 'mode-enterprise');
});

test('workspace state persists layout, icon density, workspace and window geometry', () => {
  const runtime = createRuntime();
  const store = runtime.window.KanawaWorkspaceState;
  store.setPreferences({ layout: 'mode-compact', iconSize: 'large' });
  store.setWorkspace('operator', { dock: { state: 'docked-right', width: 280 } });
  store.setWindowLayouts({ pdv: { x: 20, y: 30, width: 640, height: 480, docked: false } });
  const saved = store.getState();
  assert.equal(saved.preferences.layout, 'mode-compact');
  assert.equal(saved.preferences.iconSize, 'large');
  assert.equal(saved.workspace.active, 'operator');
  assert.equal(saved.windows.pdv.width, 640);
});

test('named workspaces save and restore independent preferences and window geometry', () => {
  const runtime = createRuntime();
  const store = runtime.window.KanawaWorkspaceState;
  store.setPreferences({ layout: 'mode-enterprise', iconSize: 'large' });
  store.setWindowLayouts({ pdv: { x: 12, y: 18, width: 680, height: 500, docked: false } });
  store.saveWorkspace('operator');
  store.setPreferences({ layout: 'mode-classic', iconSize: 'normal' });
  store.setWindowLayouts({});
  assert.equal(store.loadWorkspace('operator'), true);
  assert.equal(store.getState().preferences.layout, 'mode-enterprise');
  assert.equal(store.getState().preferences.iconSize, 'large');
  assert.equal(store.getState().windows.pdv.width, 680);
  assert.equal(store.getState().workspace.active, 'operator');
});

test('global state never grants module permissions', () => {
  const runtime = createRuntime();
  const store = runtime.window.KanawaWorkspaceState;
  assert.equal(store.canOpenModule('dashboard'), true);
  assert.equal(store.canOpenModule('restricted-module'), false);
  assert.equal(typeof store.setPermissions, 'undefined');
});

test('layout customizer and floating windows consume the shared state manager', () => {
  assert.match(customizer, /KanawaWorkspaceState/);
  assert.match(customizer, /setWorkspace\(workspace, preferences\)/);
  assert.match(windows, /setWindowLayouts\(data\)/);
  assert.match(windows, /workspaceState\.canOpenModule\(id\)/);
  assert.match(windows, /function renderTabs\(\)/);
  assert.match(windows, /kanawa-window-tab/);
  assert.match(windows, /setMode: \(id, mode\)/);
  assert.match(windows, /docked: saved\.docked !== false/);
  assert.match(html, /\.kanawa-window-tabs/);
  assert.match(html, /\.kanawa-window-tab\.is-active/);
  assert.ok(html.indexOf('workspace-state.js') < html.indexOf('workspace-windows.js'));
  assert.ok(html.indexOf('workspace-windows.js') < html.indexOf('layout-customizer.js'));
});

test('scoped DOM lookup falls back to native lookup on recursive selector re-entry', () => {
  assert.match(windows, /const nativeElementQuery = Element\.prototype\.querySelector/);
  assert.match(windows, /let resolvingScopedId = false/);
  assert.match(windows, /if \(resolvingScopedId\) return nativeGetById\(id\)/);
  assert.match(windows, /nativeElementQuery\.call\(root/);
});

test('scoped querySelector does not return elements from inactive module windows', () => {
  assert.match(windows, /const globalFound = nativeQuery\(selector\)/);
  assert.match(windows, /globalFound\.closest\('.kanawa-module-window'\)\) return null/);
});

test('scoped document selector recognises IDs containing digits and hyphens', () => {
  const patternSource = windows.match(/\/(\^#\[A-Za-z_\]\[\\w-\]\*\$)\//);
  assert.ok(patternSource, 'ID selector must use the JavaScript word-character class');
  const pattern = new RegExp(patternSource[1]);
  assert.equal(pattern.test('#content2'), true);
  assert.equal(pattern.test('#module-tab_3'), true);
});

test('reopening an existing module refreshes its renderer while tab focus stays separate', () => {
  assert.match(windows, /if \(windows\.has\(id\)\) \{[\s\S]*?openingModules\.add\(id\);[\s\S]*?await originalOpenModule\.apply\(this, arguments\);[\s\S]*?openingModules\.delete\(id\)/);
  assert.match(windows, /tab\.addEventListener\('click', \(\) => focusWindow\(id\)\)/);
  assert.match(windows, /async function retryModule\(id\)[\s\S]*?await originalOpenModule\.call\(window, id\)/);
});

test('legacy layout and window preference keys remain readable for migration', () => {
  assert.match(storeScript, /kanawa_layout_preferences_v1:/);
  assert.match(storeScript, /kanawa_workspace_layout_v1:/);
  assert.match(storeScript, /readLegacy/);
  assert.match(storeScript, /saveWorkspace/);
  assert.match(storeScript, /loadWorkspace/);
});


test('shared UI system styles forms, controls, typography and tables in light and dark themes', () => {
  assert.match(html, /ui-consistency\.css/);
  assert.match(uiCss, /html\[data-theme="dark"\]/);
  assert.match(uiCss, /:focus-visible/);
  assert.match(uiCss, /textarea/);
  assert.match(uiCss, /form-actions/);
  assert.match(uiCss, /table/);
  assert.match(uiCss, /prefers-reduced-motion/);
});
