'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateXmlAgainstXsd } = require('../../server/agt/saft-accounting');

const xmlPath = process.argv[2];
const schemaPath = process.argv[3] || path.join(__dirname, '../../schemas/agt/SAFTAO1.01_01.xsd');
if (!xmlPath) {
  console.error('Uso: node scripts/agt/validate-saft.js <ficheiro.xml> [caminho-do-xsd]');
  process.exit(2);
}
if (!fs.existsSync(xmlPath)) {
  console.error('Ficheiro XML não encontrado: ' + xmlPath);
  process.exit(2);
}
const result = validateXmlAgainstXsd(fs.readFileSync(xmlPath, 'utf8'), schemaPath);
if (!result.available) {
  console.error(result.errors.join('\n'));
  process.exit(2);
}
if (!result.valid) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}
console.log('SAF-T (AO) XML válido contra o XSD 1.01_01.');
