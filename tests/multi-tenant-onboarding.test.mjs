import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const onboardingMigration = readFileSync(
  new URL('../supabase/migrations/20261107220000_validate_team_invite_before_signup.sql', import.meta.url),
  'utf8'
);

test('new independent signups submit company identity and default to a trial', () => {
  assert.match(cloud, /async signUp\(details\)/);
  assert.match(cloud, /client\.auth\.signUp\(/);
  assert.match(cloud, /company_legal_name:\s*details\.companyName/);
  assert.match(cloud, /company_trade_name:\s*details\.companyName/);
  assert.match(cloud, /company_tax_id:\s*details\.taxId/);
  assert.match(cloud, /selected_plan:\s*details\.selectedPlan\s*\|\|\s*localStorage\.getItem\('kanawa_selected_plan'\)\s*\|\|\s*'trial'/);
  assert.match(app, /KanawaCloud\.signUp\(\{/);
});

test('server onboarding creates a new tenant and its first user as owner with a 14-day trial', () => {
  assert.match(onboardingMigration, /CREATE OR REPLACE FUNCTION private\.ks_handle_new_user\(\)/);
  assert.match(onboardingMigration, /SECURITY DEFINER SET search_path TO ''/);
  assert.match(onboardingMigration, /INSERT INTO public\.ks_companies\(owner_user_id,legal_name,trade_name,tax_id/);
  assert.match(onboardingMigration, /INSERT INTO public\.ks_company_memberships\(company_id,user_id,role,status\)\s*VALUES\(v_company_id,new\.id,'owner','active'\)/);
  assert.match(onboardingMigration, /case when v_trial then 'trial' else v_plan end/);
  assert.match(onboardingMigration, /now\(\)\+interval '14 days'/);
});

test('invitation signup is bound to the invited email and a hashed one-time code', () => {
  assert.match(onboardingMigration, /lower\(i\.email\)=lower\(new\.email\)/);
  assert.match(onboardingMigration, /i\.token_hash=encode\(extensions\.digest\(convert_to\(v_invitation_code,'UTF8'\),'sha256'\),'hex'\)/);
  assert.match(onboardingMigration, /i\.accepted_at IS NULL AND i\.expires_at>now\(\)/);
  assert.match(onboardingMigration, /IF new\.email_confirmed_at IS NULL THEN RETURN new; END IF/);
  assert.match(onboardingMigration, /v_invitation\.role NOT IN \('manager','operator','cashier','accountant','gerente','operador','caixa','contabilista'\)/);
});

test('a user can only load a company through their own active membership', () => {
  assert.match(cloud, /\.from\('ks_company_memberships'\)[\s\S]*?\.eq\('user_id', user\.id\)[\s\S]*?\.eq\('status', 'active'\)/);
  assert.match(cloud, /\.from\('ks_companies'\)[\s\S]*?\.eq\('id', membership\.company_id\)/);
  assert.doesNotMatch(cloud, /\.from\('ks_companies'\)\s*\.insert\(/);
  assert.doesNotMatch(cloud, /\.from\('ks_company_memberships'\)\s*\.insert\(/);
});

test('signup OTP requires six digits before loading the tenant context', () => {
  assert.match(cloud, /async verifySignupOtp\(email, token, otpType\)/);
  assert.match(cloud, /!\/\^\\d\{6\}\$\/\.test\(code\)/);
  assert.match(cloud, /return await loadContext\(result\.data\.user\)/);
});

test('communication module has one canonical plan requirement', () => {
  const start = app.indexOf('const MENU_MODULE_MIN_PLAN={');
  const end = app.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start, 'module plan map must exist');
  const map = app.slice(start, end);
  const matches = map.match(/(?:'comunicacao'|comunicacao)\s*:/g) || [];
  assert.equal(matches.length, 1, 'duplicate object keys can silently override plan tiers');
  assert.match(map, /['"]?comunicacao['"]?\s*:\s*['"]enterprise['"]/);
});
