import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261112190000_secure_company_branch_workflow.sql", import.meta.url), "utf8");
const app = await readFile(new URL("../app/app.js", import.meta.url), "utf8");
const cloud = await readFile(new URL("../app/cloud.js", import.meta.url), "utf8");

test("branch workflow has pending, active and inactive states with a single parent per branch", () => {
  assert.match(migration, /status in \('pending', 'active', 'inactive'\)/);
  assert.match(migration, /ks_company_branches_branch_company_unique_idx/);
  assert.match(migration, /ks_company_branches_parent_status_idx/);
  assert.match(migration, /ks_companies_tax_id_normalized_uidx/);
});

test("branch association is approved by the branch owner or admin", () => {
  assert.match(migration, /ks_request_company_branch_by_tax_id/);
  assert.match(migration, /ks_accept_company_branch_internal/);
  assert.match(migration, /private\.ks_has_company_role\(p_branch_company_id, array\['owner','admin'\]\)/);
  assert.match(migration, /ks_unlink_company_branch_internal/);
});

test("branch relationship does not grant access to other companies' operational data", () => {
  assert.match(migration, /Pending links expose only the related company profile metadata/);
  assert.doesNotMatch(migration, /create policy .* on public\.ks_products/i);
  assert.doesNotMatch(migration, /create policy .* on public\.ks_sales/i);
});

test("the Filiais module is registered, plan-gated and backed by cloud RPCs", () => {
  assert.match(app, /filiais: renderEmpresasFiliais/);
  assert.match(app, /id: 'filiais'/);
  assert.match(app, /'filiais':'enterprise'/);
  assert.match(cloud, /getCompanyBranches/);
  assert.match(cloud, /requestCompanyBranchByTaxId/);
  assert.match(cloud, /acceptCompanyBranch/);
  assert.match(cloud, /unlinkCompanyBranch/);
});
