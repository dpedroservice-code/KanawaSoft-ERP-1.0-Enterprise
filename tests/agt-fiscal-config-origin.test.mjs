import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../supabase/functions/agt-fiscal-config/index.ts', import.meta.url), 'utf8');

test('AGT fiscal configuration allows the canonical production origin', () => {
  assert.match(source, /"https:\\/\\/kanawasoft\\.shop"/);
});

test('AGT fiscal configuration allows the www production origin', () => {
  assert.match(source, /"https:\\/\\/www\\.kanawasoft\\.shop"/);
});

test('AGT fiscal configuration keeps explicit preview and local development origins', () => {
  assert.match(source, /"https:\\/\\/kanawasoft-erp-1-0-enterprise\\.netlify\\.app"/);
  assert.match(source, /deploy-preview-\\\\d\\+--kanawasoft-erp-1-0-enterprise/);
  assert.match(source, /"http:\\/\\/localhost:8888"/);
});

test('AGT Base64URL encoding uses strict URL-safe substitutions', () => {
  assert.match(source, /replace\\(/\\+/g, "-"/);
  assert.match(source, /replace\\(/\\//g, "_"/);
  assert.match(source, /replace\\(/=/g, ""/);
});

test('AGT PKCS#8 parser normalizes real and escaped newlines', () => {
  assert.match(source, /replace\\(/\\\\n/g, "\\n"/);
  assert.match(source, /replace\\(/\\r\\n/g, "\\n"/);
  assert.match(source, /-----BEGIN PRIVATE KEY-----/);
});

test('AGT signature version is mandatory in readiness and signed software payload', () => {
  assert.match(source, /AGT_SOFTWARE_SIGNATURE_VERSION/);
  assert.match(source, /softwareSignatureVersionConfigured:!!softwareSignatureVersion/);
  assert.match(source, /signatureVersion:softwareSignatureVersion/);
  assert.match(source, /!softwareSignatureVersion/);
});
