import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('app/industrial-enterprise.js','utf8');
const app=fs.readFileSync('app/app.js','utf8');
const html=fs.readFileSync('app/index.html','utf8');

function runtime(seed={}){
  const data=structuredClone(seed),saved=[];
  const sandbox={window:{},getData:async key=>data[key]||[],saveData:async(key,row)=>{const value={...row,id:row.id??(data[key]||[]).length+1};(data[key]||=[]).push(value);saved.push({key,value});return value;}};
  vm.runInNewContext(source,sandbox);
  return {api:sandbox.window.KanawaIndustrialEnterprise,data,saved};
}

test('módulo industrial enterprise carrega depois do núcleo e dos serviços BOM',()=>{
  assert.doesNotThrow(()=>new vm.Script(source));
  assert.ok(html.includes('src="industrial-enterprise.js'));
  assert.ok(html.indexOf('src="app.js')<html.indexOf('src="industrial-enterprise.js'));
  assert.match(app,/version: 10/);
  for(const store of ['centrosTrabalho','roteirosProducao','operacoesProducao','paradasProducao','manutencaoEquipamentos','subprodutosProducao','rastreabilidadeProducao','execucoesProducao']) assert.ok(app.includes("'"+store+"'"));
  assert.match(app,/KanawaIndustrialEnterprise\.renderPanel/);
});

test('BOM multinível explode submontagens, agrega materiais e calcula falta',async()=>{
  const r=runtime({
    produtos:[{id:'p',nome:'Mesa'},{id:'s',nome:'Estrutura'},{id:'m',nome:'Perfil'}],
    boms:[{produto_pai_id:'p',componente_id:'s',quantidade:2},{produto_pai_id:'s',componente_id:'m',quantidade:3,perdaPercentual:0}],
    estoque:[{produto_id:'m',quantidade_atual:10}]
  });
  const result=await r.api.explodeBom('p',5);
  assert.equal(result.length,1);
  assert.equal(result[0].quantidade_necessaria,30);
  assert.equal(result[0].stock_disponivel,10);
  assert.equal(result[0].falta,20);
  assert.equal(result[0].suficiente,false);
});

test('BOM detecta ciclos e impede profundidade excessiva',async()=>{
  const r=runtime({produtos:[{id:'a',nome:'A'},{id:'b',nome:'B'}],boms:[{produto_pai_id:'a',componente_id:'b',quantidade:1},{produto_pai_id:'b',componente_id:'a',quantidade:1}]});
  await assert.rejects(()=>r.api.explodeBom('a',1),/Ciclo detectado/);
});

test('centros e roteiros exigem dados válidos e capacidade considera eficiência e turnos',async()=>{
  const r=runtime({produtos:[{id:'p',nome:'Produto'}],ordensProducao:[{id:7,produto_id:'p',produto:'Produto',quantidade_programada:20}],turnos:[{centro_trabalho_id:1,horas_dia:8}]});
  await assert.rejects(()=>r.api.saveWorkCenter({codigo:'C1',nome:'Corte',capacidade_horas_dia:0}),/superior a zero/);
  await r.api.saveWorkCenter({id:1,codigo:'C1',nome:'Corte',capacidade_horas_dia:8,eficiencia_percentual:100});
  await r.api.saveRouting({produto_id:'p',operacoes:[{nome:'Corte',centro_trabalho_id:1,tempo_minutos:30}]});
  const plan=await r.api.planCapacity(7);
  assert.equal(plan.operacoes[0].horas_necessarias,10);
  assert.equal(plan.operacoes[0].estado,'capacidade_insuficiente');
  assert.equal(plan.viavel,false);
});

test('custos industriais calculam materiais, mão de obra, indirectos e custo unitário',async()=>{
  const r=runtime();
  const cost=await r.api.calculateCost({custo_materiais:1000,horas_mao_obra:4,custo_hora:250,custos_indiretos:300,quantidade_produzida:10});
  assert.equal(cost.labor,1000);
  assert.equal(cost.total,2300);
  assert.equal(cost.unit_cost,230);
  await assert.rejects(()=>r.api.calculateCost({custo_materiais:-1,quantidade_produzida:1}),/não podem ser negativos/);
});

test('subprodutos, manutenção e rastreabilidade exigem ordem, produto e centro válidos',async()=>{
  const r=runtime({produtos:[{id:'p',nome:'Produto'},{id:'s',nome:'Subproduto'}],ordensProducao:[{id:2,codigo_op:'OP-2026-00001',produto_id:'p',produto:'Produto'}]});
  await r.api.saveWorkCenter({id:1,codigo:'C1',nome:'Linha 1',capacidade_horas_dia:8});
  const sub=await r.api.saveByproduct({ordem_producao_id:2,produto_id:'s',quantidade:3});
  assert.equal(sub.produto_id,'s');
  const trace=await r.api.saveTraceability({ordem_producao_id:2,lote_producao:'L-001',quantidade:10});
  assert.equal(trace.ordem_codigo,'OP-2026-00001');
  const maintenance=await r.api.saveMaintenance({centro_trabalho_id:1,descricao:'Revisão preventiva',data_prevista:'2026-11-15'});
  assert.equal(maintenance.estado,'planeada');
  await assert.rejects(()=>r.api.saveMaintenance({centro_trabalho_id:99,descricao:'Falha'}),/não encontrado/);
});
