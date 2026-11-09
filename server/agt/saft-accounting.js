'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const shared = require('../../supabase/functions/_shared/saft-accounting.js');
function validateXmlAgainstXsd(xmlContent, schemaPath) {
  const schema = path.resolve(schemaPath);
  if (!fs.existsSync(schema)) {
    const error = new Error('Esquema XSD não encontrado: ' + schema);
    error.code = 'SAFT_VALIDATION_ERROR';
    throw error;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanawa-saft-'));
  const xmlPath = path.join(tempDir, 'audit-file.xml');
  try {
    fs.writeFileSync(xmlPath, xmlContent, 'utf8');
    const result = spawnSync('xmllint', ['--noout', '--schema', schema, xmlPath], { encoding: 'utf8' });
    if (result.error && result.error.code === 'ENOENT') return { valid: false, available: false, errors: ['xmllint não está instalado. Instale libxml2-utils para validar o XML contra o XSD.'] };
    if (result.status !== 0) return { valid: false, available: true, errors: [result.stderr || result.stdout || 'Falha de validação XSD.'] };
    return { valid: true, available: true, errors: [] };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}
module.exports = { ...shared, validateXmlAgainstXsd };
