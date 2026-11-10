import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const appDir=path.join(process.cwd(),'app');
const source=fs.readFileSync(path.join(appDir,'module-reorganization.js'),'utf8');
const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(appDir,'module-reorganization.css'),'utf8');
test('JavaScript clássico é sintacticamente válido e carregado depois do app principal',()=>{assert.doesNotThrow(()=>new vm.Script(source));assert.ok(html.includes('src="module-reorganization.js'));assert.ok(html.indexOf('src="app.js')<html.indexOf('src="module-reorganization.js'));});
test('projectos guardam referência, cliente, prazos, orçamento, cobrança e equipa',()=>{for(const field of ['project_code','client_id','start_date','due_date','end_date','budget_total','estimated_cost','billing_type','manager_id','team_ids'])assert.ok(source.includes(field),'Campo ausente: '+field);for(const action of ['guardarTarefaProjeto','guardarDespesaProjeto','guardarHorasProjeto','guardarMembroProjeto'])assert.ok(source.includes(action),'Acção ausente: '+action);});
test('configurações organizam secções e contas bancárias múltiplas',()=>{for(const section of ['empresa','regras','aparencia','seguranca','dados','ferramentas'])assert.ok(source.includes(section));for(const fn of ['ksAddBankAccount','ksSetDefaultBank','ksRemoveBankAccount','ksReadBankAccounts'])assert.ok(source.includes(fn));assert.ok(source.includes('registoComercial'));assert.ok(source.includes('capitalSocial'));});
test('estilos herdam o tema e adaptam-se a ecrãs pequenos',()=>{assert.ok(css.includes('var(--bg-card)'));assert.ok(css.includes('var(--text-muted)'));assert.ok(css.includes('@media(max-width:600px)'));assert.ok(css.includes('prefers-reduced-motion'));});

test('configuração chama os renderizadores originais sem auto-recursão',()=>{
  const app=fs.readFileSync(path.join(appDir,'app.js'),'utf8');
  assert.match(app,/async function ksRenderConfigBase\s*\(/);
  assert.match(app,/async function ksSalvarConfigEmpresaBase\s*\(/);
  assert.match(source,/async function renderConfig\s*\(\)\s*\{[\s\S]*?await ksRenderConfigBase\(\)/);
  assert.match(source,/async function salvarConfigEmpresa\s*\(\)\s*\{[\s\S]*?await ksSalvarConfigEmpresaBase\(\)/);
  assert.doesNotMatch(source,/const ksBaseRenderConfig\s*=\s*renderConfig/);
  assert.doesNotMatch(source,/const ksBaseSaveCompanyConfig\s*=\s*salvarConfigEmpresa/);
  assert.doesNotMatch(source,/await ksBaseRenderConfig\(\)/);
});
