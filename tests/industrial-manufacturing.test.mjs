import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync('app/industrial-manufacturing.js','utf8');
const html=fs.readFileSync('app/index.html','utf8');
test('módulo industrial é válido e carregado depois do núcleo ERP',()=>{
  assert.doesNotThrow(()=>new vm.Script(src));
  assert.ok(html.includes('src="industrial-manufacturing.js'));
  assert.ok(html.indexOf('src="app.js')<html.indexOf('src="industrial-manufacturing.js'));
});
test('BOM valida produtos distintos, quantidades e perdas',()=>{
  const sandbox={window:{podeAcessar:()=>true,podeFazer:()=>true,planoPermiteModulo:()=>true},getData:async()=>[],saveData:async()=>true};
  vm.runInNewContext(src,sandbox);
  const api=sandbox.window.KanawaIndustrial;
  assert.equal(api.validBom({produto_pai_id:'a',componente_id:'b',quantidade_necessaria:2,percentual_perda:5}),true);
  assert.equal(api.validBom({produto_pai_id:'a',componente_id:'a',quantidade_necessaria:2}),false);
  assert.equal(api.validBom({produto_pai_id:'a',componente_id:'b',quantidade_necessaria:0}),false);
  assert.equal(api.validBom({produto_pai_id:'a',componente_id:'b',quantidade_necessaria:1,percentual_perda:101}),false);
});
test('planeamento MRP calcula necessidade incluindo perda sem movimentar stock',async()=>{
  const data={
    boms:[{produto_pai_id:'acabado',componente_id:'insumo',quantidade_necessaria:2,percentual_perda:5}],
    produtos:[{id:'acabado',nome:'Produto acabado'},{id:'insumo',nome:'Perfil'}],
    estoque:[{produto_id:'insumo',quantidade_atual:3}]
  };
  const sandbox={window:{podeAcessar:()=>true,podeFazer:()=>true,planoPermiteModulo:()=>true},getData:async n=>data[n]||[],saveData:async()=>{throw Error('não deve gravar');}};
  vm.runInNewContext(src,sandbox);
  const result=await sandbox.window.KanawaIndustrial.calculateMrp('acabado',2);
  assert.equal(result[0].quantidade_necessaria,4.2);
  assert.equal(result[0].falta,1.2000000000000002);
  assert.equal(result[0].suficiente,false);
});
test('ordens e inspecções validam estados e quantidades antes de gravar',()=>{
  assert.ok(src.includes('createProductionOrder'));
  assert.ok(src.includes('saveQualityInspection'));
  assert.ok(src.includes('approved>inspected'));
  assert.ok(src.includes('const states='));
});

test('compatibilidade com BOM legado por nomes sem duplicar componentes',async()=>{
  const data={produtos:[{id:'p1',nome:'Janela'},{id:'m1',nome:'Perfil'}],boms:[{id:1,produto:'Janela',material:'Perfil',quantidade:2,perdaPercentual:5}],estoque:[{produto_id:'m1',quantidade_atual:1}]};
  const sandbox={window:{podeAcessar:()=>true,podeFazer:()=>true,planoPermiteModulo:()=>true},getData:async n=>data[n]||[],saveData:async(n,row)=>{data[n].push(row);return row.id||2;}};
  vm.runInNewContext(src,sandbox);
  const api=sandbox.window.KanawaIndustrial;
  assert.equal(api.validBom({produto:'Janela',material:'Perfil',quantidade:2,perdaPercentual:5}),true);
  const result=await api.calculateMrp('p1',2);
  assert.equal(result[0].quantidade_necessaria,4.2);
  assert.equal(result[0].falta,3.2);
  await assert.rejects(()=>api.saveBom({produto:'Janela',material:'Perfil',quantidade:1}),/já está registado/);
});

test('MRP consulta colecções existentes apenas quando o perfil pode aceder aos módulos',()=>{
  const app=fs.readFileSync('app/app.js','utf8');
  for (const store of ['movimentacoesEstoque','compras','vendas','armazens','lotes','transferencias','funcionarios','turnos','pontoDigital','custosProducao']) {
    assert.ok(app.includes("getData('"+store+"')"),'colecção integrada: '+store);
  }
  assert.match(app,/podeConsultarModuloMRP\('estoque'\) \? getData\('movimentacoesEstoque'\)/);
  assert.match(app,/podeConsultarModuloMRP\('compras'\) \? getData\('compras'\)/);
  assert.match(app,/podeConsultarModuloMRP\('rh'\) \? getData\('funcionarios'\)/);
  assert.match(app,/podeConsultarModuloMRP\('rh-ponto'\) \? getData\('pontoDigital'\)/);
  assert.match(app,/podeConsultarModuloMRP\('custos-producao'\) \? getData\('custosProducao'\)/);
  assert.match(app,/Integração com módulos existentes/);
  const calculation=app.slice(app.indexOf('async function calcularMRP()'),app.indexOf('/* BOM — ficha técnica'));
  assert.ok(calculation.indexOf("podeFazer('criar','mrp')")<calculation.indexOf("getData('produtos')"),'a autorização de gravação deve preceder a leitura e o cálculo');
});

test('helper de acesso MRP exige permissão do módulo e plano activo',()=>{
  const app=fs.readFileSync('app/app.js','utf8');
  const helper=app.match(/function podeConsultarModuloMRP\(moduleId\) \{[\s\S]*?\n\}/);
  assert.ok(helper,'helper de autorização MRP deve existir');
  const allowed=new Set(['estoque','compras']);
  const plans=new Set(['estoque']);
  const sandbox={podeAcessar:id=>allowed.has(id),planoPermiteModulo:id=>plans.has(id)};
  vm.runInNewContext(helper[0],sandbox);
  assert.equal(sandbox.podeConsultarModuloMRP('estoque'),true);
  assert.equal(sandbox.podeConsultarModuloMRP('compras'),false);
  assert.equal(sandbox.podeConsultarModuloMRP('vendas'),false);
});

test('API BOM recusa gravação sem permissão do módulo',async()=>{
  const data={produtos:[{id:'p',nome:'Produto'},{id:'m',nome:'Material'}],boms:[]};
  const sandbox={window:{podeAcessar:id=>id!=='bom',podeFazer:()=>true,planoPermiteModulo:()=>true},getData:async n=>data[n]||[],saveData:async()=>{throw Error('não deve gravar');}};
  vm.runInNewContext(src,sandbox);
  await assert.rejects(()=>sandbox.window.KanawaIndustrial.saveBom({produto:'Produto',material:'Material',quantidade:1}),/Sem acesso ao módulo bom/);
});
