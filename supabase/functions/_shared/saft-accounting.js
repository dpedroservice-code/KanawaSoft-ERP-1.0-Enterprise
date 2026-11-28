'use strict';
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
  const id = requiredString(account.accountId || account.account_code, 'Código da conta', 20);
  const category = requiredString(account.groupingCategory, 'Categoria da conta ' + id, 2);
  if (!GROUPING_CATEGORIES.has(category)) fail('Categoria inválida na conta ' + id + ': ' + category + '.');
  if (!/^[0-9a-zA-Z\-\/._+*]{1,20}$/.test(id) || /\s/.test(id)) fail('Código de conta inválido para o XSD: ' + id + '.');
  return {
    accountId: id,
    description: requiredString(account.description || account.name, 'Descrição da conta ' + id, 100),
    openingDebitBalance: money(account.openingDebitBalance, 'Saldo inicial a débito da conta ' + id),
    openingCreditBalance: money(account.openingCreditBalance, 'Saldo inicial a crédito da conta ' + id),
    closingDebitBalance: money(account.closingDebitBalance, 'Saldo final a débito da conta ' + id),
    closingCreditBalance: money(account.closingCreditBalance, 'Saldo final a crédito da conta ' + id),
    groupingCategory: category,
    groupingCode: optionalString(account.groupingCode, 20)
  };
}
function lineXml(line, entry, index, side, accountIds) {
  const accountId = requiredString(line.accountId || line.account_id, 'Conta da linha', 20);
  if (!accountIds.has(accountId)) fail('A conta ' + accountId + ' do movimento ' + entry.transactionId + ' não existe no plano de contas.');
  const amount = money(side === 'debit' ? (line.debitAmount === undefined ? line.debit : line.debitAmount) : (line.creditAmount === undefined ? line.credit : line.creditAmount), 'Montante ' + side);
  if (cents(amount, 'Montante') <= 0n) fail('A linha ' + (index + 1) + ' deve ter montante positivo.');
  const recordId = requiredString(line.recordId || String(index + 1), 'Identificador da linha', 35);
  const systemEntryDate = dateTime(line.systemEntryDate || entry.systemEntryDate, 'Data/hora de gravação da linha');
  const description = requiredString(line.description || entry.description, 'Descrição da linha', 200);
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
  if (!/^\d{10,15}$/.test(nif)) fail('O NIF da empresa deve conter 10 a 15 algarismos.');
  const companyId = requiredString(company.companyId || company.commercialRegistryId || nif, 'Identificação comercial da empresa', 50);
  const companyName = requiredString(company.companyName || company.legalName, 'Denominação social', 200);
  const producerNif = requiredString(software.productCompanyTaxId, 'NIF da entidade produtora do software', 20);
  if (!/^\d{10,15}$/.test(producerNif)) fail('O NIF da entidade produtora deve conter 10 a 15 algarismos.');
  const validationNumber = requiredString(software.softwareValidationNumber || '0', 'Número de validação do software', 70);
  if (validationNumber !== '0' && !/^\d+\/AGT\/\d{4}$/.test(validationNumber)) {
    fail('O número de validação deve seguir NNN/AGT/AAAA ou ser 0 quando não aplicável.');
  }
  const productId = requiredString(software.productId, 'Nome do software', 200);
  const productVersion = requiredString(software.productVersion, 'Versão do software', 20);
  if (!/^[^/]+\/[^/]+$/.test(productId)) fail('O ProductID deve seguir Nome do software/Nome da entidade produtora.');
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
  const transactionIds = new Set();
  let totalDebit = 0n;
  let totalCredit = 0n;
  const fiscalStartMonth = Number(period.fiscalYearStartMonth || 1);
  if (!Number.isInteger(fiscalStartMonth) || fiscalStartMonth < 1 || fiscalStartMonth > 12) fail('Mês de início do exercício inválido.');
  for (const entry of entries) {
    const transactionDate = dateOnly(entry.transactionDate || entry.entryDate || entry.entry_date, 'Data do movimento');
    if (transactionDate < startDate || transactionDate > endDate) fail('O movimento ' + (entry.transactionId || entry.entryNumber) + ' está fora do período seleccionado.');
    const journalId = requiredString(entry.journalId || entry.journalCode || entry.sourceType || 'GERAL', 'Identificador do diário', 30);
    if (/\s/.test(journalId)) fail('O identificador do diário não pode conter espaços.');
    const journalDescription = requiredString(entry.journalDescription || 'Diário geral', 'Descrição do diário', 100);
    const sourceId = requiredString(entry.sourceId || entry.sourceUserId, 'Código do utilizador', 30);
    if (/\s/.test(sourceId)) fail('O código do utilizador não pode conter espaços.');
    const description = requiredString(entry.description, 'Descrição do movimento', 200);
    const archiveNumber = requiredString(entry.docArchivalNumber || entry.entryNumber || entry.entry_number, 'Número de arquivo do documento', 20);
    if (/\s/.test(archiveNumber)) fail('O número de arquivo do documento não pode conter espaços.');
    const expectedTransactionId = transactionDate + ' ' + sourceId + ' ' + archiveNumber;
    const transactionId = requiredString(entry.transactionId || expectedTransactionId, 'Identificador do movimento', 70);
    if (transactionId !== expectedTransactionId || !/^[1-9][0-9]{3}-[01][0-9]-[0-3][0-9] [^ ]{1,30} [^ ]{1,20}$/.test(transactionId)) {
      fail('O identificador do movimento deve seguir AAAA-MM-DD utilizador referência, conforme o XSD SAF-T AO.');
    }
    if (transactionIds.has(transactionId)) fail('Identificador de movimento duplicado: ' + transactionId + '.');
    transactionIds.add(transactionId);
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
      if (debit > 0n) debitLines.push({ line, index: lines.indexOf(line) });
      if (credit > 0n) creditLines.push({ line, index: lines.indexOf(line) });
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
    debitLines.forEach(item => lineParts.push(lineXml(item.line, { transactionId, description, systemEntryDate }, item.index, 'debit', accountIds)));
    creditLines.forEach(item => lineParts.push(lineXml(item.line, { transactionId, description, systemEntryDate }, item.index, 'credit', accountIds)));
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


function generateSalesInvoicesSaftXml(input) {
  if (!input || typeof input !== 'object') fail('Dados de exportação de vendas são obrigatórios.');
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
  if (!/^\d{10,15}$/.test(nif)) fail('O NIF da empresa deve conter 10 a 15 algarismos.');
  const companyId = requiredString(company.companyId || company.commercialRegistryId || nif, 'Identificação comercial da empresa', 50);
  const companyName = requiredString(company.companyName || company.legalName, 'Denominação social', 200);
  const producerNif = requiredString(software.productCompanyTaxId, 'NIF da entidade produtora do software', 20);
  if (!/^\d{10,15}$/.test(producerNif)) fail('O NIF da entidade produtora deve conter 10 a 15 algarismos.');
  const validationNumber = requiredString(software.softwareValidationNumber || '0', 'Número de validação do software', 70);
  if (validationNumber !== '0' && !/^\d+\/AGT\/\d{4}$/.test(validationNumber)) fail('Número de validação AGT inválido.');
  const productId = requiredString(software.productId, 'Nome do software', 255);
  const productVersion = requiredString(software.productVersion, 'Versão do software', 30);
  if (!/^[^/]+\/[^/]+$/.test(productId)) fail('O ProductID deve seguir Nome do software/Nome da entidade produtora.');

  const invoices = (Array.isArray(input.invoices) ? input.invoices : [])
    .filter(d => String(d.invoiceDate || d.issuedAt || '').slice(0, 10) >= startDate &&
      String(d.invoiceDate || d.issuedAt || '').slice(0, 10) <= endDate)
    .slice().sort((a, b) => String(a.invoiceDate || a.issuedAt).localeCompare(String(b.invoiceDate || b.issuedAt)) ||
      String(a.invoiceNo || a.documentNumber).localeCompare(String(b.invoiceNo || b.documentNumber)));
  const customers = Array.isArray(input.customers) ? input.customers : [];
  const products = Array.isArray(input.products) ? input.products : [];
  const customerMap = new Map();
  const productMap = new Map();
  for (const customer of customers) {
    const id = requiredString(customer.customerId || customer.id, 'CustomerID', 30);
    if (customerMap.has(id)) fail('CustomerID duplicado: ' + id + '.');
    customerMap.set(id, customer);
  }
  for (const product of products) {
    const code = requiredString(product.productCode || product.code || product.sku, 'ProductCode', 60);
    if (productMap.has(code)) fail('ProductCode duplicado: ' + code + '.');
    productMap.set(code, product);
  }

  const usedCustomers = new Set();
  const usedProducts = new Set();
  const taxEntries = new Map();
  let totalDebit = 0n;
  let totalCredit = 0n;
  const invoiceXml = invoices.map((invoice, invoiceIndex) => {
    const invoiceNo = requiredString(invoice.invoiceNo || invoice.documentNumber, 'Número do documento', 60);
    const status = requiredString(invoice.invoiceStatus || invoice.status || 'N', 'Estado do documento', 1);
    if (!['N', 'S', 'A', 'R'].includes(status)) fail('InvoiceStatus inválido no documento ' + invoiceNo + '.');
    const invoiceType = requiredString(invoice.invoiceType || invoice.documentType, 'Tipo do documento', 2);
    const validTypes = ['FT','FR','GF','FG','AC','AR','ND','NC','AF','TV','RP','RE','CS','LD','RA'];
    if (!validTypes.includes(invoiceType)) fail('InvoiceType inválido no documento ' + invoiceNo + '.');
    const invoiceDate = dateOnly(invoice.invoiceDate || invoice.issuedAt, 'Data do documento ' + invoiceNo);
    const systemEntryDate = dateTime(invoice.systemEntryDate || invoice.createdAt, 'Data de registo ' + invoiceNo);
    const statusDate = dateTime(invoice.invoiceStatusDate || invoice.statusDate || systemEntryDate, 'Data do estado ' + invoiceNo);
    const sourceId = requiredString(invoice.sourceId || invoice.createdByCode || 'SISTEMA', 'Código do utilizador', 30);
    const reason = optionalString(invoice.reason, 50);
    if (status === 'A' && !reason) fail('O documento anulado ' + invoiceNo + ' exige motivo em Reason.');
    const suppliedHash = optionalString(invoice.hash4 || invoice.hash || '0', 172);
    if (suppliedHash !== '0' && !/^[A-Za-z0-9]{4}$/.test(suppliedHash)) fail('Hash do documento ' + invoiceNo + ' deve conter os 4 caracteres impressos ou 0.');
    const hash = validationNumber === '0' ? '0' : suppliedHash;
    const suppliedHashControl = requiredString(invoice.hashControl || '0', 'HashControl do documento ' + invoiceNo, 70);
    const hashControl = validationNumber === '0' ? '0' : suppliedHashControl;
    const sourceBilling = invoice.sourceBilling || 'P';
    if (!['P', 'I', 'M'].includes(sourceBilling)) fail('SourceBilling inválido no documento ' + invoiceNo + '.');
    const customerId = requiredString(invoice.customerId || invoice.customer_id || 'ConsumidorFinal', 'CustomerID do documento ' + invoiceNo, 30);
    const customer = customerMap.get(customerId);
    if (!customer) fail('O cliente ' + customerId + ' do documento ' + invoiceNo + ' não consta em MasterFiles.');
    usedCustomers.add(customerId);
    const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
    if (!lines.length) fail('O documento ' + invoiceNo + ' não tem linhas.');
    const lineXml = lines.map((line, lineIndex) => {
      const productCode = requiredString(line.productCode || line.product_code || line.sku, 'ProductCode da linha', 60);
      const product = productMap.get(productCode);
      if (!product) fail('O produto ' + productCode + ' da fatura ' + invoiceNo + ' não consta em MasterFiles.');
      usedProducts.add(productCode);
      const productType = requiredString(product.productType || line.productType || 'P', 'ProductType ' + productCode, 1);
      if (!['P','S','O','E','I'].includes(productType)) fail('ProductType inválido: ' + productType + '.');
      const description = requiredString(line.description || line.productDescription || product.productDescription || product.name, 'Descrição da linha', 200);
      const quantity = String(line.quantity === undefined ? '1' : line.quantity);
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(quantity) || Number(quantity) <= 0) fail('Quantidade inválida na linha ' + (lineIndex + 1) + ' do documento ' + invoiceNo + '.');
      const unit = requiredString(line.unitOfMeasure || line.unit || product.unit || 'UN', 'Unidade de medida', 20);
      const unitPrice = money(line.unitPrice === undefined ? line.unit_price : line.unitPrice, 'Preço unitário');
      const explicitDebit = line.debitAmount !== undefined;
      const explicitCredit = line.creditAmount !== undefined;
      if (explicitDebit && explicitCredit) fail('A linha não pode ter DebitAmount e CreditAmount simultaneamente.');
      const amount = money(explicitDebit ? line.debitAmount : explicitCredit ? line.creditAmount : (line.amount === undefined ? line.netAmount : line.amount), 'Montante líquido da linha');
      const taxType = requiredString((line.tax || {}).taxType || line.taxType || 'IVA', 'TaxType da linha', 3);
      if (!['IVA','IS','NS'].includes(taxType)) fail('TaxType inválido na linha do documento ' + invoiceNo + '.');
      const tax = line.tax || {};
      const taxCode = requiredString(tax.taxCode || line.taxCode || (Number(tax.taxPercentage || line.taxPercentage || 0) === 0 ? 'ISE' : 'NOR'), 'TaxCode da linha', 10);
      if (!/^(RED|INT|NOR|ISE|OUT|[0-9.]+|NS|NA)$/.test(taxCode)) fail('TaxCode inválido na linha do documento ' + invoiceNo + '.');
      const taxPercentage = String(tax.taxPercentage === undefined ? (line.taxPercentage === undefined ? '0' : line.taxPercentage) : tax.taxPercentage);
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(taxPercentage)) fail('TaxPercentage inválida na linha do documento ' + invoiceNo + '.');
      const exemptionCode = optionalString(line.taxExemptionCode || tax.taxExemptionCode, 12);
      const exemptionReason = optionalString(line.taxExemptionReason || tax.taxExemptionReason, 60);
      if (taxType === 'IVA' && Number(taxPercentage) === 0) {
        if (!/^M\d{2}$/.test(exemptionCode)) fail('IVA a 0% exige TaxExemptionCode M00–M99 na linha ' + (lineIndex + 1) + '.');
        if (exemptionReason.length < 6) fail('IVA a 0% exige TaxExemptionReason com pelo menos 6 caracteres.');
      }
      const country = optionalString(tax.taxCountryRegion || line.taxCountryRegion || 'AO', 6);
      const taxKey = [taxType, country, taxCode, taxPercentage].join('|');
      if (!taxEntries.has(taxKey)) taxEntries.set(taxKey, { taxType, country, taxCode, taxPercentage, description: optionalString(tax.description || line.taxDescription || taxCode, 255) });
      const refs = Array.isArray(line.references) ? line.references : (line.reference ? [{ reference: line.reference, reason: line.referenceReason }] : []);
      if (invoiceType === 'NC' && !refs.length) fail('A Nota de Crédito ' + invoiceNo + ' exige References em pelo menos uma linha.');
      const refsXml = refs.map(ref => {
        const reference = requiredString(ref.reference || ref.invoiceNo, 'Referência do documento original', 60);
        const referenceReason = requiredString(ref.reason, 'Motivo da referência', 50);
        return '<References>' + tag('Reference', reference) + tag('Reason', referenceReason) + '</References>';
      }).join('');
      const amountTag = explicitDebit ? 'DebitAmount' : explicitCredit ? 'CreditAmount' : (invoiceType === 'NC' ? 'DebitAmount' : 'CreditAmount');
      if (status === 'N') {
        if (amountTag === 'DebitAmount') totalDebit += cents(amount, 'Montante');
        else totalCredit += cents(amount, 'Montante');
      }
      const lineParts = [
        tag('LineNumber', line.lineNumber === undefined ? lineIndex + 1 : line.lineNumber),
        tag('ProductCode', productCode), tag('ProductDescription', requiredString(product.productDescription || product.name || description, 'Descrição do produto', 200)),
        tag('Quantity', quantity), tag('UnitOfMeasure', unit), tag('UnitPrice', unitPrice),
        line.taxBase !== undefined ? tag('TaxBase', money(line.taxBase, 'Base tributável')) : '',
        tag('TaxPointDate', dateOnly(line.taxPointDate || invoiceDate, 'Data de incidência')),
        refsXml, tag('Description', description), tag(amountTag, amount),
        '<Tax>' + tag('TaxType', taxType) + (country ? tag('TaxCountryRegion', country) : '') +
          tag('TaxCode', taxCode) + tag('TaxPercentage', taxPercentage) + '</Tax>',
        exemptionCode ? tag('TaxExemptionReason', requiredString(exemptionReason, 'Motivo de isenção', 60)) + tag('TaxExemptionCode', exemptionCode) : ''
      ];
      return '<Line>' + lineParts.join('') + '</Line>';
    }).join('');
    const special = invoice.specialRegimes || {};
    const statusXml = '<DocumentStatus>' + tag('InvoiceStatus', status) + tag('InvoiceStatusDate', statusDate) +
      (reason ? tag('Reason', reason) : '') + tag('SourceID', sourceId) +
      tag('SourceBilling', sourceBilling) + '</DocumentStatus>';
    const regimeXml = '<SpecialRegimes>' + tag('SelfBillingIndicator', special.selfBillingIndicator === undefined ? 0 : special.selfBillingIndicator) +
      tag('CashVATSchemeIndicator', special.cashVATSchemeIndicator === undefined ? 0 : special.cashVATSchemeIndicator) +
      tag('ThirdPartiesBillingIndicator', special.thirdPartiesBillingIndicator === undefined ? 0 : special.thirdPartiesBillingIndicator) + '</SpecialRegimes>';
    const netTotal = money(invoice.netTotal === undefined ? invoice.taxableBase : invoice.netTotal, 'NetTotal ' + invoiceNo);
    const taxPayable = money(invoice.taxPayable === undefined ? invoice.taxAmount : invoice.taxPayable, 'TaxPayable ' + invoiceNo);
    const grossTotal = money(invoice.grossTotal === undefined ? invoice.total : invoice.grossTotal, 'GrossTotal ' + invoiceNo);
    if (cents(netTotal, 'NetTotal') + cents(taxPayable, 'TaxPayable') !== cents(grossTotal, 'GrossTotal')) {
      fail('NetTotal + TaxPayable não corresponde a GrossTotal no documento ' + invoiceNo + '.');
    }
    const month = Number(invoiceDate.slice(5, 7));
    return '<Invoice>' + tag('InvoiceNo', invoiceNo) + statusXml + tag('Hash', hash) +
      tag('HashControl', hashControl) + tag('Period', month) + tag('InvoiceDate', invoiceDate) +
      tag('InvoiceType', invoiceType) + regimeXml + tag('SourceID', sourceId) +
      tag('SystemEntryDate', systemEntryDate) + (invoice.transactionId ? tag('TransactionID', requiredString(invoice.transactionId, 'TransactionID', 70)) : '') +
      tag('CustomerID', customerId) + lineXml +
      '<DocumentTotals>' + tag('TaxPayable', taxPayable) + tag('NetTotal', netTotal) + tag('GrossTotal', grossTotal) + '</DocumentTotals></Invoice>';
  }).join('');

  const usedCustomerXml = Array.from(usedCustomers).map(id => {
    const customer = customerMap.get(id);
    const address = customer.address || customer.billingAddress || {};
    const addressParts = [
      address.buildingNumber ? tag('BuildingNumber', address.buildingNumber) : '',
      address.streetName ? tag('StreetName', address.streetName) : '',
      tag('AddressDetail', requiredString(address.addressDetail || address.detail || address.street, 'Endereço do cliente', 250)),
      tag('City', requiredString(address.city, 'Cidade do cliente', 50)),
      address.postalCode ? tag('PostalCode', address.postalCode) : '',
      address.province ? tag('Province', address.province) : '',
      tag('Country', 'AO')
    ].join('');
    const isFinalConsumer = customer.isFinalConsumer === true || customer.customerId === 'ConsumidorFinal' || customer.id === 'ConsumidorFinal';
    const taxId = requiredString(customer.customerTaxId || customer.taxId || (isFinalConsumer ? '999999999' : ''), 'NIF do cliente', 30);
    return '<Customer>' + tag('CustomerID', id) + tag('AccountID', customer.accountId || 'Desconhecido') +
      tag('CustomerTaxID', taxId) + tag('CompanyName', requiredString(customer.companyName || customer.name || 'Consumidor final', 'Nome do cliente', 100)) +
      '<BillingAddress>' + addressParts + '</BillingAddress>' + tag('SelfBillingIndicator', customer.selfBillingIndicator || 0) + '</Customer>';
  }).join('');
  const usedProductXml = Array.from(usedProducts).map(code => {
    const product = productMap.get(code);
    return '<Product>' + tag('ProductType', product.productType || 'P') + tag('ProductCode', code) +
      (product.productGroup ? tag('ProductGroup', requiredString(product.productGroup, 'Grupo do produto', 50)) : '') +
      tag('ProductDescription', requiredString(product.productDescription || product.name, 'Descrição do produto', 200)) +
      tag('ProductNumberCode', product.productNumberCode || product.ean || code) + '</Product>';
  }).join('');
  const taxTable = Array.from(taxEntries.values()).map(tax =>
    '<TaxTableEntry>' + tag('TaxType', tax.taxType) + tag('TaxCountryRegion', tax.country) +
    tag('TaxCode', tax.taxCode) + tag('Description', tax.description) + tag('TaxPercentage', tax.taxPercentage) + '</TaxTableEntry>'
  ).join('');
  const address = company.address || {};
  const header = [
    tag('AuditFileVersion', '1.01_01'), tag('CompanyID', companyId), tag('TaxRegistrationNumber', nif),
    tag('TaxAccountingBasis', 'F'), tag('CompanyName', companyName),
    company.businessName ? tag('BusinessName', requiredString(company.businessName, 'Nome comercial', 60)) : '',
    addressXml(address), tag('FiscalYear', fiscalYear), tag('StartDate', startDate), tag('EndDate', endDate),
    tag('CurrencyCode', 'AOA'), tag('DateCreated', createdDate), tag('TaxEntity', input.taxEntity || 'Global'),
    tag('ProductCompanyTaxID', producerNif), tag('SoftwareValidationNumber', validationNumber),
    tag('ProductID', productId), tag('ProductVersion', productVersion),
    company.telephone ? tag('Telephone', company.telephone) : '',
    company.email ? tag('Email', company.email) : '', company.website ? tag('Website', company.website) : ''
  ].join('');
  const sales = tag('NumberOfEntries', invoices.length) + tag('TotalDebit', formatCents(totalDebit)) +
    tag('TotalCredit', formatCents(totalCredit)) + invoiceXml;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<AuditFile xmlns="' + NAMESPACE + '"><Header>' + header +
    '</Header><MasterFiles>' + usedCustomerXml + usedProductXml +
    (taxTable ? '<TaxTable>' + taxTable + '</TaxTable>' : '') +
    '</MasterFiles><SourceDocuments><SalesInvoices>' + sales +
    '</SalesInvoices></SourceDocuments></AuditFile>\n';
}

const api = { generateAccountingSaftXml, generateSalesInvoicesSaftXml, NAMESPACE };
if (typeof globalThis !== 'undefined') globalThis.KanawaSaft = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
