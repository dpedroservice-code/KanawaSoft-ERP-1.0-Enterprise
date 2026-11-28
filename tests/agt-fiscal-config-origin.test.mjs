import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../supabase/functions/agt-fiscal-config/index.ts', import.meta.url), 'utf8');

test('AGT fiscal configuration allows the canonical production origin', () => {
  assert.ok(source.includes('https://kanawasoft.shop'));
});

test('AGT fiscal configuration allows the www production origin', () => {
  assert.ok(source.includes('https://www.kanawasoft.shop'));
});

test('AGT fiscal configuration keeps explicit preview and local development origins', () => {
  assert.ok(source.includes('kanawasoft-erp-1-0-enterprise.netlify.app'));
  assert.ok(source.includes('deploy-preview-'));
  assert.ok(source.includes('localhost:8888'));
});

test('AGT Base64URL encoding uses strict URL-safe substitutions', () => {
  assert.ok(source.includes('replace(/\\+/g,"-")'));
  assert.ok(source.includes('replace(/\\//g,"_")'));
  assert.ok(source.includes('replace(/=/g,"")'));
});

test('AGT PKCS#8 parser normalizes real and escaped newlines', () => {
  assert.ok(source.includes('replace(/\\\\n/g,"\\n")'));
  assert.ok(source.includes('replace(/\\\\r\\\\n/g,"\\n")'));
  assert.ok(source.includes('-----BEGIN PRIVATE KEY-----'));
});

test('AGT signature version is mandatory in readiness and signed software payload', () => {
  assert.ok(source.includes('AGT_SOFTWARE_SIGNATURE_VERSION'));
  assert.ok(source.includes('softwareSignatureVersionConfigured:!!softwareSignatureVersion'));
  assert.ok(source.includes('signatureVersion:softwareSignatureVersion'));
  assert.ok(source.includes('!softwareSignatureVersion'));
});
