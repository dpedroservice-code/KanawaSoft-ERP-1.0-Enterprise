import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/ui-consistency.css', import.meta.url), 'utf8');

test('logo returns home and the independent bars button opens the module menu', () => {
  assert.match(html, /id="topbarHomeButton"[^>]*onclick="kanawaLogoAction\(\)"/);
  assert.match(html, /id="topbarModulesToggle"[^>]*onclick="kanawaMenuAction\(\)"/);
  assert.doesNotMatch(html, /topbar-nav-trigger[^>]*>[\s\S]*?topbar-logo/);
  assert.match(app, /function kanawaLogoAction\(\)\s*\{\s*if \(\$\('app'\)[\s\S]*?openModule\('dashboard'\)/);
  assert.match(app, /function kanawaMenuAction\(\)\s*\{\s*toggleMegaMenu\(\)/);
});

test('restored Supabase sessions open the dashboard instead of returning to the package intro', () => {
  assert.match(app, /await kanawaFinishAuthentication\(cloudContext\);\s*hideLoadingScreen\(\)/);
  assert.match(app, /window\.__kanawaPendingCloudContext = cloudContext;\s*await kanawaFinishAuthentication\(cloudContext\);/);
  assert.match(cloud, /auth:\s*\{\s*autoRefreshToken:\s*true,\s*persistSession:\s*true/);
});

test('startup, package page and dashboard expose database sync and system update controls', () => {
  assert.match(html, /class="loading-actions"/);
  assert.match(html, /onclick="atualizarDadosKanawa\(\)"/);
  assert.match(html, /onclick="atualizarKanawaServidor\(\)"/);
  assert.match(app, /async function atualizarDadosKanawa\(\)/);
  assert.match(app, /data-kanawa-database-refresh/);
  assert.match(app, /data-kanawa-refresh/);
  assert.match(app, /async function atualizarKanawaServidor\(\)/);
  assert.match(app, /window\.location\.replace\(target\.href\)/);
});

test('one top navigation replaces the old lateral sidebar at desktop and mobile sizes', () => {
  assert.match(css, /#app #sidebar\.sidebar\{position:absolute!important;inset:0 0 auto 0!important/);
  assert.match(css, /#app \.main-wrap\{position:relative!important;display:block!important/);
  assert.match(css, /@media\(max-width:900px\)[\s\S]*?#app #sidebar\.sidebar\{position:absolute!important/);
});
