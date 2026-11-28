import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../supabase/functions/agt-fiscal-config/index.ts', import.meta.url), 'utf8');

test('AGT fiscal configuration allows the canonical production origin', () => {
  assert.match(source, /"https:\/\/kanawasoft\.shop"/);
});

test('AGT fiscal configuration allows the www production origin', () => {
  assert.match(source, /"https:\/\/www\.kanawasoft\.shop"/);
});

test('AGT fiscal configuration keeps explicit preview and local development origins', () => {
  assert.match(source, /"https:\/\/kanawasoft-erp-1-0-enterprise\.netlify\.app"/);
  assert.match(source, /deploy-preview-\\d\+--kanawasoft-erp-1-0-enterprise/);
  assert.match(source, /"http:\/\/localhost:8888"/);
});

test('AGT fiscal configuration does not expose internal exception details', () => {
  assert.match(source, /Não foi possível concluir a configuração fiscal/);
  assert.doesNotMatch(source, /return json\(\{error:error instanceof Error\?error\.message/);
});
