'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const NAMESPACE = 'urn:OECD:StandardAuditFile-Tax:AO_1.01_01';
const TRANSACTION_TYPES = new Set(['N', 'R', 'A', 'J']);
const GROUPING_CATEGORIES = new Set(['GR', 'GA', 'GM', 'AR', 'AA', 'AM']);

function fail(message) {
  const error = new Error(message);
  error.code = 'SAFT_VALIDATION_ERROR';
  throw error;
}
function requiredString(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim()) fail(label + ' é obrigatório.');
  const result = value.trim();
  if (result.length > (maxLength || 255)) fail(label + ' excede ' + (maxLength || 255) + ' caracteres.');
  return result;
}
function optionalString(value, maxLength) {
  if (value === undefined || value === null || value === '') return '';
  const result = String(value).trim();
  if (result.length > (maxLength || 255)) fail('Campo de texto excede o limite permitido.');
  return result;
}
function xml(value) {
  const text = String(value);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) fail('Carácter de controlo inválido para XML.');
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function tag(name, value) { return '<' + name + '>' + xml(value) + '</' + name + '>'; }
function money(value, label) {
  const raw = String(value === undefined || value === null ? '' : value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) {
    fail(label + ' deve ser não negativo e ter até duas casas decimais.');
  }
  const parts = raw.split('.');
  return parts[0] + '.' + (parts[1] || '').padEnd(2, '0');
}
function cents(value, label) {
  const parts = money(value, label).split('.');
  return BigInt(parts[0]) * 100n + BigInt(parts[1]);
}
function formatCents(value) {
  return (value / 100n).toString() + '.' + (value % 100n).toString().padStart(2, '0');
}
function dateOnly(value, label) {
  const result = requiredString(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) fail(label + ' deve usar AAAA-MM-DD.');
  const d = new Date(result + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== result) fail(label + ' não é uma data válida.');
  return result;
}
function dateTime(value, label) {
  const result = requiredString(value, label, 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(result)) {
    fail(label + ' deve usar AAAA-MM-DDThh:mm:ss, sem fuso horário nem milissegundos.');
  }
  dateOnly(result.slice(0, 10), label);
  if (Number(result.slice(11, 13)) > 23 || Number(result.slice(14, 16)) > 59 || Number(result.slice(17, 19)) > 59) {
    fail(label + ' contém uma hora inválida.');
  }
  return result;
}
function addressXml(address) {
  if (!address || typeof address !== 'object') fail('Endereço da empresa é obrigatório.');
  const parts = [];
  if (address.buildingNumber) parts.push(tag('BuildingNumber', requiredString(address.buildingNumber, 'Número da porta', 15)));
  if (address.streetName) parts.push(tag('StreetName', requiredString(address.streetName, 'Rua', 200)));
  parts.push(tag('AddressDetail', requiredString(address.addressDetail, 'Endereço detalhado', 250)));
  parts.push(tag('City', requiredString(address.city, 'Cidade', 50)));
  if (address.postalCode) parts.push(tag('PostalCode', requiredString(address.postalCode, 'Código postal', 20)));
  if (address.province) parts.push(tag('Province', requiredString(address.province, 'Província', 50)));
  parts.push(tag('Country', 'AO'));
  return '<CompanyAddress>' + parts.join('') + '</CompanyAddress>';
}
function normalizeAccount(account) {
  const id = requiredString(account.accountId || account.account_code, 'Código da conta', 30);
  const category = requiredString(account.groupingCategory, 'Categoria da conta ' + id, 2);
  if (!GROUPING_CATEGORIES.has(category)) fail('Categoria inválida na conta ' + id + ': ' + category + '.');
  return {
    accountId: id,
    description: requiredString(account.description || account.name, 'Descrição da conta ' + id, 100),
    openingDebitBalance: money(account.openingDebitBalance, 'Saldo inicial a débito da conta ' + id),
    openingCreditBalance: money(account.openingCreditBalance, 'Saldo inicial a crédito da conta ' + id),
    closingDebitBalance: money(account.closingDebitBalance, 'Saldo final a débito da conta ' + id),
    closingCreditBalance: money(account.closingCreditBalance, 'Saldo final a crédito da conta ' + id),
    groupingCategory: category,
    groupingCode: optionalString(account.groupingCode, 30)
  };
}
function lineXml(line, entry, index, side, accountIds) {
  const accountId = requiredString(line.accountId || line.account_id, 'Conta da linha', 30);
  if (!accountIds.has(accountId)) fail('A conta ' + accountId + ' do movimento ' + entry.transactionId + ' não existe no plano de contas.');
  const amount = money(side === 'debit' ? (line.debitAmount === undefined ? line.debit : line.debitAmount) : (line.creditAmount === undefined ? line.credit : line.creditAmount), 'Montante ' + side);
  if (cents(amount, 'Montante') <= 0n) fail('A linha ' + (index + 1) + ' deve ter montante positivo.');
  const recordId = requiredString(line.recordId || String(index + 1), 'Identificador da linha', 35);
  const systemEntryDate = dateTime(line.systemEntryDate || entry.systemEntryDate, 'Data/hora de gravação da linha');
  const description = requiredString(line.description || entry.description, 'Descrição da linha', 255);
  const sourceDocumentId = optionalString(line.sourceDocumentId, 30);
  const parts = [tag('RecordID', recordId), tag('AccountID', accountId)];
  if (sourceDocumentId) parts.push(tag('SourceDocumentID', sourceDocumentId));
  parts.push(tag('SystemEntryDate', systemEntryDate), tag('Description', description));
  parts.push(tag(side === 'debit' ? 'DebitAmount' : 'CreditAmount', amount));
  const name = side === 'debit' ? 'DebitLine' : 'CreditLine';
  return '<' + name + '>' + parts.join('') + '</' + name + '>';
}
function generateAccountingSaftXml(input) {
  if (!input || typeof input !== 'object') fail('Dados de exportação são obrigatórios.');
  const company = input.company || {};
  const period = input.period || {};
  const software = input.software || {};
  const startDate = dateOnly(period.startDate, 'Data inicial');
  const endDate = dateOnly(period.endDate, 'Data final');
  if (startDate > endDate) fail('A data inicial não pode ser posterior à data final.');
  const fiscalYear = Number(period.fiscalYear);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 9999) fail('Ano fiscal inválido.');
  const createdDate = dateOnly(input.dateCreated || new Date().toISOString().slice(0, 10), 'Data de criação');
  const nif = requiredString(company.taxRegistrationNumber, 'NIF da empresa', 20);
  if (!/^\d{9,15}$/.test(nif)) fail('O NIF da empresa deve conter 9 a 15 algarismos.');
  const companyId = requiredString(company.companyId || company.commercialRegistryId || nif, 'Identificação comercial da empresa', 50);
  const companyName = requiredString(company.companyName || company.legalName, 'Denominação social', 200);
  const producerNif = requiredString(software.productCompanyTaxId, 'NIF da entidade produtora do software', 20);
  if (!/^\d{9,15}$/.test(producerNif)) fail('O NIF da entidade produtora deve conter 9 a 15 algarismos.');
  const validationNumber = requiredString(software.softwareValidationNumber || '0', 'Número de validação do software', 70);
  if (validationNumber !== '0' && !/^\d+\/AGT\/\d{4}$/.test(validationNumber)) {
    fail('O número de validação deve seguir NNN/AGT/AAAA ou ser 0 quando não aplicável.');
  }
  const productId = requiredString(software.productId, 'Nome do software', 200);
  const productVersion = requiredString(software.productVersion, 'Versão do software', 20);
  const rawAccounts = Array.isArray(input.accounts) ? input.accounts : [];
  if (!rawAccounts.length) fail('A tabela de contas não pode estar vazia.');
  const accounts = rawAccounts.map(normalizeAccount);
  const accountIds = new Set();
  for (const account of accounts) {
    if (accountIds.has(account.accountId)) fail('Código de conta duplicado: ' + account.accountId + '.');
    accountIds.add(account.accountId);
  }
  for (const account of accounts) {
    if (account.groupingCode && !accountIds.has(account.groupingCode)) {
      fail('A conta agregadora ' + account.groupingCode + ' da conta ' + account.accountId + ' não foi exportada.');
    }
  }
  const entries = (Array.isArray(input.entries) ? input.entries : [])
    .filter(entry => !entry.status || entry.status === 'posted')
    .slice().sort((a, b) => String(a.transactionDate || a.entryDate || a.entry_date).localeCompare(String(b.transactionDate || b.entryDate || b.entry_date)));
  const journals = new Map();
  let totalDebit = 0n;
  let totalCredit = 0n;
  const fiscalStartMonth = Number(period.fiscalYearStartMonth || 1);
  if (!Number.isInteger(fiscalStartMonth) || fiscalStartMonth < 1 || fiscalStartMonth > 12) fail('Mês de início do exercício inválido.');
  for (const entry of entries) {
    const transactionDate = dateOnly(entry.transactionDate || entry.entryDate || entry.entry_date, 'Data do movimento');
    if (transactionDate < startDate || transactionDate > endDate) fail('O movimento ' + (entry.transactionId || entry.entryNumber) + ' está fora do período seleccionado.');
    const journalId = requiredString(entry.journalId || entry.journalCode || entry.sourceType || 'GERAL', 'Identificador do diário', 30);
    const journalDescription = requiredString(entry.journalDescription || 'Diário geral', 'Descrição do diário', 100);
    const sourceId = requiredString(entry.sourceId || entry.sourceUserId, 'Código do utilizador', 30);
    const description = requiredString(entry.description, 'Descrição do movimento', 255);
    const archiveNumber = requiredString(entry.docArchivalNumber || entry.entryNumber || entry.entry_number, 'Número de arquivo do documento', 20);
    if (/\\s/.test(archiveNumber)) fail('O número de arquivo do documento não pode conter espaços.');
    const transactionId = requiredString(entry.transactionId || (transactionDate + ' ' + sourceId + ' ' + archiveNumber), 'Identificador do movimento', 70);
    if (!/^[1-9][0-9]{3}-[01][0-9]-[0-3][0-9] [^ ]{1,30} [^ ]{1,20}$/.test(transactionId)) {
      fail('O identificador do movimento deve seguir AAAA-MM-DD utilizador referência, conforme o XSD SAF-T AO.');
    }
    const transactionType = requiredString(entry.transactionType || 'N', 'Tipo do movimento', 1);
    if (!TRANSACTION_TYPES.has(transactionType)) fail('Tipo de movimento inválido no lançamento ' + transactionId + '.');
    const postingDate = dateOnly(entry.glPostingDate || transactionDate, 'Data do movimento contabilístico');
    const systemEntryDate = dateTime(entry.systemEntryDate, 'Data/hora de gravação do lançamento ' + transactionId);
    const lines = Array.isArray(entry.lines) ? entry.lines : [];
    if (lines.length < 2) fail('O lançamento ' + transactionId + ' deve ter pelo menos duas linhas.');
    const debitLines = [];
    const creditLines = [];
    let entryDebit = 0n;
    let entryCredit = 0n;
    for (const line of lines) {
      const debitValue = line.debitAmount === undefined ? (line.debit || '0') : line.debitAmount;
      const creditValue = line.creditAmount === undefined ? (line.credit || '0') : line.creditAmount;
      const debit = cents(debitValue, 'Débito');
      const credit = cents(creditValue, 'Crédito');
      if (debit > 0n && credit > 0n) fail('Uma linha do lançamento ' + transactionId + ' não pode ter débito e crédito simultaneamente.');
      if (debit === 0n && credit === 0n) fail('Uma linha do lançamento ' + transactionId + ' não pode ter valor zero.');
      entryDebit += debit;
      entryCredit += credit;
      if (debit > 0n) debitLines.push(line);
      if (credit > 0n) creditLines.push(line);
    }
    if (!debitLines.length || !creditLines.length) fail('O lançamento ' + transactionId + ' deve ter pelo menos um débito e um crédito.');
    if (entryDebit !== entryCredit) fail('O lançamento ' + transactionId + ' não está equilibrado: débito diferente de crédito.');
    totalDebit += entryDebit;
    totalCredit += entryCredit;
    const month = Number(transactionDate.slice(5, 7));
    const accountingPeriod = ((month - fiscalStartMonth + 12) % 12) + 1;
    const customerId = optionalString(entry.customerId, 30);
    const supplierId = optionalString(entry.supplierId, 30);
    if (customerId && supplierId) fail('O lançamento ' + transactionId + ' não pode indicar cliente e fornecedor simultaneamente.');
    const parts = [
      tag('TransactionID', transactionId), tag('Period', accountingPeriod),
      tag('TransactionDate', transactionDate), tag('SourceID', sourceId),
      tag('Description', description), tag('DocArchivalNumber', archiveNumber),
      tag('TransactionType', transactionType), tag('GLPostingDate', postingDate)
    ];
    if (customerId) parts.push(tag('CustomerID', customerId));
    else if (supplierId) parts.push(tag('SupplierID', supplierId));
    const lineParts = [];
    debitLines.forEach((line, index) => lineParts.push(lineXml(line, { transactionId, description, systemEntryDate }, index, 'debit', accountIds)));
    creditLines.forEach((line, index) => lineParts.push(lineXml(line, { transactionId, description, systemEntryDate }, index, 'credit', accountIds)));
    parts.push('<Lines>' + lineParts.join('') + '</Lines>');
    if (!journals.has(journalId)) journals.set(journalId, { description: journalDescription, transactions: [] });
    journals.get(journalId).transactions.push('<Transaction>' + parts.join('') + '</Transaction>');
  }
  const accountXml = accounts.map(account => {
    const parts = [
      tag('AccountID', account.accountId), tag('AccountDescription', account.description),
      tag('OpeningDebitBalance', account.openingDebitBalance), tag('OpeningCreditBalance', account.openingCreditBalance),
      tag('ClosingDebitBalance', account.closingDebitBalance), tag('ClosingCreditBalance', account.closingCreditBalance),
      tag('GroupingCategory', account.groupingCategory)
    ];
    if (account.groupingCode) parts.push(tag('GroupingCode', account.groupingCode));
    return '<Account>' + parts.join('') + '</Account>';
  }).join('');
  const journalXml = Array.from(journals.entries()).map(([id, journal]) =>
    '<Journal>' + tag('JournalID', id) + tag('Description', journal.description) +
    journal.transactions.join('') + '</Journal>'
  ).join('');
  const header = [
    tag('AuditFileVersion', '1.01_01'), tag('CompanyID', companyId),
    tag('TaxRegistrationNumber', nif), tag('TaxAccountingBasis', 'C'),
    tag('CompanyName', companyName),
    company.businessName ? tag('BusinessName', requiredString(company.businessName, 'Nome comercial', 60)) : '',
    addressXml(company.address), tag('FiscalYear', fiscalYear),
    tag('StartDate', startDate), tag('EndDate', endDate), tag('CurrencyCode', 'AOA'),
    tag('DateCreated', createdDate), tag('TaxEntity', 'Sede'),
    tag('ProductCompanyTaxID', producerNif), tag('SoftwareValidationNumber', validationNumber),
    tag('ProductID', productId), tag('ProductVersion', productVersion),
    input.headerComment ? tag('HeaderComment', requiredString(input.headerComment, 'Comentário do cabeçalho', 255)) : '',
    company.telephone ? tag('Telephone', requiredString(company.telephone, 'Telefone', 20)) : '',
    company.email ? tag('Email', requiredString(company.email, 'Email', 255)) : '',
    company.website ? tag('Website', requiredString(company.website, 'Website', 60)) : ''
  ].join('');
  const ledger = tag('NumberOfEntries', entries.length) +
    tag('TotalDebit', formatCents(totalDebit)) + tag('TotalCredit', formatCents(totalCredit)) + journalXml;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<AuditFile xmlns="' + NAMESPACE + '"><Header>' + header +
    '</Header><MasterFiles><GeneralLedgerAccounts>' + accountXml +
    '</GeneralLedgerAccounts></MasterFiles><GeneralLedgerEntries>' + ledger + '</GeneralLedgerEntries></AuditFile>\n';
}
function validateXmlAgainstXsd(xmlContent, schemaPath) {
  const schema = path.resolve(schemaPath);
  if (!fs.existsSync(schema)) fail('Esquema XSD não encontrado: ' + schema);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanawa-saft-'));
  const xmlPath = path.join(tempDir, 'audit-file.xml');
  try {
    fs.writeFileSync(xmlPath, xmlContent, 'utf8');
    const result = spawnSync('xmllint', ['--noout', '--schema', schema, xmlPath], { encoding: 'utf8' });
    if (result.error && result.error.code === 'ENOENT') {
      return { valid: false, available: false, errors: ['xmllint não está instalado. Instale libxml2-utils para validar o XML contra o XSD.'] };
    }
    if (result.status !== 0) return { valid: false, available: true, errors: [result.stderr || result.stdout || 'Falha de validação XSD.'] };
    return { valid: true, available: true, errors: [] };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}
module.exports = { generateAccountingSaftXml, validateXmlAgainstXsd, NAMESPACE };
