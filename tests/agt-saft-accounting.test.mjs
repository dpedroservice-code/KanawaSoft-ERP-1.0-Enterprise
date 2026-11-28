import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generateAccountingSaftXml, validateXmlAgainstXsd, NAMESPACE } = require('../server/agt/saft-accounting');
const { generateSalesInvoicesSaftXml } = require('../supabase/functions/_shared/saft-accounting');
const schemaPath = path.join(process.cwd(), 'schemas/agt/SAFTAO1.01_01.xsd');

function fixture() {
  return {
    dateCreated: '2026-11-08',
    company: {
      taxRegistrationNumber: '5410000000',
      companyName: 'Empresa de Teste, Lda.',
      companyId: '5410000000',
      address: { addressDetail: 'Rua de Teste, n.º 10', city: 'Luanda', province: 'Luanda' },
      telephone: '+244900000000',
      email: 'financeiro@example.ao'
    },
    period: { fiscalYear: 2026, startDate: '2026-01-01', endDate: '2026-12-31' },
    software: {
      productCompanyTaxId: '5410000000',
      softwareValidationNumber: '0',
      productId: 'Kanawa Soft/Kanawa Soft',
      productVersion: '1.0.0'
    },
    accounts: [
      { accountId: '1', description: 'Meios fixos e circulantes', openingDebitBalance: '1000.00', openingCreditBalance: '0.00', closingDebitBalance: '1250.00', closingCreditBalance: '0.00', groupingCategory: 'GR' },
      { accountId: '11', description: 'Caixa', openingDebitBalance: '1000.00', openingCreditBalance: '0.00', closingDebitBalance: '1250.00', closingCreditBalance: '0.00', groupingCategory: 'GM', groupingCode: '1' }
    ],
    entries: [
      {
        entryNumber: 'DIARIO-2026-000001',
        transactionDate: '2026-02-10',
        systemEntryDate: '2026-02-10T10:30:00',
        sourceId: 'contabilista',
        description: 'Recebimento de venda',
        docArchivalNumber: 'REC-2026-0001',
        transactionType: 'N',
        journalId: 'GERAL',
        journalDescription: 'Diário geral',
        status: 'posted',
        lines: [
          { recordId: '1', accountId: '11', debit: '250.00', credit: '0.00', systemEntryDate: '2026-02-10T10:30:00', description: 'Entrada em caixa' },
          { recordId: '2', accountId: '11', debit: '0.00', credit: '250.00', systemEntryDate: '2026-02-10T10:30:00', description: 'Contrapartida' }
        ]
      }
    ]
  };
}

test('gera SAF-T de contabilidade com cabeçalho, contas e movimentos', () => {
  const xml = generateAccountingSaftXml(fixture());
  assert.match(xml, new RegExp('xmlns="' + NAMESPACE + '"'));
  assert.match(xml, /<TaxAccountingBasis>C<\/TaxAccountingBasis>/);
  assert.match(xml, /<TaxEntity>Sede<\/TaxEntity>/);
  assert.match(xml, /<GeneralLedgerAccounts>/);
  assert.match(xml, /<GeneralLedgerEntries>/);
  assert.match(xml, /<NumberOfEntries>1<\/NumberOfEntries>/);
  assert.match(xml, /<TotalDebit>250\.00<\/TotalDebit>/);
  assert.match(xml, /<TotalCredit>250\.00<\/TotalCredit>/);
  assert.match(xml, /<DebitLine>/);
  assert.match(xml, /<CreditLine>/);
  assert.doesNotMatch(xml, /SourceDocuments/);
});

test('rejeita movimentos desequilibrados', () => {
  const data = fixture();
  data.entries[0].lines[0].debit = '251.00';
  assert.throws(() => generateAccountingSaftXml(data), /não está equilibrado/);
});

test('rejeita conta não declarada no plano de contas', () => {
  const data = fixture();
  data.entries[0].lines[0].accountId = '999';
  assert.throws(() => generateAccountingSaftXml(data), /não existe no plano de contas/);
});

test('rejeita datas e valores negativos ou com mais de duas casas', () => {
  const data = fixture();
  data.entries[0].lines[0].debit = '-1.00';
  assert.throws(() => generateAccountingSaftXml(data), /não negativo/);
  const badDate = fixture();
  badDate.period.startDate = '2026-02-30';
  assert.throws(() => generateAccountingSaftXml(badDate), /data válida/);
});

test('ignora lançamentos que não estejam contabilisticamente confirmados', () => {
  const data = fixture();
  data.entries[0].status = 'draft';
  const xml = generateAccountingSaftXml(data);
  assert.match(xml, /<NumberOfEntries>0<\/NumberOfEntries>/);
  assert.match(xml, /<TotalDebit>0\.00<\/TotalDebit>/);
});

test('o XSD oficial está incluído e a validação externa comunica a disponibilidade do xmllint', (t) => {
  assert.equal(fs.existsSync(schemaPath), true);
  const schema = fs.readFileSync(schemaPath, 'utf8');
  assert.match(schema, /SAF-T_AO/);
  const result = validateXmlAgainstXsd(generateAccountingSaftXml(fixture()), schemaPath);
  if (!result.available) {
    t.diagnostic(result.errors.join('; '));
    return;
  }
  assert.equal(result.valid, true, result.errors.join('\n'));
});


function salesFixture() {
  const customer = {
    customerId: 'CLI-001', customerTaxId: '5410000001',
    companyName: 'Silva & Filhos, Lda',
    address: { addressDetail: 'Rua da Liberdade, n.º 10', city: 'Luanda', province: 'Luanda' }
  };
  const product = {
    productCode: 'SKU-001', productType: 'P',
    productDescription: 'Produto <Premium> & especial',
    productNumberCode: 'SKU-001'
  };
  const line = (amount, taxPercentage, taxCode, exemption = {}) => ({
    productCode: 'SKU-001', description: 'Artigo & serviço',
    quantity: '1', unitOfMeasure: 'UN', unitPrice: amount,
    amount, taxPointDate: '2026-11-10', taxType: 'IVA', taxCode,
    taxPercentage, ...exemption
  });
  const invoice = (invoiceNo, invoiceType, amount, taxPayable, status = 'N', extra = {}) => ({
    invoiceNo, invoiceType, invoiceDate: '2026-11-10',
    systemEntryDate: '2026-11-10T10:30:00',
    invoiceStatus: status, invoiceStatusDate: '2026-11-10T10:30:00',
    ...(status === 'A' ? { reason: 'Anulação de teste' } : {}),
    sourceId: 'utilizador-teste', sourceBilling: 'P',
    hash4: '0', hashControl: '0', customerId: 'CLI-001',
    lines: [line(amount, extra.taxPercentage ?? '14', extra.taxCode || 'NOR', extra.exemption || {})],
    netTotal: amount, taxPayable, grossTotal: (Number(amount) + Number(taxPayable)).toFixed(2),
    ...extra.invoiceFields
  });
  return {
    dateCreated: '2026-11-28',
    company: {
      taxRegistrationNumber: '5410000000', companyId: '5410000000',
      companyName: 'D.Pedro & Parceiros, Lda',
      address: { addressDetail: 'Rua de Teste, n.º 10', city: 'Luanda', province: 'Luanda' }
    },
    period: { fiscalYear: 2026, startDate: '2026-01-01', endDate: '2026-12-31' },
    software: {
      productCompanyTaxId: '5410000000',
      softwareValidationNumber: '0',
      productId: 'Kanawa Soft/D.PEDRO SOLUÇÕES LDA',
      productVersion: '1.0.0'
    },
    customers: [customer], products: [product],
    invoices: [
      invoice('FT A2026/1', 'FT', '100.00', '14.00'),
      invoice('FR A2026/2', 'FR', '50.00', '0.00', 'N', {
        taxPercentage: '0', taxCode: 'ISE',
        exemption: { taxExemptionCode: 'M04', taxExemptionReason: 'Isenção legal aplicável' }
      }),
      invoice('NC A2026/3', 'NC', '20.00', '2.80', 'N', {
        invoiceFields: {},
        references: undefined,
      }),
      invoice('FT A2026/4', 'FT', '30.00', '4.20', 'A')
    ].map((doc, index) => {
      if (doc.invoiceType === 'NC') {
        doc.lines[0].references = [{ reference: 'FT A2026/1', reason: 'Anulação parcial da venda original' }];
      }
      return doc;
    })
  };
}

test('gera SAF-T de vendas com FT, FR isenta, NC referenciada e documento anulado', (t) => {
  const data = salesFixture();
  const xml = generateSalesInvoicesSaftXml(data);
  assert.match(xml, /Silva &amp; Filhos, Lda/);
  assert.match(xml, /Produto &lt;Premium&gt; &amp; especial/);
  assert.match(xml, /<TaxExemptionReason>Isenção legal aplicável<\/TaxExemptionReason>/);
  assert.match(xml, /<TaxExemptionCode>M04<\/TaxExemptionCode>/);
  assert.match(xml, /<References><Reference>FT A2026\/1<\/Reference><Reason>Anulação parcial da venda original<\/Reason><\/References>/);
  assert.match(xml, /<InvoiceStatus>A<\/InvoiceStatus>/);
  assert.match(xml, /<Reason>Anulação de teste<\/Reason>/);
  assert.match(xml, /<TotalDebit>20\.00<\/TotalDebit>/);
  assert.match(xml, /<TotalCredit>150\.00<\/TotalCredit>/);
  assert.match(xml, /<NumberOfEntries>4<\/NumberOfEntries>/);
  assert.match(xml, /<Hash>0<\/Hash><HashControl>0<\/HashControl>/);
  const result = validateXmlAgainstXsd(xml, schemaPath);
  if (!result.available) {
    t.diagnostic('Validador xmllint indisponível: ' + result.errors.join('; '));
    return;
  }
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('rejeita referências incompletas na Nota de Crédito', () => {
  const data = salesFixture();
  data.invoices[2].lines[0].references = [{ reference: 'FT A2026/1' }];
  assert.throws(() => generateSalesInvoicesSaftXml(data), /Motivo da referência/);
});

test('rejeita cliente ou produto ausente de MasterFiles', () => {
  const missingCustomer = salesFixture();
  missingCustomer.customers = [];
  assert.throws(() => generateSalesInvoicesSaftXml(missingCustomer), /não consta em MasterFiles/);
  const missingProduct = salesFixture();
  missingProduct.products = [];
  assert.throws(() => generateSalesInvoicesSaftXml(missingProduct), /não consta em MasterFiles/);
});

test('escapa XML e rejeita valores monetários inválidos', () => {
  const data = salesFixture();
  data.invoices[0].lines[0].amount = '1,500.00';
  assert.throws(() => generateSalesInvoicesSaftXml(data), /não negativo/);
});
