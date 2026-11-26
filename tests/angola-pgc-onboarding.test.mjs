import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20261126230000_idempotent_angola_pgc_company_onboarding.sql', import.meta.url);
const appPath = new URL('../app/app.js', import.meta.url);
const pgcPath = new URL('../app/data/pgc-angola.json', import.meta.url);

test('PGC onboarding seed is tenant-serialized and idempotent', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('ks-pgc:'/);
  assert.match(sql, /ON CONFLICT\(company_id,account_code\) DO NOTHING/i);
  assert.match(sql, /GET DIAGNOSTICS v_rows_inserted = ROW_COUNT/i);
  assert.match(sql, /'source_accounts_present'[\s\S]*?JOIN public\.ks_chart_of_accounts existing/i);
  assert.match(sql, /ks_has_company_permission\(p_company_id,'contabilidade','editar'\)/);
  assert.doesNotMatch(sql, /IF EXISTS\s*\(\s*SELECT 1 FROM public\.ks_chart_of_accounts WHERE company_id=p_company_id\) THEN/i);
});

test('company activation automatically ensures the PGC without overwriting existing accounts', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.match(app, /async function ensureCompanyAngolaPGC\(/);
  assert.match(app, /KanawaCloud\.seedAngolaChartOfAccounts\(accounts\)/);
  assert.match(app, /KanawaCloud\.getAccountingSnapshot\(\)/);
  assert.match(app, /seedResult\.source_accounts_present/);
  assert.match(app, /presentSourceCodes !== expected/);
  assert.match(app, /ensureCompanyAngolaPGC\(ctx\)/);
  assert.match(app, /preserves accounts already configured/i);
});

test('bundled Angola PGC dataset contains all 777 expected accounts', async () => {
  const dataset = JSON.parse(await readFile(pgcPath, 'utf8'));
  assert.equal(dataset.account_count, 777);
  assert.equal(dataset.accounts.length, 777);
});
