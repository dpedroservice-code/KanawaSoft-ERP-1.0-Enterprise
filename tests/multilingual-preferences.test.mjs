import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const i18n = read('app/i18n.js');
const app = read('app/app.js');
const cloud = read('app/cloud.js');
const index = read('app/index.html');
const migration = read('supabase/migrations/20261126240000_four_language_preference.sql');

test('only Portuguese, English, French and Spanish are selectable and persisted', () => {
  assert.match(i18n, /const SUPPORTED = \['pt', 'en', 'fr', 'es'\]/);
  for (const name of ['Português (Angola)', 'English', 'Français', 'Español']) assert.ok(i18n.includes(name));
  assert.ok(cloud.includes("const supported = ['pt','en','fr','es']"));
  assert.match(migration, /CHECK \(preferred_language IN \('pt','en','fr','es'\)\)/);
  assert.doesNotMatch(i18n, /catalogs\.(zh|ar|ln|cjk|umb|kmb|kon)\b/);
});

test('language settings remain accessible to operational roles and load before modules', () => {
  assert.match(app, /id: 'idioma', icon: 'fa-language'/);
  assert.match(app, /idioma: renderIdioma/);
  assert.match(app, /modulos: \['dashboard','idioma'/);
  assert.match(app, /await KanawaI18n\.loadPreference\(\)/);
});

test('language engine loads before ERP app and standalone pages use the refreshed bundle', () => {
  assert.ok(index.indexOf('i18n.js?v=1.0.20261126.1') < index.indexOf('app.js?v='));
  assert.match(read('app/conformidade.html'), /i18n\.js\?v=1\.0\.20261126\.1/);
  assert.match(read('app/integracoes.html'), /i18n\.js\?v=1\.0\.20261126\.1/);
});

test('profile preference accepts only maintained locales and creates a missing profile safely', () => {
  assert.match(cloud, /async getPreferredLanguage\(\)/);
  assert.match(cloud, /async updatePreferredLanguage\(language\)/);
  assert.match(cloud, /upsert\(\{[\s\S]*?preferred_language: canonical/);
  assert.match(migration, /UPDATE public\.ks_profiles[\s\S]*?SET preferred_language = 'pt'/);
});

test('layout remains left-to-right and translated attributes preserve original source on language switches', () => {
  assert.match(i18n, /document\.documentElement\.dir = 'ltr'/);
  assert.match(i18n, /lastApplied/);
  assert.match(i18n, /entry\.source/);
});

test('removed language catalogues are no longer shipped and Portuguese remains the fallback', () => {
  assert.doesNotMatch(i18n, /中文|العربية|Lingála|Cokwe|Umbundu|Kimbundu|Kikongo/);
  assert.match(i18n, /dictionary\[value\] \|\| \(locale !== 'pt' \?/);
});
