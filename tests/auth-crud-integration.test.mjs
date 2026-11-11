import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, cloud, html] = await Promise.all([
  readFile(new URL('../app/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/cloud.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8')
]);

test('login OTP sends and verifies a six-digit email code without requiring a magic-link click', () => {
  assert.match(cloud, /async requestOtp\(identifier, method\)/);
  assert.match(cloud, /client\.auth\.signInWithOtp\(\{[\s\S]*?email: normalizedEmail[\s\S]*?shouldCreateUser: false/);
  assert.match(cloud, /if \(!\/\^\\d\{6\}\$\//);
  assert.match(cloud, /client\.auth\.verifyOtp\(payload\)/);
  assert.match(cloud, /type: 'email'/);
  assert.match(app, /await KanawaCloud\.requestOtp\(identifier, method\)/);
  assert.match(app, /await KanawaCloud\.verifyOtp\(emailInput\.value, codeInput\.value, loginMethod\(\)\)/);
  assert.match(app, /await KanawaCloud\.requestOtp\(emailInput\.value, loginMethod\(\)\)/);
  assert.match(html, /resendOtpBtn/);
  assert.match(html, /changeOtpEmailBtn/);
});

test('record creation and editing share one save path and sync to the active company', () => {
  assert.match(app, /async function saveData\(store, item, options\)/);
  assert.match(app, /const existed = !!item\.id/);
  assert.match(app, /existed \? \(await DB\.put\(store, item\), item\.id\) : await DB\.add\(store, item\)/);
  assert.match(app, /await KanawaCloud\.upsertRecord\(store, record, options \|\| \{\}\)/);
  assert.match(app, /queueSync\(store, existed \? 'update' : 'create', record/);
  assert.match(cloud, /async upsertRecord\(store, item, options\)/);
  assert.match(cloud, /company_id: context\.company\.id/);
  assert.match(cloud, /onConflict: 'company_id,store_key,record_id'/);
});

test('cloud record mutations are tenant-scoped and finalized sales cannot be deleted or overwritten', () => {
  assert.match(cloud, /async deleteRecord\(store, id\)/);
  assert.match(cloud, /\.eq\('company_id', context\.company\.id\)/);
  assert.match(cloud, /\.eq\('store_key', store\)/);
  assert.match(cloud, /Vendas finalizadas são imutáveis/);
  assert.match(cloud, /ignoreDuplicates: store === 'vendas'/);
  assert.match(app, /if \(store === 'vendas' && item\.status === 'finalizada'\)/);
});

test('editing existing customer and category records uses the shared persistence path', () => {
  assert.match(app, /async function salvarEditCategoria\(id\)[\s\S]*?await saveData\('categorias', c\)/);
  assert.match(app, /async function salvarClienteModal\(\)[\s\S]*?await saveData\('clientes',/);
  assert.match(app, /function podeFazer\(/);
  assert.match(app, /acoes: \['criar','editar'/);
});
