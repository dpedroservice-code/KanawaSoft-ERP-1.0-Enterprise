import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const manual = readFileSync(new URL('../app/manual-apoio-utilizador.html', import.meta.url), 'utf8');

test('public plan selector advertises the configured SaaS quotas', () => {
  for (const text of ['15.000 Kz', '35.000 Kz', '75.000 Kz', 'Até 3', 'Até 10', 'Até 25', 'Até 500', 'Até 2.500', 'Até 10.000', '14 dias']) {
    assert.ok(html.includes(text), 'missing plan information: ' + text);
  }
  assert.doesNotMatch(html, /Utilizadores ilimitados|Facturas e operações ilimitadas/);
  assert.doesNotMatch(html, /Todos os pacotes pagos incluem .* utilização ilimitada/);
});

test('loading screen uses the logo animation instead of fake progress bars', () => {
  assert.match(html, /kanawa-logo-spin/);
  assert.doesNotMatch(html, /class="loading-bar"/);
  assert.doesNotMatch(html, /class="loading-spinner"/);
});

test('greeting follows the device local timezone', () => {
  assert.match(app, /new Date\(\)\.getHours\(\)/);
  assert.doesNotMatch(app, /timeZone:\s*['"]Africa\/Luanda['"]/);
});

test('user manual explains plans and safe offline behaviour', () => {
  assert.match(manual, /Manual de Apoio ao Utilizador/);
  assert.match(manual, /IndexedDB/);
  assert.match(manual, /Supabase/);
  assert.match(manual, /não é uma segunda base de dados SQL central/);
});
