import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cloud = await readFile(new URL("../app/cloud.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261112194000_secure_tenant_scoped_sale_cancellation.sql", import.meta.url), "utf8");

test("admin sale cancellation always passes the selected tenant/company ID", () => {
  const method = cloud.slice(cloud.indexOf("async cancelSaleAsAdmin("), cloud.indexOf("async reviewSaleCancellation(", cloud.indexOf("async adminCancelSale(")));
  assert.match(method, /p_company_id: context\.company\.id/);
  assert.match(method, /p_sale_external_id/);
});

test("admin sale cancellation uses a private definer implementation and public invoker wrapper", () => {
  assert.match(migration, /drop function if exists public\.ks_admin_cancel_sale\(text, text\)/);
  assert.match(migration, /private\.ks_admin_cancel_sale_internal/);
  assert.match(migration, /private\.ks_has_company_role\(p_company_id, array\['owner','admin','administrator'\]\)/);
  assert.match(migration, /language sql\s+security invoker/);
  assert.doesNotMatch(migration, /order by m\.created_at limit 1/);
});
