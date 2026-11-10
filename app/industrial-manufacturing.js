/* Kanawa Soft ERP — base industrial segura: BOM, MRP, ordens e qualidade.
 * Não altera stock, facturas, Supabase ou _sync_queue automaticamente.
 * Escrita passa pelo saveData existente; cálculo MRP é apenas planeamento.
 */
'use strict';
(function(){
  const states = ['agendada','em_preparacao','em_execucao','controle_qualidade','finalizada','cancelada'];
  const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const escText = v => typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  async function list(name){ const rows=await getData(name); return Array.isArray(rows)?rows:[]; }
  function validBom(row){
    return row && row.produto_pai_id && row.componente_id &&
      String(row.produto_pai_id)!==String(row.componente_id) &&
      number(row.quantidade_necessaria)>0 && number(row.percentual_perda)>=0 &&
      number(row.percentual_perda)<=100;
  }
  async function saveBom(row){
    if(!validBom(row)) throw new Error('Ficha técnica inválida: escolha produtos diferentes, quantidade positiva e perda entre 0 e 100%.');
    const products=await list('produtos');
    if(!products.some(p=>String(p.id)===String(row.produto_pai_id)) ||
       !products.some(p=>String(p.id)===String(row.componente_id))) throw new Error('Produto acabado ou componente não encontrado.');
    const all=await list('boms');
    const duplicate=all.some(x=>String(x.produto_pai_id)===String(row.produto_pai_id)&&String(x.componente_id)===String(row.componente_id)&&String(x.id)!==String(row.id));
    if(duplicate) throw new Error('Este componente já existe na ficha técnica. Edite a linha existente.');
    return saveData('boms',{...row,quantidade_necessaria:number(row.quantidade_necessaria),percentual_perda:number(row.percentual_perda),updated_at:new Date().toISOString()});
  }
  async function calculateMrp(productId, quantity){
    const qty=number(quantity);
    if(!productId || qty<=0) throw new Error('Indique o produto e uma quantidade superior a zero.');
    const [boms,products,stock]=await Promise.all([list('boms'),list('produtos'),list('estoque')]);
    const recipe=boms.filter(b=>String(b.produto_pai_id)===String(productId));
    if(!recipe.length) throw new Error('O produto ainda não tem ficha técnica (BOM).');
    return recipe.map(b=>{
      const component=products.find(p=>String(p.id)===String(b.componente_id))||{};
      const stockRows=stock.filter(s=>String(s.produto_id||s.product_id)===String(b.componente_id));
      const available=stockRows.reduce((n,s)=>n+number(s.quantidade_atual??s.quantidade??s.stock),0);
      const required=qty*number(b.quantidade_necessaria)*(1+number(b.percentual_perda)/100);
      return {componente_id:b.componente_id,nome:component.nome||component.name||'Componente',unidade:component.unidade||component.sigla_unidade||'',quantidade_necessaria:required,stock_disponivel:available,falta:Math.max(0,required-available),suficiente:available>=required,etapa_producao:b.etapa_producao||''};
    });
  }
  async function createProductionOrder(data){
    const qty=number(data.quantidade_programada);
    if(!data.produto_id||qty<=0) throw new Error('Produto e quantidade programada são obrigatórios.');
    if(!states.includes(data.status_op||'agendada')) throw new Error('Estado da ordem de produção inválido.');
    const products=await list('produtos');
    if(!products.some(p=>String(p.id)===String(data.produto_id))) throw new Error('Produto não encontrado.');
    const orders=await list('ordensProducao');
    const year=new Date().getFullYear();
    const seq=orders.filter(o=>String(o.codigo_op||'').startsWith('OP-'+year+'-')).length+1;
    return saveData('ordensProducao',{...data,codigo_op:data.codigo_op||('OP-'+year+'-'+String(seq).padStart(4,'0')),quantidade_programada:qty,quantidade_produzida_real:0,status_op:data.status_op||'agendada',created_at:new Date().toISOString()});
  }
  async function saveQualityInspection(data){
    const inspected=number(data.quantidade_inspecionada),approved=number(data.quantidade_aprovada);
    if(!data.ordem_producao_id||inspected<=0||approved<0||approved>inspected) throw new Error('Inspecção inválida: aprovadas não podem exceder as inspeccionadas.');
    const orders=await list('ordensProducao');
    if(!orders.some(o=>String(o.id)===String(data.ordem_producao_id))) throw new Error('Ordem de produção não encontrada.');
    return saveData('controleQualidade',{...data,quantidade_inspecionada:inspected,quantidade_aprovada:approved,quantidade_rejeitada:inspected-approved,data_inspecao:new Date().toISOString()});
  }
  window.KanawaIndustrial = Object.freeze({states,validBom,saveBom,calculateMrp,createProductionOrder,saveQualityInspection});
})();
