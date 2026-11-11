import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../supabase/migrations/20261106145917_kanawasoft_1_0_initial_schema.sql', import.meta.url), 'utf8');
const productPolicy = readFileSync(new URL('../supabase/migrations/20261106150927_restrict_product_catalog_writes.sql', import.meta.url), 'utf8');

test('Supabase connection is environment-configured and disabled by default', () => {
  const runtime = readFileSync(new URL('../app/runtime-config.js', import.meta.url), 'utf8');
  assert.match(cloud, /window\.KANAWA_SUPABASE_CONFIG/);
  assert.match(cloud, /cloudConfig\.enabled === true/);
  assert.doesNotMatch(cloud, /https:\/\/mhaynctedpyqjxdhdisv\.supabase\.co/);
  assert.doesNotMatch(cloud, /jiehrswweoyesbabrpjf/);
  assert.match(runtime, /enabled:\s*false/);
  assert.match(html, /runtime-config\.js[\s\S]*cloud\.js/);
  assert.doesNotMatch(cloud + runtime, /service_role|sb_secret_/i);
});

test('Cloudflare preview opens a local demo session with writes disabled', () => {
  const runtime = readFileSync(new URL('../app/runtime-config.js', import.meta.url), 'utf8');
  assert.match(runtime, /KANAWA_PREVIEW_DEMO = true/);
  assert.match(runtime, /KANAWA_PREVIEW_READ_ONLY = true/);
  assert.match(app, /Modo de demonstração: gravações estão desactivadas/);
  assert.match(app, /KanawaCloud\.setPreviewContext\(previewContext\)/);
  assert.match(app, /read_only: true/);
  assert.match(cloud, /setPreviewContext: function/);
  assert.match(cloud, /previewContext\.read_only !== true/);
});

test('email and SMS login both require an existing account', () => {
  assert.match(cloud, /signInWithOtp\(\{[\s\S]*?shouldCreateUser:\s*false/);
  assert.match(cloud, /type:\s*'sms'/);
  assert.match(cloud, /type:\s*'email'/);
  assert.match(html, /id="loginMethod"/);
  assert.match(app, /KanawaCloud\.requestOtp\(identifier, method\)/);
});

test('SMS account linking requires a verified phone-change OTP', () => {
  assert.match(cloud, /auth\.updateUser\(\{\s*phone:\s*normalizedPhone\s*\}\)/);
  assert.match(cloud, /type:\s*'phone_change'/);
  assert.match(app, /solicitarVerificacaoSMS/);
  assert.match(app, /confirmarTelefoneSMS/);
});

test('dedicated schema isolates companies and enforces stock checks', () => {
  assert.match(schema, /create table if not exists public\.ks_companies/);
  assert.match(schema, /alter table public\.ks_companies enable row level security/);
  assert.match(schema, /private\.ks_has_company_role/);
  assert.match(schema, /if v_product\.stock_quantity < v_qty then raise exception 'Stock insuficiente/);
  assert.match(schema, /create table if not exists public\.ks_records/);
});
