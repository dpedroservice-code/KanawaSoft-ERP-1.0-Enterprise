import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appRoot = new URL('../app/', import.meta.url);
const html = await readFile(new URL('index.html', appRoot), 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
  .map(match => match[1].split('?')[0])
  .filter(path => path.endsWith('.js') && !/^https?:\/\//i.test(path) && !path.startsWith('libs/'));

test('loaded application scripts do not redeclare global functions', async () => {
  const declarations = new Map();
  for (const path of scripts) {
    const source = await readFile(new URL(path, appRoot), 'utf8');
    for (const match of source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      const name = match[1];
      const files = declarations.get(name) || [];
      files.push(path);
      declarations.set(name, files);
    }
  }
  const duplicates = [...declarations].filter(([, files]) => files.length > 1);
  assert.deepEqual(duplicates, [], 'duplicate global functions: ' + JSON.stringify(duplicates));
});

test('loaded application scripts do not redeclare top-level lexical variables', async () => {
  const declarations = new Map();
  for (const path of scripts) {
    const source = await readFile(new URL(path, appRoot), 'utf8');
    source.split('\n').forEach((line, index) => {
      const match = line.match(/^(?:const|let|class)\s+([A-Za-z_$][\w$]*)\b/);
      if (!match) return;
      const files = declarations.get(match[1]) || [];
      files.push(path + ':' + (index + 1));
      declarations.set(match[1], files);
    });
  }
  const duplicates = [...declarations].filter(([, files]) => files.length > 1);
  assert.deepEqual(duplicates, [], 'duplicate top-level bindings: ' + JSON.stringify(duplicates));
});
