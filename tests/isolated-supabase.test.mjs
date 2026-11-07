import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../supabase/migrations/20261106145917_kanawasoft_1_0_initial_schema.sql', import.meta.url), 'utf8');
const productPolicy = readFileSync(new URL('../supabase/migrations/20261106150927_restrict_product_catalog_writes.sql', import.meta.url), 'utf8');

test('KanawaSoft 1.0 points only to its dedicated Supabase project', () => {
  assert.match(cloud, /https:\/\/mhaynctedpyqjxdhdisv\.supabase\.co/);
  assert.doesNotMatch(cloud, /jiehrswweoyesbabrpjf/);
  assert.doesNotMatch(cloud, /service_role|sb_secret_/i);
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
