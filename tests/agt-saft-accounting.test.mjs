import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generateAccountingSaftXml, validateXmlAgainstXsd, NAMESPACE } = require('../server/agt/saft-accounting');
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
