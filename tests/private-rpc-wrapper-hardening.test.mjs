import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261108094416_move_privileged_rpcs_private.sql', import.meta.url), 'utf8');

test('public RPCs are invoker wrappers around private permission-checked implementations', () => {
  for (const fn of ['ks_accounting_reports','ks_seed_angola_chart_of_accounts','ks_set_company_module_enabled']) {
    assert.match(sql, new RegExp('alter function public\\.' + fn + '[\\s\\S]+?set schema private', 'i'));
    assert.match(sql, new RegExp('rename to ' + fn + '_secure_impl', 'i'));
    assert.match(sql, new RegExp('create or replace function public\\.' + fn + '[\\s\\S]+?security invoker', 'i'));
    assert.match(sql, new RegExp('revoke all on function public\\.' + fn + '[^;]+from public, anon', 'i'));
  }
});
