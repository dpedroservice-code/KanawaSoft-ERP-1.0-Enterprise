import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.mjs";

function makeEnv(overrides = {}) {
  return {
    KANAWA_ENV: "preview",
    KANAWA_SUPABASE_URL: "https://preview-must-not-connect.supabase.co",
    KANAWA_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_preview_must_not_connect",
    ASSETS: {
      fetch: async (request) => new Response("asset:" + new URL(request.url).pathname)
    },
    ...overrides
  };
}

test("preview runtime config never connects to production Supabase", async () => {
  const response = await worker.fetch(
    new Request("https://preview.example/runtime-config.js?v=1"),
    makeEnv()
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(body, /"enabled":false/);
  assert.match(body, /KANAWA_PREVIEW_DEMO = true/);
  assert.match(body, /KANAWA_PREVIEW_READ_ONLY = true/);
  assert.doesNotMatch(body, /preview-must-not-connect/);
  assert.doesNotMatch(body, /sb_publishable_preview_must_not_connect/);
});

test("production runtime config enables only with URL and publishable key", async () => {
  const response = await worker.fetch(
    new Request("https://kanawasoft.shop/runtime-config.js"),
    makeEnv({
      KANAWA_ENV: "production",
      KANAWA_SUPABASE_URL: "https://mhaynctedpyqjxdhdisv.supabase.co",
      KANAWA_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value"
    })
  );
  const body = await response.text();

  assert.match(body, /"enabled":true/);
  assert.ok(body.includes('"url":"https://mhaynctedpyqjxdhdisv.supabase.co"'));
  assert.match(body, /KANAWA_PREVIEW_DEMO = false/);
  assert.match(body, /KANAWA_PREVIEW_READ_ONLY = false/);
});

test("production fails closed when database configuration is incomplete", async () => {
  const response = await worker.fetch(
    new Request("https://kanawasoft.shop/runtime-config.js"),
    makeEnv({ KANAWA_ENV: "production", KANAWA_SUPABASE_URL: "", KANAWA_SUPABASE_PUBLISHABLE_KEY: "" })
  );
  const body = await response.text();

  assert.match(body, /"enabled":false/);
  assert.match(body, /KANAWA_PREVIEW_DEMO = false/);
  assert.match(body, /KANAWA_PREVIEW_READ_ONLY = true/);
});

test("non-config requests pass through to static assets", async () => {
  const response = await worker.fetch(
    new Request("https://kanawasoft.shop/index.html"),
    makeEnv()
  );

  assert.equal(await response.text(), "asset:/index.html");
});

test("service worker route serves the offline application cache script", async () => {
  const response = await worker.fetch(
    new Request("https://kanawasoft.shop/service-worker.js"),
    makeEnv()
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /javascript/);
  assert.match(await response.text(), /kanawa-shell-v1\.0\.20261112\.2/);
});
