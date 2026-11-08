import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migration=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261108270000_audit_accounting_journal_entries.sql'),'utf8');

test('journal inserts and updates are recorded in the existing tenant audit stream',()=>{
  assert.match(migration,/AFTER INSERT OR UPDATE ON public\.ks_journal_entries/);
  assert.match(migration,/INSERT INTO public\.ks_audit_events\(\s*company_id,actor_user_id,action,resource_type,resource_id,details/s);
  assert.match(migration,/NEW\.company_id/);
  assert.match(migration,/coalesce\(NEW\.created_by_user_id, auth\.uid\(\)\)/);
  assert.match(migration,/'journal_entry_created'/);
  assert.match(migration,/'journal_entry_updated'/);
  assert.match(migration,/'contabilidade'/);
  assert.match(migration,/REVOKE ALL ON FUNCTION private\.ks_audit_journal_entry_event\(\) FROM PUBLIC,anon,authenticated/);
});
