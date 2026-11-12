import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const i18n=read('app/i18n.js'),app=read('app/app.js'),cloud=read('app/cloud.js'),index=read('app/index.html');
const migration=read('supabase/migrations/20261112160000_multilingual_preferences.sql');
test('all eleven requested locales are selectable and persisted',()=>{
 for(const [code,name] of Object.entries({pt:'Português (Angola)',en:'English',fr:'Français',es:'Español',zh:'中文（普通话）',ar:'العربية',ln:'Lingála',cjk:'Cokwe (Chokwe)',umb:'Umbundu',kmb:'Kimbundu',kon:'Kikongo'})){
  assert.ok(i18n.includes(code+':'));assert.ok(i18n.includes(name));assert.ok(cloud.includes("'"+code+"'"));assert.ok(migration.includes("'"+code+"'"));
 }
});
test('language settings are accessible to operational roles and loaded before modules',()=>{
 assert.match(app,/id: 'idioma', icon: 'fa-language'/);assert.match(app,/idioma: renderIdioma/);
 assert.match(app,/modulos: \['dashboard','idioma'/);assert.match(app,/await KanawaI18n\.loadPreference\(\)/);
});
test('language engine loads before ERP app and standalone pages',()=>{
 assert.ok(index.indexOf('i18n.js?v=1.0.20261112.1')<index.indexOf('app.js?v='));
 assert.match(read('app/conformidade.html'),/i18n\.js\?v=1\.0\.20261112\.1/);
 assert.match(read('app/integracoes.html'),/i18n\.js\?v=1\.0\.20261112\.1/);
});
test('profile preference supports all locales and creates a missing profile safely',()=>{
 assert.match(cloud,/async getPreferredLanguage\(\)/);assert.match(cloud,/async updatePreferredLanguage\(language\)/);
 assert.match(cloud,/upsert\(\{[\s\S]*?preferred_language: canonical/);
 assert.match(migration,/CHECK \(preferred_language IN \('pt','en','fr','es','zh','ar','ln','cjk','umb','kmb','kon'\)\)/);
});
test('Arabic is right-to-left and translated attributes preserve original source on language switches',()=>{
 assert.match(i18n,/document\.documentElement\.dir = locale === 'ar' \? 'rtl' : 'ltr'/);
 assert.match(i18n,/lastApplied/);assert.match(i18n,/entry\.source/);
});
test('national languages are clearly identified as starter translations with Portuguese fallback',()=>{
 assert.match(i18n,/Umbundu · Kimbundu · Kikongo/);
 assert.match(i18n,/\['ln', 'cjk', 'umb', 'kmb', 'kon'\]\.includes\(locale\) \? value/);
});
