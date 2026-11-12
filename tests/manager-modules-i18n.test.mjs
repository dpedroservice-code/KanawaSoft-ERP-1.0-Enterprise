import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const app = read('app/app.js');
const cloud = read('app/cloud.js');
const i18n = read('app/i18n.js');
const html = read('app/index.html');
const migration = read('supabase/migrations/20261112092000_manager_team_audit_language.sql');

test('manager navigation exposes team, audit and reports outside administrator-only settings', () => {
  assert.match(app, /id:'gestao',label:'Gestão e Relatórios'/);
  assert.match(app, /ids:\['relatorios','auditoria','usuarios'\]/);
  assert.match(app, /gerente: \{ modulos: \['dashboard','idioma','usuarios','auditoria'/);
  assert.match(app, /relatorios: renderRelatorios/);
  assert.match(app, /usuarios: renderUsuarios, auditoria: renderAuditoria/);
});

test('all manager modules have both a navigation entry and a renderer', () => {
  const role = app.match(/gerente: \{ modulos: \[([\s\S]*?)\], acoes:/);
  const menu = app.match(/const MENU = \[([\s\S]*?)\n\];/);
  const tabs = app.match(/const MENU_INTERNAL_TABS = \{([\s\S]*?)\n\};/);
  const renderers = app.match(/const R = \{([\s\S]*?)\n  \};/);
  assert.ok(role && menu && tabs && renderers);
  const modules = Array.from(role[1].matchAll(/'([^']+)'/g), match => match[1]);
  const navigation = new Set([
    ...Array.from(menu[1].matchAll(/\{\s*id:\s*'([^']+)'/g), match => match[1]),
    ...Array.from(tabs[1].matchAll(/'([^']+)'/g), match => match[1])
  ]);
  const availableRenderers = new Set(Array.from(
    renderers[1].matchAll(/(?:^|,|\n)\s*(?:'([^']+)'|([A-Za-z0-9_-]+))\s*:/g),
    match => match[1] || match[2]
  ));
  assert.deepEqual(modules.filter(id => !navigation.has(id)), []);
  assert.deepEqual(modules.filter(id => !availableRenderers.has(id)), []);
});

test('language preferences are available to all operational roles', () => {
  assert.match(app, /id: 'idioma', icon: 'fa-language'/);
  assert.match(app, /preferencias.*ids:\['perfil','idioma'\]/);
  assert.match(app, /idioma: renderIdioma/);
  assert.match(app, /window\.KanawaI18n\.renderLanguageSettings\(\)/);
  for (const locale of ['pt', 'en', 'fr', 'es', 'zh', 'ar']) assert.match(i18n, new RegExp("'" + locale + "'"));
});

test('language engine is loaded before the ERP application and supports RTL', () => {
  const languageIndex = html.indexOf('i18n.js?v=1.0.20261112.1');
  const appIndex = html.indexOf('app.js?v=');
  assert.ok(languageIndex >= 0 && appIndex > languageIndex);
  assert.match(i18n, /document\.documentElement\.dir = locale === 'ar' \? 'rtl' : 'ltr'/);
  assert.match(i18n, /updatePreferredLanguage/);
});

test('manager invitation uses a company-scoped RPC instead of administrator-only invitation RPC', () => {
  assert.match(cloud, /ks_create_team_invitation_for_company/);
  assert.match(cloud, /p_company_id: context\.company\.id/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ks_create_team_invitation_for_company/);
  assert.match(migration, /O gerente só pode convidar operadores/);
  assert.match(migration, /supervisor_user_id/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.ks_redeem_team_invitation/);
  assert.match(migration, /supervisor_user_id = EXCLUDED\.supervisor_user_id/);
  assert.match(migration, /p_role <> 'operator'/);
});

test('audit storage and tenant-scoped read/write policies are prepared in migration', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ks_audit_events/);
  assert.match(migration, /CREATE POLICY ks_audit_events_read_scoped/);
  assert.match(migration, /CREATE POLICY ks_audit_events_insert_own/);
  assert.match(app, /Não foi possível consultar a auditoria/);
  assert.match(app, /Ainda não existem registos de auditoria para apresentar/);
});

test('manager module errors have a local audit fallback and team rendering remains guarded', () => {
  assert.match(app, /async function renderAuditoria\(\)[\s\S]*?catch \(error\)[\s\S]*?getData\('auditoria'\)/);
  assert.match(app, /async function renderUsuarios\(\)[\s\S]*?KanawaCloud\.listTeamMembers\(\)[\s\S]*?KanawaCloud\.listTeamInvitations\(\)/);
  assert.match(app, /pendingApproval=member\.status==='pending_approval'\|\|member\.status==='invited'/);
  assert.match(i18n, /Gestão E-commerce/);
});
