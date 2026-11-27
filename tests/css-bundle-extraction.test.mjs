import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../app/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('main HTML keeps presentation rules in external CSS bundles', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /<style\b/i);
  const versions = { 'core.css': '1.0.20261127.2', 'workspace.css': '1.0.20261127.2', 'pdv-loading.css': '1.0.20261126.1', 'responsive.css': '1.0.20261127.2' };
  for (const [file, version] of Object.entries(versions)) {
    assert.match(html, new RegExp(file.replace('.', '\\.') + '\\?v=' + version.replaceAll('.', '\\.')));
  }
});

test('CSS bundles preserve the original cascade order', async () => {
  const html = await read('index.html');
  const ordered = [
    'core.css',
    'leaflet.css',
    'workspace.css',
    'sidebar.css',
    'pdv-loading.css',
    'responsive.css',
    'ui-consistency.css',
    'module-reorganization.css'
  ];
  const positions = ordered.map(file => html.indexOf(file));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
});

test('each stylesheet bundle stays within its functional size budget', async () => {
  const budgets = {
    'core.css': 70 * 1024,
    'workspace.css': 30 * 1024,
    'pdv-loading.css': 7 * 1024,
    'responsive.css': 32 * 1024
  };
  for (const [file, limit] of Object.entries(budgets)) {
    const content = await read(file);
    assert.ok(Buffer.byteLength(content, 'utf8') < limit, file + ' exceeds its size budget');
  }
});
