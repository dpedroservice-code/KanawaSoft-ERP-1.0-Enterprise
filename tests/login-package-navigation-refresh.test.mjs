import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/ui-consistency.css', import.meta.url), 'utf8');

test('login can return to package selection without losing the pending email', () => {
  assert.match(html, /class="auth-back-btn"[^>]*onclick="voltarParaEscolhaPacote\(\)"/);
  assert.match(app, /function voltarParaEscolhaPacote\(\)/);
  assert.match(app, /localStorage\.setItem\('kanawa_pending_email', email\)/);
  assert.match(app, /kanawaShowPlanWelcome\(localStorage\.getItem\('kanawa_expired_plan_gate'\) === 'true'\)/);
});

test('package and login screens expose a refresh action with the animated brand loading screen', () => {
  assert.equal((html.match(/data-kanawa-refresh/g) || []).length, 2);
  assert.match(html, /id="loadingScreen"/);
  assert.match(html, /class="loading-orbit"/);
  assert.match(html, /class="loading-logo"/);
  assert.match(app, /async function atualizarKanawaServidor\(\)/);
  assert.match(app, /cache: 'no-store'/);
  assert.match(app, /window\.location\.replace\(target\.href\)/);
  assert.match(css, /kanawa-refresh-spin/);
});
