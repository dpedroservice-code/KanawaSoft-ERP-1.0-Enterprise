import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261108184341_agt_saft_accounting_export.sql'),'utf8');
const edge=fs.readFileSync(path.join(root,'supabase/functions/agt-saft-accounting-export/index.ts'),'utf8');
const cloud=fs.readFileSync(path.join(root,'app/cloud.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app/app.js'),'utf8');

test('SAF-T RPC requires export permission and scopes all accounting queries to one company',()=>{
  assert.match(migration,/ks_has_company_permission\(p_company_id,'contabilidade','exportar'\)/);
  assert.match(migration,/WHERE c\.id=p_company_id/);
  assert.match(migration,/WHERE l\.company_id=p_company_id/);
  assert.match(migration,/WHERE e\.company_id=p_company_id/);
  assert.match(migration,/SECURITY DEFINER SET search_path TO ''/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.ks_accounting_saft_snapshot\(uuid,date,date\) FROM PUBLIC,anon/);
});

test('new accounting entries record the authenticated user without exposing personal details',()=>{
  assert.match(migration,/created_by_user_id uuid REFERENCES auth\.users/);
  assert.match(migration,/source_user_code text/);
  assert.match(migration,/USR'\|\|left\(replace\(v_user_id::text,'-',''\),27\)/);
});

test('snapshot exports opening and closing balances and only posted movements',()=>{
  assert.match(migration,/openingDebitBalance/);
  assert.match(migration,/openingCreditBalance/);
  assert.match(migration,/closingDebitBalance/);
  assert.match(migration,/closingCreditBalance/);
  assert.match(migration,/e\.status='posted'/);
  assert.match(migration,/Africa\/Luanda/);
});

test('Edge Function authenticates the user and calls the tenant-scoped RPC',()=>{
  assert.match(edge,/client\.auth\.getUser\(token\)/);
  assert.match(edge,/client\.rpc\("ks_accounting_saft_snapshot"/);
  assert.match(edge,/AGT_SOFTWARE_PRODUCER_TAX_ID/);
  assert.match(edge,/softwareValidationNumber: validationNumber/);
  assert.match(edge,/Cache-Control/);
});

test('accounting workspace exposes XML export through the Supabase function',()=>{
  assert.match(cloud,/exportAccountingSaft/);
  assert.match(cloud,/agt-saft-accounting-export/);
  assert.match(app,/exportarSaftContabilidade/);
  assert.match(app,/application\/xml/);
});
