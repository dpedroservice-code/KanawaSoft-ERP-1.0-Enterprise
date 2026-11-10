import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const invoice = readFileSync(new URL('../app/fatura-modelos.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

test('invoice templates provide selectable layouts and use company and sale data', () => {
  for (const layout of ['classic','modern','minimal']) assert.ok(invoice.includes(layout));
  for (const field of ['companyName','company.nif','company.endereco','company.telefone','company.email','company.banco','company.iban','sale.numeroFatura','sale.clienteNome','sale.operador','sale.total','sale.troco']) {
    assert.ok(invoice.includes(field), 'missing invoice data binding: '+field);
  }
  assert.match(invoice,/global\.KanawaInvoiceTemplates/);
  assert.match(app,/KanawaInvoiceTemplates\.render/);
});

test('invoice QR is optional and never fakes a QR or claims AGT validation', () => {
  assert.match(invoice,/cfg\.showQr===true/);
  assert.match(invoice,/server-verified AGT integration/);
  assert.doesNotMatch(invoice,/quiosqueagt|Código de Autenticação AGT|Hash de assinatura/);
  assert.match(app,/QR indisponível neste dispositivo/);
  assert.doesNotMatch(app,/const grid = 25/);
});

test('company bank details and custom commercial terms are configurable for invoices', () => {
  assert.match(app,/cfgIban/);
  assert.match(app,/cfgBanco/);
  assert.match(app,/cfgInvoiceTerms/);
  assert.match(app,/cfgInvoiceBank/);
  assert.match(app,/salvarConfigFatura/);
  assert.match(invoice,/company\.iban/);
  assert.match(invoice,/Termos e condições da empresa/);
});

test('maintenance orders record customer company, assigned technician, dates and completion report', () => {
  for (const token of ['empresaCliente','tecnicoNome','tecnicoId','dataAgendada','proximaManutencao','dataConclusao','relatorioTecnico','historico']) {
    assert.ok(app.includes(token), 'missing maintenance field ' + token);
  }
  assert.match(app,/function verDetalheManutencao/);
  assert.match(app,/function salvarManutencaoAtivo/);
});

test('login feedback is neutral and database vendor is not named in user-facing application strings', () => {
  assert.match(app,/A processar acesso/);
  assert.match(app,/A preparar sincronização segura/);
  assert.doesNotMatch(app,/guardada no PostgreSQL|A sincronizar com PostgreSQL/);
  assert.match(html,/ERP Empresarial 1\.0/);
});

test('commercial proposals retain the client company and link accepted business to the sale', () => {
  assert.match(app,/empresaCliente/);
  assert.match(app,/atualizarEstadoOrcamento/);
  assert.match(app,/status\s*=\s*'convertida'/);
  assert.match(app,/orcamentoOrigem/);
  assert.match(app,/vendaId\s*=\s*venda\.id/);
  assert.match(app,/Propostas e Negócios/);
});

test('official invoice numbering is atomic and allocated only inside finalization', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261110191500_typed_ft_fr_invoice_sequences.sql', import.meta.url), 'utf8');
  const ledger = readFileSync(new URL('../supabase/migrations/20261110193000_fiscal_document_immutable_ledger.sql', import.meta.url), 'utf8');
  const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
  assert.match(migration,/primary key \(company_id, fiscal_year, document_type\)/);
  assert.match(migration,/last_number=private\.ks_invoice_sequences\.last_number\+1/);
  assert.match(migration,/security definer/);
  assert.match(migration,/ks_has_company_role/);
  assert.match(ledger,/private\.ks_next_invoice_number\(/);
  assert.match(ledger,/returns jsonb/);
  assert.match(ledger,/jsonb_set\(coalesce\(p_fiscal_document/);
  assert.match(cloud,/ks_finalize_fiscal_sale/);
  assert.match(cloud,/A numeração é atribuída atomicamente pelo servidor/);
  assert.match(app,/numeroFatura: null/);
});

test('paid tiers are unlimited while the 14-day evaluation remains bounded', () => {
  const plans = readFileSync(new URL('../supabase/migrations/20261107125000_paid_plans_unlimited_usage.sql', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(plans,/max_users = 0/);
  assert.match(plans,/max_installations = 0/);
  assert.match(plans,/max_invoices_period = 0/);
  assert.match(plans,/all_modules',true/);
  assert.match(html,/Facturas e operações ilimitadas/);
  assert.match(app,/Facturas ilimitadas/);
});

test('only the single server-registered platform owner can manage license keys', () => {
  const owner = readFileSync(new URL('../supabase/migrations/20261107126000_single_platform_owner_for_license_management.sql', import.meta.url), 'utf8');
  const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
  assert.match(owner,/private\.ks_platform_owner/);
  assert.match(owner,/singleton boolean primary key/);
  assert.match(owner,/user_id = \(select auth\.uid\(\)\)/);
  assert.match(owner,/revoke all on table private\.ks_platform_owner from public, anon, authenticated/);
  assert.match(cloud,/client\.rpc\('ks_is_platform_admin'\)/);
  assert.doesNotMatch(cloud,/from\('ks_platform_admins'\)/);
});


test('company invoice identity and banking settings sync by tenant', () => {
  assert.match(app,/async function carregarConfigEmpresa/);
  assert.match(app,/saveData\('empresaConfig'/);
  assert.match(app,/await carregarConfigEmpresa\(\)/);
  assert.match(app,/empresaConfig/);
  assert.match(app,/cfgEnd/);
  assert.match(app,/cfgIban/);
});

test('accounting module uses tenant-scoped server RPC and balanced double-entry validation', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261107128000_accounting_double_entry_engine.sql', import.meta.url), 'utf8');
  const cloud = readFileSync(new URL('../app/cloud.js', import.meta.url), 'utf8');
  assert.match(migration,/private\.ks_post_journal_entry/);
  assert.match(migration,/round\(v_debit,2\)<>round\(v_credit,2\)/);
  assert.match(migration,/pg_advisory_xact_lock/);
  assert.match(migration,/private\.ks_has_company_role/);
  assert.match(migration,/public\.ks_post_journal_entry/);
  assert.match(cloud,/async postJournalEntry/);
  assert.match(cloud,/ks_post_journal_entry/);
  assert.match(app,/async function renderContabilidade/);
  assert.match(app,/async function guardarLancamentoContabilistico/);
  assert.match(app,/O total de débito deve ser igual ao total de crédito/);
  assert.match(app,/id: 'contabilidade'/);
});

test('accounting trial balance aggregates only posted journal lines', () => {
  const snapshot = readFileSync(new URL('../supabase/migrations/20261107129000_accounting_trial_balance_snapshot.sql', import.meta.url), 'utf8');
  assert.match(snapshot,/sum\(l\.debit\) filter \(where e\.id is not null\)/);
  assert.match(snapshot,/sum\(l\.credit\) filter \(where e\.id is not null\)/);
  assert.match(app,/fmt\(a\.debit_total\)/);
  assert.match(app,/fmt\(a\.credit_total\)/);
  assert.match(app,/fmt\(a\.balance\)/);
});


test('finalized invoices require server confirmation and retain an idempotent retry snapshot', () => {
  assert.match(app,/let pdvPendingFinalSale = null/);
  assert.match(app,/let pdvFinalizing = false/);
  assert.match(app,/if \(pdvFinalizing\) return/);
  assert.match(app,/if \(!pdvPendingFinalSale\)/);
  assert.match(app,/sameCart/);
  assert.match(app,/A fatura .* ainda não foi confirmada pelo servidor/);
  assert.match(app,/Venda .* confirmada no servidor/);
  assert.match(app,/A finalized invoice is only successful after server confirmation/);
  assert.match(app,/await DB\.del\(store, id\);\s*throw e;/);
});
