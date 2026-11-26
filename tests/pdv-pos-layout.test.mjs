import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const css=['core.css','workspace.css','pdv-loading.css','responsive.css']
  .map(file=>fs.readFileSync(path.join(process.cwd(),'app',file),'utf8')).join('\n');

test('PDV usa densidade POS em desktop e adapta a grelha a ecrãs menores',()=>{
  assert.match(css,/kanawa-pdv-pos-density/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(318px,350px\)/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:620px\)/);
});

test('estilo POS mantém o catálogo, carrinho e comandos existentes',()=>{
  assert.match(css,/\.pdv-products-panel/);
  assert.match(css,/\.pdv-cart-panel/);
  assert.match(css,/\.pdv-cart-footer/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
