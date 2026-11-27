import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const i18nPath = new URL('../app/i18n.js', import.meta.url);
const appPath = new URL('../app/app.js', import.meta.url);
const indexPath = new URL('../app/index.html', import.meta.url);

test('only Portuguese, English, French and Spanish are supported', async () => {
  const i18n = await readFile(i18nPath, 'utf8');
  assert.match(i18n, /const SUPPORTED = \['pt', 'en', 'fr', 'es'\]/);
  assert.match(i18n, /pt: 'Português \(Angola\)', en: 'English', fr: 'Français', es: 'Español'/);
  assert.doesNotMatch(i18n, /catalogs\.(zh|ar|ln|cjk|umb|kmb|kon)\b/);
  assert.doesNotMatch(i18n, /中文|العربية|Lingála|Cokwe|Umbundu|Kimbundu|Kikongo/);
});

test('unused language dictionaries are removed from the shipped locale bundle', async () => {
  const i18n = await readFile(i18nPath, 'utf8');
  assert.ok(Buffer.byteLength(i18n, 'utf8') < 120 * 1024, 'locale bundle should stay below 120 KiB');
  assert.match(i18n, /function renderLanguageSettings\(\)/);
  assert.match(i18n, /SUPPORTED\.map/);
});

test('loading screen does not rotate through removed languages or run a greeting timer', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.doesNotMatch(app, /KANAWA_LOADING_GREETINGS|KANAWA_LOADING_LANGUAGE_NAMES|kanawaGreetingTimer|kanawaStartLoadingGreetings/);
});

test('HTML requests the refreshed app and locale assets', async () => {
  const html = await readFile(indexPath, 'utf8');
  assert.match(html, /i18n\.js\?v=1\.0\.20261126\.1/);
  assert.match(html, /app\.js\?v=1\.0\.20261127\.11/);
  assert.match(html, /responsive-viewport\.js\?v=1\.0\.20261127\.1/);
});

test('launch experience uses one animated forest backdrop and a centered processing ring in external CSS', async () => {
  const html = await readFile(indexPath, 'utf8');
  const css = await readFile(new URL('../app/ui-consistency.css', import.meta.url), 'utf8');
  assert.match(html, /class="loading-orbit"/);
  assert.match(html, /class="loading-logo"/);
  assert.doesNotMatch(html, /<style\b/i);
  assert.match(css, /data:image\/gif;base64,/);
  assert.match(css, /loading-orbit::before/);
  assert.match(css, /forest-drift/);
});

test('the ERP ships one fixed light theme and no theme picker', async () => {
  const app = await readFile(appPath, 'utf8');
  const html = await readFile(indexPath, 'utf8');
  const css = await readFile(new URL('../app/ui-consistency.css', import.meta.url), 'utf8');
  assert.match(html, /<html[^>]*data-theme="light"/);
  assert.match(app, /setAttribute\('data-theme', 'light'\)/);
  assert.doesNotMatch(app, /aplicarTema\(|abrirSeletorTema|toggleTheme/);
  assert.doesNotMatch(css, /\[data-theme="blue"\]|\[data-theme="dark"\]/);
});
