import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const edgeSource = readFileSync(new URL('../supabase/functions/agt-fiscal-config/index.ts', import.meta.url), 'utf8');
const subtle = crypto.webcrypto.subtle;
const enc = new TextEncoder();
const slash = String.fromCharCode(92);

function base64url(bytes) {
  return Buffer.from(bytes).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
}

function normalizePem(value) {
  return value
    .replaceAll(slash + 'r' + slash + 'n', '\n')
    .replaceAll(slash + 'n', '\n')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
}

function requireSignatureVersion(env) {
  const version = String(env.AGT_SOFTWARE_SIGNATURE_VERSION || '').trim();
  if (!version) throw new Error('AGT_SOFTWARE_SIGNATURE_VERSION é obrigatório para assinar.');
  return version;
}

test('AGT RS256 JWS is cryptographically verified with its matching public key', async () => {
  const pair = await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const payload = {
    productId: 'Kanawa Soft ERP',
    productVersion: '1.0.0',
    softwareValidationNumber: 'TEST-VALIDATION-NOT-FOR-PRODUCTION',
    signatureVersion: 'TEST-SIGNATURE-VERSION'
  };
  const header = base64url(enc.encode(canonicalJson({ alg: 'RS256', typ: 'JWT' })));
  const body = base64url(enc.encode(canonicalJson(payload)));
  const signingInput = header + '.' + body;
  const signature = new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(signingInput)));
  const compactJws = signingInput + '.' + base64url(signature);
  const parts = compactJws.split('.');
  const fromUrl = (part) => Buffer.from(part.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - part.length % 4) % 4), 'base64');
  assert.equal(await subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, fromUrl(parts[2]), enc.encode(parts[0] + '.' + parts[1])), true);
  assert.deepEqual(JSON.parse(fromUrl(parts[1]).toString('utf8')), payload);
  assert.equal(JSON.parse(fromUrl(parts[1]).toString('utf8')).signatureVersion, 'TEST-SIGNATURE-VERSION');
});

test('Base64URL conversion replaces plus and slash and removes padding', () => {
  assert.equal(base64url(new Uint8Array([251, 255])), '-_8');
  assert.ok(edgeSource.includes('replace(/' + slash + '+/g,"-")'));
  assert.ok(edgeSource.includes('replace(/' + slash + '//g,"_")'));
  assert.ok(edgeSource.includes('replace(/=/g,"")'));
});

test('PKCS#8 PEM parser accepts escaped newline sequences', async () => {
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  const escapedPem = pair.privateKey.replace(/\r?\n/g, slash + 'n');
  const der = Buffer.from(normalizePem(escapedPem), 'base64');
  const imported = await subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const data = enc.encode('Kanawa Soft AGT PEM parser test');
  const signature = await subtle.sign('RSASSA-PKCS1-v1_5', imported, data);
  const publicKey = crypto.createPublicKey(pair.publicKey).export({ type: 'spki', format: 'der' });
  const verifyKey = await subtle.importKey('spki', publicKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  assert.equal(await subtle.verify('RSASSA-PKCS1-v1_5', verifyKey, signature, data), true);
  assert.ok(edgeSource.includes('replace(/' + slash + slash + 'n/g,"' + slash + 'n")'));
});

test('AGT software signature version is mandatory and cannot be blank', () => {
  assert.throws(() => requireSignatureVersion({}), /AGT_SOFTWARE_SIGNATURE_VERSION/);
  assert.throws(() => requireSignatureVersion({ AGT_SOFTWARE_SIGNATURE_VERSION: '   ' }), /AGT_SOFTWARE_SIGNATURE_VERSION/);
  assert.equal(requireSignatureVersion({ AGT_SOFTWARE_SIGNATURE_VERSION: '2' }), '2');
  assert.ok(edgeSource.includes('AGT_SOFTWARE_SIGNATURE_VERSION'));
  assert.ok(edgeSource.includes('signatureVersion:softwareSignatureVersion'));
  assert.ok(edgeSource.includes('!softwareSignatureVersion'));
});
