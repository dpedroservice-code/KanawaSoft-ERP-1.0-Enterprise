import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("production startup verifies the cloud server before opening the local database or login", () => {
  const app = read("../app/app.js");
  assert.ok(app.indexOf("await KanawaCloud.ping()") >= 0);
  assert.ok(app.indexOf("await KanawaCloud.ping()") < app.indexOf("await DB.init()"));
  assert.match(app, /translateErrorMessage\(message\)/);
});

test("auth and backend errors are translated to Portuguese", () => {
  const cloud = read("../app/cloud.js");
  assert.match(cloud, /Signups not allowed for otp/);
  assert.match(cloud, /Este email ainda pode não ter uma conta Kanawa Soft/);
  assert.match(cloud, /function translateErrorMessage/);
  assert.match(cloud, /async ping\(\)/);
});

test("startup presents a single progress indicator", () => {
  const html = read("../app/index.html");
  const firstScreen = html.slice(html.indexOf('id="loadingScreen"'), html.indexOf("FIRST-RUN PRODUCT INTRO"));
  assert.equal((firstScreen.match(/loading-spinner/g) || []).length, 0);
  assert.equal((firstScreen.match(/loading-bar/g) || []).length, 1);
});

test("Excel-inspired table presentation is loaded and keeps mobile overflow usable", () => {
  const html = read("../app/index.html");
  const css = read("../app/excel-workspace.css");
  assert.match(html, /excel-workspace\.css/);
  assert.match(css, /--ks-sheet-green/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /overflow:auto/);
});

test("mobile PWA install helper is loaded and supports browser install prompt", () => {
  const html = read("../app/index.html");
  const pwa = read("../app/pwa-install.js");
  assert.match(html, /pwa-install\.js/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /Adicionar ao ecrã principal/);
  assert.ok(existsSync(new URL("../app/manifest.json", import.meta.url)));
});
