import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261106162000_cloud_team_invitations_and_membership_management.sql', import.meta.url), 'utf8');
const invokerMigration = readFileSync(new URL('../supabase/migrations/20261106163000_reduce_team_rpc_definer_surface.sql', import.meta.url), 'utf8');

test('team directory reads memberships and profiles from the dedicated cloud database', () => {
  assert.match(cloud, /async listTeamMembers\(\)/);
  assert.match(cloud, /from\('ks_company_memberships'\)/);
  assert.match(cloud, /from\('ks_profiles'\)/);
  assert.match(app, /KanawaCloud\.listTeamMembers\(\)/);
  assert.match(app, /function getPerms\(\)[\s\S]*?context\.membership/);
  assert.doesNotMatch(app, /function getPerms\(\)[^\n]*localStorage\.getItem\('kanawa_user'\)/);
});

test('team invitations are single-use, company-scoped and do not store plaintext passwords', () => {
  assert.match(cloud, /ks_create_team_invitation/);
  assert.match(cloud, /invitation_code:\s*code/);
  assert.match(cloud, /ks_update_team_member_access/);
  assert.match(app, /KanawaCloud\.createTeamInvitation/);
  assert.match(app, /KanawaCloud\.acceptInvitation/);
  assert.match(html, /id="inviteSignupForm"/);
  const usersBlock = app.slice(app.indexOf('/* ====== UTILIZADORES E PERMISSÕES CLOUD ====== */'), app.indexOf('/* ====== AUDITORIA ====== */'));
  assert.doesNotMatch(usersBlock, /senha\s*:/i);
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /accepted_at is null/);
  assert.match(migration, /i\.expires_at>now\(\)/);
  assert.match(migration, /role in \('manager','operator','cashier'\)/);
});

test('direct membership policies cannot grant or mutate owner/admin roles', () => {
  assert.match(migration, /role in \('manager','operator','cashier'\)/);
  assert.match(migration, /role not in \('owner','admin'\)/);
  assert.match(migration, /user_id <> \(select auth\.uid\(\)\)/);
  assert.match(migration, /ks_profiles_company_admin_read/);
});

test('invited collaborators confirm email before membership becomes active', () => {
  assert.match(migration, /after insert or update of email_confirmed_at on auth\.users/i);
  assert.match(migration, /set status='active'[\s\S]*?where user_id=new\.id and status='invited'/);
});

test('team-management RPCs run as SECURITY INVOKER under RLS', () => {
  assert.match(invokerMigration, /ks_team_invitations_admin_insert/);
  assert.match(invokerMigration, /security invoker/i);
  assert.match(invokerMigration, /alter function public\.ks_create_team_invitation[\s\S]*?security invoker/i);
  assert.match(invokerMigration, /alter function public\.ks_update_team_member_access[\s\S]*?security invoker/i);
});
