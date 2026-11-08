import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261108140000_remaining_foreign_key_indexes.sql', import.meta.url), 'utf8');

test('remaining foreign-key indexes are created idempotently', () => {
  for (const index of ['ix_ks_company_module_settings_updated_by','ix_ks_tax_return_lines_tax_return_id','ix_ks_tax_returns_created_by']) {
    assert.match(sql, new RegExp('create index if not exists ' + index, 'i'));
  }
});
