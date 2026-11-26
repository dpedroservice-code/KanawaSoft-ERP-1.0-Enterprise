import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appRoot = new URL('../app/', import.meta.url);
const html = await readFile(new URL('index.html', appRoot), 'utf8');
const app = await readFile(new URL('app.js', appRoot), 'utf8');
const viewport = await readFile(new URL('responsive-viewport.js', appRoot), 'utf8');

test('responsive viewport adapter is loaded before the application core', () => {
  const viewportIndex = html.indexOf('responsive-viewport.js');
  const appIndex = html.indexOf('app.js?v=');
  assert.notEqual(viewportIndex, -1);
  assert.notEqual(appIndex, -1);
  assert.ok(viewportIndex < appIndex, 'viewport adapter must load before app.js');
});

test('responsive viewport adapter has one canonical implementation outside app.js', () => {
  assert.match(viewport, /function updateResponsiveLayout\s*\(/);
  assert.doesNotMatch(app, /function updateResponsiveLayout\s*\(/);
  assert.match(app, /updateResponsiveLayout\(\);/, 'app startup must retain its responsive refresh');
  assert.match(viewport, /addEventListener\('resize'/);
  assert.match(viewport, /addEventListener\('orientationchange'/);
});
