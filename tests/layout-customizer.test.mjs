import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [script, styles, html] = await Promise.all([
  readFile(new URL('../app/layout-customizer.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/layout-customizer.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8')
]);

test('layout customizer exposes the four supported modes', () => {
  for (const mode of ['mode-classic', 'mode-compact', 'mode-floating', 'mode-hidden']) {
    assert.match(script, new RegExp(mode));
    assert.match(styles, new RegExp('data-kanawa-layout=' + mode));
  }
});

test('layout preferences are stored per authenticated user when available', () => {
  assert.match(script, /kanawa_layout_preferences_v1/);
  assert.match(script, /KanawaCloud\.context\.user/);
  assert.match(script, /localStorage\.setItem/);
});

test('customizer includes independent icon density controls', () => {
  assert.match(script, /data-icon-size="normal"/);
  assert.match(script, /data-icon-size="large"/);
  assert.match(styles, /data-kanawa-icon-size=large/);
});

test('ERP shell loads the isolated customizer assets after its existing navigation scripts', () => {
  assert.match(html, /layout-customizer\.css/);
  assert.match(html, /layout-customizer\.js/);
  assert.ok(html.indexOf('workspace-windows.js') < html.indexOf('layout-customizer.js'));
});

test('responsive menu and automatic scrolling rules are present', () => {
  assert.match(styles, /width:240px/);
  assert.match(styles, /width:72px/);
  assert.match(styles, /overflow:auto/);
  assert.match(styles, /@media\(max-width:760px\)/);
});
