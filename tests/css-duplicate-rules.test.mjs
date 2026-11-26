import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync(new URL('../app/core.css', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8');
const css = core + '\n' + workspace;

test('responsive table overflow rule is declared once', () => {
  const matches = css.match(/\.table-wrap,\.table-responsive\s*\{\s*max-width:100%;\s*overflow-x:auto;\s*-webkit-overflow-scrolling:touch;\s*\}/g) || [];
  assert.equal(matches.length, 1);
});

test('hidden mega menu rule is declared once', () => {
  const matches = css.match(/#app #sidebar\.mega-menu-hidden\s*\{\s*display:none!important\s*\}/g) || [];
  assert.equal(matches.length, 1);
});
