import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, cloud, html] = await Promise.all([
  readFile(new URL('../app/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/cloud.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8')
]);

test('login, signup and invitations use six-digit email OTP only, without magic-link redirects', () => {
  assert.match(cloud, /detectSessionInUrl: false/);
  const loginRequest=cloud.slice(cloud.indexOf('async requestOtp('),cloud.indexOf('async verifyOtp(',cloud.indexOf('async requestOtp(')));
  const loginVerify=cloud.slice(cloud.indexOf('async verifyOtp('),cloud.indexOf('async requestSignupOtp(',cloud.indexOf('async verifyOtp(')));
  assert.match(loginRequest, /signInWithOtp\([\s\S]*?email:normalizedEmail/);
  assert.doesNotMatch(loginRequest, /phone:|channel === 'sms'/);
  assert.match(loginVerify, /type:'email'/);
  assert.match(loginVerify, /\^\\d\{6\}\$/);
  assert.match(cloud, /async requestSignupOtp\(email, otpType\)/);
  assert.match(cloud, /async verifySignupOtp\(email, token, otpType\)/);
  assert.match(cloud, /type: otpType === 'email' \? 'email' : 'signup'/);
  assert.match(app, /function loginMethod\(\) \{ return 'email'; \}/);
  assert.match(app, /window\.kanawaStartSignupOtp = async function \(email, alreadySent, otpType\)/);
  assert.match(app, /kanawa_pending_signup_otp_type/);
  assert.match(app, /await KanawaCloud\.requestOtp\(identifier, method\)/);
  assert.match(app, /await KanawaCloud\.verifyOtp\(emailInput\.value, codeInput\.value, loginMethod\(\)\)/);
  assert.match(html, /resendOtpBtn/);
  assert.match(html, /serviceWorker\.register\('\/service-worker\.js'/);
  assert.match(html, /cloud\.js\?v=1\.0\.20261114\.2/);
  assert.match(html, /app\.js\?v=1\.0\.20261114\.1/);
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
  assert.match(cloud, /let finalizedSaleId = null;/);
  assert.match(cloud, /const saleMirror = await client\.from\('ks_records'\)\.upsert/);
  assert.ok(cloud.indexOf('const saleMirror') < cloud.indexOf('const stockRows'));
  assert.match(cloud, /catch \(stockMirrorError\)/);
});

test('cloud record mutations remain tenant-scoped and finalized sales cannot be deleted or overwritten', () => {
  assert.match(cloud, /async deleteRecord\(store, id\)/);
  assert.ok(cloud.includes('company_id: context.company.id'));
  assert.ok(cloud.includes("rpc('ks_get_records_compact'"));
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
