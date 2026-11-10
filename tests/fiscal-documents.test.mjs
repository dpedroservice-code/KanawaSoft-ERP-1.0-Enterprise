import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app/fiscal-documents.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../app/cloud.js',import.meta.url),'utf8');
const template=readFileSync(new URL('../app/fatura-modelos.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261110191500_typed_ft_fr_invoice_sequences.sql',import.meta.url),'utf8');
function engine(){
  const window={};
  vm.runInNewContext(source,{window,Intl,Date,Object,Number,String,Math,Error,RegExp,Array});
  return window.KanawaFiscalDocuments;
}

test('fiscal engine calculates each line with its own rate and allocates discount in cents',()=>{
  const result=engine().calculateLines([
    {nome:'A',quantity:2,unitPrice:100,taxRate:14,unitOfMeasure:'UN'},
    {nome:'B',quantity:1,unitPrice:50,taxRate:0.07}
  ],{discountPercent:10,defaultRate:0.14,applyTax:true});
  assert.equal(result.subtotal,250);
  assert.equal(result.discountValue,25);
  assert.equal(result.taxableBase,225);
  assert.equal(result.lines[0].taxRate,14);
  assert.equal(result.lines[1].taxRate,7);
  assert.equal(result.taxAmount,28.35);
  assert.equal(result.total,253.35);
});

test('zero-rate exemption requires a legal reason only when the line is explicitly exempt',()=>{
  const fiscal=engine();
  const lines=fiscal.calculateLines([{quantity:1,unitPrice:100,taxRate:0,taxExempt:true}],{applyTax:true}).lines;
  assert.throws(()=>fiscal.validateTaxLines(lines),/fundamento de isenção/);
  assert.equal(fiscal.validateTaxLines([{taxRate:0,taxExempt:false}]),true);
});

test('document validator distinguishes fiscal invoices from non-fiscal proforma',()=>{
  const fiscal=engine();
  assert.equal(fiscal.validateDocument({documentType:'FT',number:'FT-2026-000001',issuer:{nif:'500000000'}}).fiscal,true);
  assert.equal(fiscal.validateDocument({documentType:'FR',number:'FR-2026-000001',issuer:{nif:'500000000'}}).label,'Fatura-Recibo');
  assert.equal(fiscal.validateDocument({documentType:'PP'}).fiscal,false);
  assert.throws(()=>fiscal.validateDocument({documentType:'FT',number:'FR-2026-000001',issuer:{nif:'500000000'}}),/Número sequencial inválido/);
});

test('POS selects FT for credit and FR for immediate payment and stores tax details',()=>{
  assert.match(app,/const tipoDocumento = pdvState\.pagamento === 'credito' \? 'FT' : 'FR'/);
  assert.match(app,/nextInvoiceNumber\(tipoDocumento\)/);
  assert.match(app,/detalheFiscal:/);
  assert.match(app,/taxAmount:fiscalLine\.taxAmount/);
  assert.match(cloud,/p_document_type: type/);
  assert.match(cloud,/\['FT','FR'\]/);
});

test('server sequence is atomic per company, year and document type',()=>{
  assert.match(migration,/primary key \(company_id, fiscal_year, document_type\)/);
  assert.match(migration,/on conflict\(company_id,fiscal_year,document_type\)/);
  assert.match(migration,/last_number=private\.ks_invoice_sequences\.last_number\+1/);
  assert.match(migration,/v_type not in \('FT','FR'\)/);
  assert.match(migration,/p_document_type text/);
});

test('printed invoice shows the actual type, tax breakdown and no false AGT certification',()=>{
  assert.match(template,/documentLabel/);
  assert.match(template,/Valor IVA/);
  assert.match(template,/taxRate/);
  assert.match(template,/certificação AGT não confirmada/);
  assert.match(template,/Não constitui prova de certificação ou validação pela AGT/);
});

test('RE and NC use server-side append-only flows linked to the source FT',()=>{
  const workflow=readFileSync(new URL('../supabase/migrations/20261110194500_receipts_and_credit_notes.sql',import.meta.url),'utf8');
  assert.match(workflow,/private\.ks_issue_invoice_receipt/);
  assert.match(workflow,/private\.ks_issue_credit_note/);
  assert.match(workflow,/ks_payment_transactions/);
  assert.match(workflow,/source_document_id/);
  assert.match(workflow,/credit_note_issued/);
  assert.match(workflow,/ks_next_invoice_number\(p_company_id,'RE'/);
  assert.match(workflow,/ks_next_invoice_number\(p_company_id,'NC'/);
  assert.match(app,/async function confirmarReciboConta/);
  assert.match(app,/async function confirmarNotaCredito/);
  assert.match(cloud,/issueInvoiceReceipt/);
  assert.match(cloud,/issueCreditNote/);
});

test('proforma remains a non-fiscal quote and does not move stock or finance',()=>{
  assert.match(app,/tipoDocumento:'PP'/);
  assert.match(app,/documentoFiscal:false/);
  assert.match(app,/movimentaStock:false/);
  assert.match(app,/movimentaFinanceiro:false/);
  assert.match(app,/status:'rascunho'/);
});

test('fiscal ledger blocks update and delete and records FT FR snapshots',()=>{
  const ledger=readFileSync(new URL('../supabase/migrations/20261110193000_fiscal_document_immutable_ledger.sql',import.meta.url),'utf8');
  assert.match(ledger,/ks_fiscal_documents_append_only/);
  assert.match(ledger,/before update or delete/);
  assert.match(ledger,/private\.ks_finalize_sale\(p_company_id,p_sale,p_items\)/);
  assert.match(ledger,/p_fiscal_document jsonb/);
  assert.match(ledger,/unique index if not exists ks_fiscal_documents_one_sale_type_idx/);
  assert.match(cloud,/ks_finalize_fiscal_sale/);
});
