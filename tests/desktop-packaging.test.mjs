import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const preload = readFileSync(new URL('../desktop/preload.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../desktop/main.js', import.meta.url), 'utf8');

test('desktop packaging targets standard Windows, macOS and Linux installers', () => {
  assert.match(pkg.scripts['dist:win'], /electron-builder.*--win/);
  assert.match(pkg.scripts['dist:mac'], /electron-builder.*--mac/);
  assert.match(pkg.scripts['dist:linux'], /electron-builder.*--linux/);
  assert.equal(pkg.version, '1.0.0');
  assert.equal(pkg.build.win.target[0].target, 'nsis');
  assert.equal(pkg.build.mac.target, 'dmg');
  assert.equal(pkg.build.linux.target, 'AppImage');
});

test('desktop and local server report the same package version', () => {
  assert.match(preload, /appVersion: '1\.0\.0'/);
  assert.match(server, /require\('\.\.\/package\.json'\)\.version/);
});

test('automatic desktop updates are not falsely reported as active', () => {
  assert.match(main, /available: false/);
});

test('desktop uses a stable local origin so IndexedDB survives application restarts', () => {
  assert.match(main, /port: 47831/);
  assert.match(main, /origin stable between launches/);
  assert.doesNotMatch(server, /httpServer\.listen\(0, '127\.0\.0\.1'\)/);
  assert.match(server, /porta fixa/);
});

test('Electron window can be resized for narrow screens', () => {
  assert.match(main, /minWidth: 360/);
  assert.match(main, /minHeight: 500/);
});
