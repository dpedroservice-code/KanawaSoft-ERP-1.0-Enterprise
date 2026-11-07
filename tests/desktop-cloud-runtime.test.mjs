import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../server/routes.js', import.meta.url), 'utf8');
const desktopMain = readFileSync(new URL('../desktop/main.js', import.meta.url), 'utf8');

test('Electron local HTTP server no longer boots or writes the legacy SQLite database', () => {
  assert.doesNotMatch(server, /require\(['"]\.\/database['"]\)/);
  assert.doesNotMatch(server, /initDB\s*\(/);
  assert.doesNotMatch(server, /kanawa\.db/);
  assert.doesNotMatch(server, /dbInstance/);
  assert.match(server, /registerRoutes\(app\)/);
});

test('legacy generic SQLite CRUD API stays disabled', () => {
  assert.match(routes, /legacySqliteApi:\s*'disabled'/);
  assert.match(routes, /res\.status\(410\)/);
  assert.doesNotMatch(routes, /db\.(run|prepare|exec)/);
});

test('desktop keeps user data and backup directories instead of deleting legacy files', () => {
  assert.match(desktopMain, /function getDataDir\(\)/);
  assert.match(desktopMain, /function getBackupDir\(\)/);
  assert.match(desktopMain, /server\/server/);
});
