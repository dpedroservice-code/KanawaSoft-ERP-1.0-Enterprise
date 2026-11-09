import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261107100000_erp_integrations_foundation.sql', import.meta.url), 'utf8');
const rls = readFileSync(new URL('../supabase/migrations/20261107101000_help_audit_rls_hardening.sql', import.meta.url), 'utf8');
const edge = readFileSync(new URL('../supabase/functions/company-integrations/index.ts', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../app/integracoes.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const legal = readFileSync(new URL('../app/conformidade.html', import.meta.url), 'utf8');
const legalMigration = readFileSync(new URL('../supabase/migrations/20261107102000_legal_compliance_register.sql', import.meta.url), 'utf8');
const gateway = readFileSync(new URL('../supabase/functions/ecommerce-gateway/index.ts', import.meta.url), 'utf8');

test('integration secrets and e-commerce API key hashes are server-only', () => {
  assert.match(migration, /ks_company_integration_secrets/);
  assert.match(migration, /credential_ciphertext/);
  assert.match(migration, /revoke all on public\.ks_company_integration_secrets from anon, authenticated/i);
  assert.match(migration, /key_hash text not null unique/);
  assert.match(migration, /revoke all on public\.ks_ecommerce_api_keys from anon, authenticated/i);
  assert.match(edge, /AES-GCM/);
  assert.match(edge, /sha256/);
  assert.match(edge, /auth\.getUser/);
  assert.match(edge, /ks_company_memberships/);
  assert.match(edge, /Copie agora/);
});

test('new ERP tables and nullable-company help/audit tables enable tenant RLS', () => {
  for (const table of ['ks_warehouses','ks_stock_movements','ks_suppliers','ks_customers','ks_purchase_orders','ks_payroll_runs','ks_projects','ks_delivery_routes','ks_ecommerce_orders','ks_marketing_leads','ks_marketing_campaigns','ks_connector_registry']) {
    assert.match(migration, new RegExp(table));
  }
  assert.match(rls, /alter table public\.ks_knowledge_articles enable row level security/i);
  assert.match(rls, /alter table public\.ks_audit_events enable row level security/i);
});

test('integration screen does not embed provider secrets or service role credentials', () => {
  assert.match(screen, /functions\.invoke\(fn/);
  assert.match(screen, /type="password"/);
  assert.doesNotMatch(screen, /SUPABASE_SERVICE_ROLE_KEY|INTEGRATION_ENCRYPTION_KEY|EA[A-Z0-9]{20,}/);
});


test('integrations center is reachable from the ERP sidebar', () => {
  assert.match(app, /id: 'integracoes'.*label: 'Integrações API'/);
  assert.match(app, /integracoes: renderIntegracoes/);
  assert.match(app, /href="integracoes\.html"/);
});


test('legal and compliance module is linked and tenant protected', () => {
  assert.match(app, /id: 'conformidade'.*label: 'Conformidade'/);
  assert.match(app, /conformidade: renderConformidade/);
  assert.match(app, /href="conformidade\.html"/);
  assert.match(legal, /ks_legal_register/);
  assert.match(legalMigration, /ks_policy_acceptances/);
  assert.match(legalMigration, /ks_compliance_tasks/);
  assert.match(legalMigration, /enable row level security/i);
});


test('external e-commerce gateway authenticates keys and enforces scopes and stock', () => {
  assert.match(gateway, /x-api-key/);
  assert.match(gateway, /key_hash/);
  assert.match(gateway, /catalog:read/);
  assert.match(gateway, /orders:write/);
  assert.match(gateway, /INSUFFICIENT_STOCK/);
  assert.match(gateway, /status: "pending"/);
});


test('payment gateway credentials reuse the encrypted server-only vault', () => {
  const paymentMigration = readFileSync(new URL('../supabase/migrations/20261108094253_payment_gateway_integrations.sql', import.meta.url), 'utf8');
  for (const provider of ['paypal','stripe','paypay','multicaixa']) {
    assert.match(paymentMigration, new RegExp("'" + provider + "'"));
    assert.match(edge, new RegExp('"' + provider + '"'));
  }
  assert.match(paymentMigration, /drop constraint if exists ks_company_integration_secrets_provider_check/i);
  assert.match(edge, /AES-GCM/);
  assert.match(edge, /allowedCredentialFields/);
  assert.match(edge, /credentials\.environment/);
  assert.match(screen, /id="merchantId"/);
  assert.match(screen, /id="clientId"/);
  assert.match(screen, /id="secretKey" type="password"/);
  assert.match(screen, /id="webhookSecret" type="password"/);
  assert.match(screen, /value="sandbox"/);
  assert.match(screen, /value="production"/);
  assert.match(screen, /secretKey","webhookSecret/);
});


test('integration settings whitelist submitted fields and escape labels in the browser', () => {
  assert.match(edge, /allowedCredentialFields/);
  assert.match(edge, /paymentRequirements/);
  assert.match(edge, /paypal: \["clientId", "secretKey"\]/);
  assert.match(edge, /stripe: \["secretKey"\]/);
  assert.match(screen, /const escHtml=value=>/);
  assert.match(screen, /escHtml\(k\.label\)/);
  assert.match(screen, /escHtml\(x\.provider\)/);
});


test('payment gateway form actually submits merchant, client, secret and webhook fields', () => {
  assert.match(screen, /merchantId:\$\("merchantId"\)\.value\.trim\(\)/);
  assert.match(screen, /clientId:\$\("clientId"\)\.value\.trim\(\)/);
  assert.match(screen, /secretKey:\$\("secretKey"\)\.value/);
  assert.match(screen, /webhookSecret:\$\("webhookSecret"\)\.value/);
  assert.match(screen, /environment:\$\("environment"\)\.value/);
  assert.match(screen, /const required=\{paypal:/);
  assert.match(screen, /const missing=required\.filter/);
});


test('payment credential endpoint rejects metadata-only requests', () => {
  assert.match(edge, /Introduza pelo menos uma credencial válida/);
  assert.match(edge, /missingPaymentFields/);
});


test('integration center inline JavaScript parses without syntax errors', () => {
  const scripts = [...screen.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(source => source.trim());
  assert.ok(scripts.length > 0, 'expected an inline integration script');
  for (const source of scripts) assert.doesNotThrow(() => new Function(source));
});


test('payment environment is stored as safe metadata and shown in integration status', () => {
  assert.match(edge, /environment: \["paypal","stripe","paypay","multicaixa"\]/);
  assert.match(edge, /select\("provider,last_four,environment,scopes,status,rotated_at,created_at"\)/);
  assert.match(screen, /x\.environment==="sandbox"\?"Teste":"Produção"/);
  assert.match(screen, /"merchantId","clientId","secretKey","webhookSecret"/);
});
