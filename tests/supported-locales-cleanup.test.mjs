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
  assert.match(html, /app\.js\?v=1\.0\.20261126\.1/);
});
