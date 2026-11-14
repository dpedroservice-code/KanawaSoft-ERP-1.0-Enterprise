import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = fs.readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20261112190000_compact_sync_and_pos_lookup.sql', import.meta.url), 'utf8');

test('authenticated startup waits for Supabase before revealing the workspace', () => {
  assert.ok(app.includes('await KanawaCloud.check()'));
  assert.ok(app.includes('setLoadingConnectedAnimation(true)'));
  assert.ok(app.includes('await activateCloudSession(cloudContext, true);\n      hideLoadingScreen();\n      mostrarAplicacaoAutenticada(cloudContext)'));
  assert.ok(html.includes('kanawa-logo-spin') && html.includes('loadingGreeting') && html.includes('loadingStatus'));
  assert.ok(!html.includes('class="loading-bar"'));
  assert.ok(!html.includes('class="loading-spinner"'));
});

test('loading greeting covers all eleven locales and follows the device local time', () => {
  for (const code of ['pt','en','fr','es','zh','ar','ln','cjk','umb','kmb','kon']) assert.ok(app.includes(code+': ['));
  assert.ok(app.includes('new Date().getHours()'));
  assert.ok(!app.includes('Africa/Luanda'));
  assert.ok(app.includes("ln: ['Mbote na tongo', 'Mbote na midi', 'Mbote na pokwa']"));
  assert.ok(app.includes('kmb: [\'Uazekele kiebi?\', \'Kiambote\', "Usuk\'ó"]'));
  assert.ok(app.includes('setInterval(paint,850)'));
});

test('store reads are local-first, deduplicated, and POS refreshes its catalogue', () => {
  assert.ok(app.includes('const kanawaStoreRefreshes = new Map()'));
  assert.ok(app.includes('if (!local.length || options.waitForCloud === true) await refresh'));
  assert.ok(app.includes('kanawaMergeCachedMedia'));
  assert.ok(app.includes("getData('produtos',{force:true,waitForCloud:true})"));
});

test('cloud sync uses compact paginated SQL RPCs with invoker row security', () => {
  assert.ok(cloud.includes("rpc('ks_get_records_compact'"));
  assert.ok(migration.includes('SECURITY INVOKER'));
  assert.ok(migration.includes("payload->>'imagem' LIKE 'data:image/%'"));
  assert.ok(migration.includes('company_id, store_key, updated_at, record_id'));
});

test('scanner supports QR and retail barcode formats and suppresses duplicate frames', () => {
  assert.ok(app.includes('formatsToSupport'));
  for (const format of ['QR_CODE','EAN_13','EAN_8','UPC_A','UPC_E','CODE_39','CODE_93','CODE_128']) assert.ok(app.includes("'"+format+"'"));
  assert.ok(app.includes('scannerProcessing') && app.includes('scannerLastCode'));
  assert.ok(app.includes('codigoQr:isQr?normalized'));
});
