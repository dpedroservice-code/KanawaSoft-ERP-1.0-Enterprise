import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
const enterprise = readFileSync(new URL('../supabase/migrations/20261107110000_enterprise_management_licensing.sql', import.meta.url), 'utf8');
const privacy = readFileSync(new URL('../supabase/migrations/20261107115000_enterprise_data_privacy_hardening.sql', import.meta.url), 'utf8');
const employeePolicies = readFileSync(new URL('../supabase/migrations/20261107112000_employee_workflows_payroll_policies.sql', import.meta.url), 'utf8');
const keyBinding = readFileSync(new URL('../supabase/migrations/20261107113000_license_request_binding_and_meeting_participants.sql', import.meta.url), 'utf8');
const tenantRelations = readFileSync(new URL('../supabase/migrations/20261107116000_tenant_safe_relationships.sql', import.meta.url), 'utf8');
const privateFunctions = readFileSync(new URL('../supabase/migrations/20261107117000_private_security_definer_functions.sql', import.meta.url), 'utf8');
const vaultMigration = readFileSync(new URL('../supabase/migrations/20261107120000_vault_integration_encryption_key.sql', import.meta.url), 'utf8');
const integrationEdge = readFileSync(new URL('../supabase/functions/company-integrations/index.ts', import.meta.url), 'utf8');
const fkIndexSweep = readFileSync(new URL('../supabase/migrations/20261107121000_index_remaining_foreign_keys.sql', import.meta.url), 'utf8');
const policyCleanup = readFileSync(new URL('../supabase/migrations/20261107122000_policy_overlap_cleanup.sql', import.meta.url), 'utf8');
const profilePolicies = readFileSync(new URL('../supabase/migrations/20261107123000_profiles_policy_consolidation.sql', import.meta.url), 'utf8');
const paymentMethods = readFileSync(new URL('../supabase/migrations/20261108250000_restrict_saas_payment_methods.sql', import.meta.url), 'utf8');

test('first-run marketing screen, package selection and one-time presentation are wired', () => {
  assert.match(html, /id="planWelcome"/);
  assert.match(html, /Testar gratuitamente 14 dias/);
  assert.match(html, /Escolher Mini/);
  assert.match(html, /Escolher Standard/);
  assert.match(html, /Escolher Premium/);
  assert.match(html, /Transferência bancária/);
  assert.match(html, /Multicaixa Express/);
  assert.doesNotMatch(html, /Levantamento sem cartão|value="cash_without_card"/);
  assert.doesNotMatch(html, /value="card"/);
  assert.match(html, /validação manual/);
  assert.match(html, /preLoginLicenseKey/);
  assert.match(app, /kanawa_plan_intro_seen/);
  assert.match(app, /function selecionarPlano/);
  assert.match(app, /function continuarComPlanoPago/);
});

test('Angola company registration captures commercial registry, GUE publication, licences and owner identity', () => {
  for (const field of ['setupLegalForm','setupRegistryNumber','setupEntryNumber','setupPublicationNumber','setupPublicationDate','setupAlvaraNumber','setupAlvaraExpiry','setupOwnerBI','setupOwnerNIF','setupInssNumber']) {
    assert.ok(html.includes(field), 'missing onboarding field '+field);
  }
  assert.match(enterprise, /ks_company_legal_profiles/);
  assert.match(enterprise, /ks_company_documents/);
  assert.match(enterprise, /ks_company_parties/);
  assert.match(enterprise, /commercial_registry_number/);
  assert.match(enterprise, /publication_number/);
  assert.match(enterprise, /alvara_expiry_date/);
});

test('enterprise modules are present and use cloud APIs for core workflows', () => {
  for (const moduleId of ['empresa-legal','licenca','despesas-gerais','ferias-dispensas','agenda','reunioes','comunicacao','aprovacoes-empresa','departamentos-empresa','orcamento-empresa','rh-documentos','folha-salarial']) {
    assert.ok(app.includes("id: '"+moduleId+"'"), 'missing module '+moduleId);
  }
  for (const fn of ['renderEmpresaLegal','renderLicenca','renderDespesasGerais','renderFeriasDispensas','renderAgenda','renderReunioes','renderComunicacao','renderFolhaSalarial']) {
    assert.ok(app.includes('function '+fn) || app.includes('async function '+fn), 'missing renderer '+fn);
  }
  for (const api of ['createGeneralExpense','createLeaveRequest','createCalendarEvent','createMeeting','sendInternalMessage','createSharedFile','savePayrollRun','saveCompanyLegalProfile']) {
    assert.ok(cloud.includes('async '+api), 'missing cloud API '+api);
  }
});

test('HR calculations use configurable IRT and explicit general-regime INSS contribution rates', () => {
  assert.match(app, /inssBase\*0\.03/);
  assert.match(app, /inssBase\*0\.08/);
  assert.match(app, /calcIRT\(taxableBase\)/);
  assert.match(app, /calcularDireitoFerias/);
  assert.match(app, /22 dias úteis/);
});

test('trial, licence keys, subscription terms and invoice quotas are enforced server-side', () => {
  assert.match(enterprise, /interval '14 days'/);
  assert.match(enterprise, /LICENCE_EXPIRED/);
  assert.match(enterprise, /INVOICE_QUOTA_REACHED/);
  assert.match(enterprise, /max_invoices_period/);
  assert.match(enterprise, /duration_months in \(1,12,24,36\)/);
  assert.match(enterprise, /ks_issue_license_key/);
  assert.match(enterprise, /ks_redeem_license_key/);
  assert.match(keyBinding, /payment_request_id/);
  assert.match(keyBinding, /v_key\.payment_request_id/);
  assert.match(privacy, /ks_get_company_entitlements/);
  assert.match(privacy, /Acesso negado às permissões desta empresa/);
});

test('sensitive employee, company and payroll data is manager-restricted', () => {
  assert.match(privacy, /t\|\|'_manager_read'/);
  for (const table of ['ks_employee_documents','ks_employee_compensation_history','ks_company_documents','ks_payroll_items']) {
    assert.ok(privacy.includes("'"+table+"'"), 'missing manager-restricted table '+table);
  }
  assert.match(employeePolicies, /ks_calendar_events_member_insert/);
  assert.match(employeePolicies, /ks_internal_messages_member_insert/);
  assert.match(employeePolicies, /ks_leave_requests_employee_insert/);
});

test('private documents and payment proofs are not public and browser code has no service-role or integration secrets', () => {
  assert.match(enterprise, /values\('ks-company-documents','ks-company-documents',false/);
  assert.match(enterprise, /values\('ks-payment-proofs','ks-payment-proofs',false/);
  assert.match(cloud, /createSignedUrl/);
  assert.doesNotMatch(html+app+cloud, /SUPABASE_SERVICE_ROLE_KEY|INTEGRATION_ENCRYPTION_KEY|EA[A-Z0-9]{20,}/);
});


test('enterprise schema adds 28 tables and tenant-safe composite relationships', () => {
  const count=enterprise.split('create table if not exists public.').length-1;
  assert.equal(count,28);
  assert.ok(tenantRelations.includes('foreign key(company_id,employee_id) references public.ks_employees(company_id,id)'));
  assert.ok(tenantRelations.includes('foreign key(company_id,payroll_run_id) references public.ks_payroll_runs(company_id,id)'));
  assert.ok(tenantRelations.includes('foreign key(company_id,meeting_id) references public.ks_meetings(company_id,id)'));
});


test('privileged SECURITY DEFINER implementations are moved to the private schema', () => {
  assert.match(privateFunctions,/alter function public\.ks_finalize_sale\(uuid,jsonb,jsonb\) set schema private/i);
  assert.match(privateFunctions,/alter function public\.ks_redeem_license_key\(text,uuid\) set schema private/i);
  assert.match(privateFunctions,/security invoker/i);
  assert.match(privateFunctions,/revoke all on function public\.ks_finalize_sale/i);
});


test('integration encryption key is generated in Supabase Vault and available only to service role', () => {
  assert.match(vaultMigration,/vault\.create_secret/);
  assert.match(vaultMigration,/vault\.decrypted_secrets/);
  assert.match(vaultMigration,/grant execute on function public\.ks_get_integration_encryption_key\(\) to service_role/i);
  assert.match(vaultMigration,/revoke all on function public\.ks_get_integration_encryption_key\(\) from public,anon,authenticated/i);
  assert.match(integrationEdge,/ks_get_integration_encryption_key/);
  assert.match(integrationEdge,/encryptSecret\(credentials, encryptionKey\)/);
});


test('database hardening indexes remaining foreign keys and removes permissive policy overlaps', () => {
  assert.match(fkIndexSweep,/create index if not exists/i);
  assert.match(fkIndexSweep,/pg_constraint/);
  assert.match(policyCleanup,/drop policy if exists ks_companies_select_member/i);
  assert.match(policyCleanup,/drop policy if exists ks_memberships_read_self/i);
  assert.match(profilePolicies,/ks_profiles_select_self_or_company_admin/);
  assert.match(profilePolicies,/drop policy if exists ks_profiles_self/);
});


test('company onboarding is progressive and AGT/payment status is explicit', () => {
  assert.match(html, /id="setupNome"[^>]*required/);
  assert.match(html, /id="setupNif"[^>]*required/);
  assert.match(html, /id="setupTelefone"[^>]*required/);
  assert.match(html, /id="setupEmail"[^>]*required/);
  assert.match(html, /Dados fiscais, morada e registo legal \(pode preencher depois\)/);
  assert.match(app, /Preencha o nome, NIF, telefone e um email válido da empresa/);
  assert.match(html, /ainda não possui certificação oficial da AGT/i);
  assert.match(html, /API automática ainda não ligada/i);
});

test('SaaS payment requests reject unsupported methods for new requests', () => {
  assert.match(paymentMethods, /payment_method IN \('bank_transfer', 'multicaixa_express'\)/i);
  assert.match(paymentMethods, /NOT VALID/i);
  assert.match(paymentMethods, /validação manual/i);
});


test('first company account is always the fixed administrator role', () => {
  assert.match(html, /Perfil da conta principal/);
  assert.match(html, /Perfil fixo: Administrador/);
  assert.match(html, /Proprietário da empresa e primeiro utilizador do sistema/);
  assert.doesNotMatch(html, /id="setupAdminPerfil"|<option value="gerente">Gerente<\/option>/);
  assert.match(app, /perfil: 'admin', role: 'admin'/);
});

test('Standard plan is the highlighted popular option and pricing copy uses current spelling', () => {
  assert.match(html, /class="plan-card featured plan-card-standard"/);
  assert.match(html, /MAIS POPULAR/);
  assert.match(html, /<h3>Standard<\/h3><div class="price">35\.000 Kz<\/div>/);
  assert.doesNotMatch(html, /class="plan-card featured[^"]*".*<h3>Premium<\/h3>/s);
  assert.match(html, /cobrança ativa/);
  assert.doesNotMatch(html, /cobrança activa/);
  assert.match(html, /integração automática/);
});
