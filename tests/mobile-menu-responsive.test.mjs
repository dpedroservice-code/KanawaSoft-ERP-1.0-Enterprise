import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app=fs.readFileSync(path.join(process.cwd(),'app/app.js'),'utf8');
const html=fs.readFileSync(path.join(process.cwd(),'app/index.html'),'utf8');

test('mobile navigation opens as a right-side drawer on phones and tablets',()=>{
  assert.match(html,/@media \(max-width:900px\)/);
  assert.match(html,/right:0!important/);
  assert.match(html,/left:auto!important/);
  assert.match(html,/transform:translateX\(105%\)!important/);
  assert.match(html,/\.mobile-open\s*\{\s*transform:translateX\(0\)!important/);
});

test('mobile menu width and height adapt to viewport and measured topbar',()=>{
  assert.match(html,/width:min\(90vw,380px\)!important/);
  assert.match(html,/max-height:calc\(var\(--viewport-height,100dvh\) - var\(--kanawa-topbar-height,58px\)\)/);
  assert.match(app,/--kanawa-topbar-height/);
  assert.match(app,/updateResponsiveLayout\(\);\s*if \(\$\('topbarEmpresa'\)\)/);
});

test('menu toggle controls drawer, overlay, body scroll lock and Escape close',()=>{
  assert.match(app,/sidebar\.classList\.toggle\('mobile-open',mobile&&megaMenuVisible\)/);
  assert.match(app,/overlay\.classList\.toggle\('active',mobile&&megaMenuVisible\)/);
  assert.match(app,/document\.body\.classList\.toggle\('menu-open',mobile&&megaMenuVisible\)/);
  assert.match(app,/megaMenuVisible&&window\.innerWidth<=900\)toggleMegaMenu\(false\)/);
  assert.match(html,/id="sidebarOverlay" onclick="toggleMegaMenu\(false\)"/);
});
