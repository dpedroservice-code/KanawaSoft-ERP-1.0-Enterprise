import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../supabase/functions/agt-fiscal-config/index.ts", import.meta.url), "utf8");
const saft = await readFile(new URL("../supabase/functions/agt-saft-accounting-export/index.ts", import.meta.url), "utf8");

test("AGT configuration Edge Function accepts only the official Kanawa domains and approved previews", () => {
  assert.match(config, /https:\/\/kanawasoft\.shop/);
  assert.match(config, /https:\/\/www\.kanawasoft\.shop/);
  assert.match(config, /deploy-preview-/);
  assert.match(config, /Origem não autorizada/);
});

test("SAF-T accounting export also includes the production Kanawa domain", () => {
  assert.match(saft, /https:\/\/kanawasoft\.shop/);
  assert.match(saft, /https:\/\/www\.kanawasoft\.shop/);
});
