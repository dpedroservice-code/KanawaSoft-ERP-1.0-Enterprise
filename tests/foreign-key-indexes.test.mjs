import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261108094439_remaining_foreign_key_indexes.sql', import.meta.url), 'utf8');

test('remaining foreign-key indexes are created idempotently', () => {
  for (const index of ['ix_ks_company_module_settings_updated_by','ix_ks_tax_return_lines_tax_return_id','ix_ks_tax_returns_created_by']) {
    assert.match(sql, new RegExp('create index if not exists ' + index, 'i'));
  }
});

test('new advisor findings have partial foreign-key indexes', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261112193000_add_missing_foreign_key_indexes.sql', import.meta.url), 'utf8');
  for (const index of [
    'ks_fiscal_documents_created_by_fk_idx',
    'ks_fiscal_documents_source_document_fk_idx',
    'ks_fiscal_documents_source_sale_fk_idx',
    'ks_journal_entries_created_by_user_fk_idx'
  ]) assert.match(sql, new RegExp('create index if not exists ' + index, 'i'));
  assert.equal((sql.match(/where [a-z_]+ is not null/g) || []).length, 4);
});
