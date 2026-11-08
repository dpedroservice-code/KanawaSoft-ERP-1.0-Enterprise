import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261108260000_fix_accounting_snapshot_nested_aggregates.sql'),'utf8');
const app=fs.readFileSync(path.join(root,'app/cloud.js'),'utf8');
const previousReports=fs.readFileSync(path.join(root,'supabase/migrations/20261107210000_pgc_classification_and_off_balance.sql'),'utf8');

test('accounting snapshot aggregates journal lines before building the JSON account array',()=>{
  assert.match(migration,/WITH account_totals AS \(/);
  assert.match(migration,/GROUP BY a\.id/);
  assert.match(migration,/JOIN account_totals t ON t\.account_id=a\.id/);
  assert.match(migration,/'debit_total',t\.debit_total/);
  assert.match(migration,/'credit_total',t\.credit_total/);
  assert.match(migration,/'balance',t\.balance/);
});

test('snapshot preserves tenant scope, posted-entry accounting and PGC account metadata',()=>{
  assert.match(migration,/ks_has_company_permission\(p_company_id,'contabilidade','ver'\)/);
  assert.match(migration,/a\.company_id=p_company_id AND a\.is_active/);
  assert.match(migration,/e\.status='posted'/);
  assert.match(migration,/'pgc_class',a\.pgc_class/);
  assert.match(migration,/'is_off_balance',a\.is_off_balance/);
});

test('existing accounting UI continues to call the stable snapshot and report RPCs',()=>{
  assert.match(app,/getAccountingSnapshot\(\)/);
  assert.match(app,/ks_accounting_snapshot/);
  assert.match(app,/getAccountingReports\(fromDate,\s*toDate\)/);
  assert.match(app,/ks_accounting_reports/);
  assert.match(previousReports,/CREATE OR REPLACE FUNCTION public\.ks_accounting_reports/);
});
