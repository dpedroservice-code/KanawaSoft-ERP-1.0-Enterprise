import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

test('responsive table overflow rule is declared once', () => {
  const matches = html.match(/\.table-wrap,\.table-responsive\s*\{\s*max-width:100%;\s*overflow-x:auto;\s*-webkit-overflow-scrolling:touch;\s*\}/g) || [];
  assert.equal(matches.length, 1);
});

test('hidden mega menu rule is declared once', () => {
  const matches = html.match(/#app #sidebar\.mega-menu-hidden\s*\{\s*display:none!important\s*\}/g) || [];
  assert.equal(matches.length, 1);
});
