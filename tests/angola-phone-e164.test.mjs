import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const match = source.match(/function normalizePhoneE164\(phone\) \{[\s\S]*?\n  \}/);
assert.ok(match, 'normalizePhoneE164 helper must exist');
const normalizePhoneE164 = vm.runInNewContext('(' + match[0] + ')');

test('Angolan mobile numbers are normalized to E.164', () => {
  assert.equal(normalizePhoneE164('923000000'), '+244923000000');
  assert.equal(normalizePhoneE164('923 000 000'), '+244923000000');
  assert.equal(normalizePhoneE164('244923000000'), '+244923000000');
  assert.equal(normalizePhoneE164('+244 923 000 000'), '+244923000000');
});

test('valid international E.164 numbers remain unchanged', () => {
  assert.equal(normalizePhoneE164('+351912345678'), '+351912345678');
});

test('invalid and incomplete phone numbers are rejected', () => {
  assert.throws(() => normalizePhoneE164('92300000'), /número válido/);
  assert.throws(() => normalizePhoneE164('123456789'), /número válido/);
  assert.throws(() => normalizePhoneE164(''), /número válido/);
});

test('login OTP uses email only while phone normalization remains available for account phone changes', () => {
  const loginRequest=source.slice(source.indexOf('async requestOtp('),source.indexOf('async verifyOtp(',source.indexOf('async requestOtp(')));
  assert.match(loginRequest, /email:normalizedEmail/);
  assert.doesNotMatch(loginRequest, /phone:|type: 'sms'/);
  assert.match(source, /normalizePhoneE164/);
  assert.match(source, /type:\s*'phone_change'/);
});
