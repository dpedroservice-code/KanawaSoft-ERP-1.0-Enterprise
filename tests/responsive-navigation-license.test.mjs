import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const licenseMigration = readFileSync(new URL('../supabase/migrations/20261108150000_fix_internal_lifetime_license_validation.sql', import.meta.url), 'utf8');

test('responsive sidebar exposes a toggle and adapts to tablet and mobile widths', () => {
  assert.match(html, /id="sidebarToggle"/);
  assert.match(html, /@media\s*\(max-width:\s*900px\)/);
  assert.match(html, /@media\s*\(max-width:\s*560px\)/);
  assert.match(html, /\.main-wrap\.sidebar-open \.sidebar/);
  assert.match(app, /function toggleSidebar\(\)/);
  assert.match(app, /function closeSidebar\(\)/);
  assert.match(app, /closeSidebar\(\)/);
});

test('internal lifetime licenses are not treated as expired or read-only', () => {
  assert.match(licenseMigration, /coalesce\(t\.is_lifetime, false\)/);
  assert.match(licenseMigration, /l\.plan_code = 'internal_lifetime'/);
  assert.match(licenseMigration, /v_is_lifetime/);
  assert.match(licenseMigration, /v_license\.expires_at is not null and v_license\.expires_at > now\(\)/);
  assert.match(licenseMigration, /v_license\.grace_until is not null and v_license\.grace_until > now\(\)/);
  assert.match(licenseMigration, /v_license\.starts_at > now\(\)/);
});
