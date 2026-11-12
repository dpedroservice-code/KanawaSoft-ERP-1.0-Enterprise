import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = fs.readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20261112190000_compact_sync_and_pos_lookup.sql', import.meta.url), 'utf8');
test('authenticated startup waits for a real database connection and never hides the loader early', () => {
  assert.match(app,/await KanawaCloud\.check\(\)/);
  assert.match(app,/await activateCloudSession\(cloudContext, true\);\s*hideLoadingScreen\(\);\s*mostrarAplicacaoAutenticada/);
  assert.match(html,/loading-spinner/); assert.match(html,/loadingGreeting/); assert.match(html,/loadingStatus/);
});
test('loading greeting cycles through all eleven locales using Luanda local time', () => {
  for (const code of ['pt','en','fr','es','zh','ar','ln','cjk','umb','kmb','kon']) assert.match(app,new RegExp('^\\s*'+code+':','m'));
  assert.match(app,/Africa\/Luanda/); assert.match(app,/setInterval\(paint,850\)/);
});
test('store reads are local-first, deduplicated, and POS forces a fresh catalogue', () => {
  assert.match(app,/const kanawaStoreRefreshes = new Map\(\)/);
  assert.match(app,/if \(!local\.length \|\| options\.waitForCloud === true\) await refresh/);
  assert.match(app,/kanawaMergeCachedMedia/); assert.match(app,/getData\('produtos',\{force:true,waitForCloud:true\}\)/);
});
test('cloud sync uses compact paginated SQL RPCs and preserves server-side row security', () => {
  assert.match(cloud,/rpc\('ks_get_records_compact'/); assert.match(migration,/SECURITY INVOKER/i);
  assert.match(migration,/payload->>'imagem' LIKE 'data:image\/%'/);
  assert.match(migration,/company_id, store_key, updated_at, record_id/);
});
test('scanner supports QR plus retail barcode formats and suppresses repeated frames', () => {
  assert.match(app,/formatsToSupport/); assert.match(app,/'QR_CODE','EAN_13','EAN_8','UPC_A','UPC_E','CODE_39','CODE_93','CODE_128'/);
  assert.match(app,/scannerProcessing/); assert.match(app,/scannerLastCode/); assert.match(app,/codigoQr:isQr\?normalized/);
});
