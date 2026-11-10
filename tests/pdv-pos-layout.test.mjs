import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.join(process.cwd(), 'app/index.html'), 'utf8');

test('PDV usa densidade POS em desktop e adapta a grelha a ecrãs menores', () => {
  assert.match(html, /id="kanawa-pdv-pos-density"/);
  assert.match(html, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(html, /grid-template-columns:minmax\(0,1fr\) minmax\(318px,350px\)/);
  assert.match(html, /@media\(max-width:900px\)/);
  assert.match(html, /@media\(max-width:620px\)/);
});

test('estilo POS mantém o catálogo, carrinho e comandos existentes', () => {
  assert.match(html, /\.pdv-products-panel/);
  assert.match(html, /\.pdv-cart-panel/);
  assert.match(html, /\.pdv-cart-footer/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});
