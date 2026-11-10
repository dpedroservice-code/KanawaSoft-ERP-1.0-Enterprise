/* Kanawa Soft ERP — integração industrial compatível com o modelo actual.
 * Suporta BOM legado por nomes (produto/material) e esquema normalizado por IDs.
 * Não movimenta stock nem contorna saveData/KanawaCloud/_sync_queue.
 */
'use strict';
(function(){
  const states=['agendada','em_preparacao','em_execucao','controle_qualidade','finalizada','cancelada'];
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const key=v=>String(v??'').trim().toLocaleLowerCase('pt-AO').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  async function list(name){const rows=await getData(name);return Array.isArray(rows)?rows:[];}
  function parentOf(b){return b.produto_pai_id??b.produto_id??b.produto??b.produtoNome??b.produtoId;}
  function componentOf(b){return b.componente_id??b.insumo_produto_id??b.material_id??b.material??b.materialNome;}
  function qtyOf(b){return n(b.quantidade_necessaria??b.quantidade??b.qtd);}
  function lossOf(b){return n(b.percentual_perda??b.perdaPercentual??b.perda_percentual);}
  function productMatches(p,ref){return String(p.id)===String(ref)||key(p.nome??p.name??p.codigo??p.sku)===key(ref);}
  function validBom(row){
    const parent=parentOf(row||{}),component=componentOf(row||{}),qty=qtyOf(row||{}),loss=lossOf(row||{});
    return !!parent&&!!component&&key(parent)!==key(component)&&qty>0&&loss>=0&&loss<100;
  }
  async function saveBom(row){
    if(!validBom(row))throw new Error('Ficha técnica inválida: indique produto acabado, componente diferente, quantidade positiva e perda inferior a 100%.');
    const products=await list('produtos');
    const parent=products.find(p=>productMatches(p,parentOf(row)));
    const component=products.find(p=>productMatches(p,componentOf(row)));
    if(!parent||!component)throw new Error('O produto acabado e o componente devem existir no catálogo.');
    const all=await list('boms');
    const duplicate=all.some(x=>key(parentOf(x))===key(parentOf(row))&&key(componentOf(x))===key(componentOf(row))&&String(x.id)!==String(row.id));
    if(duplicate)throw new Error('Este componente já está registado na ficha técnica deste produto.');
    const record=Object.assign({},row,{
      produto:row.produto??parent.nome??parent.name,
      material:row.material??component.nome??component.name,
      quantidade:qtyOf(row),perdaPercentual:lossOf(row),
      produto_pai_id:row.produto_pai_id??parent.id,
      componente_id:row.componente_id??component.id,
      updated_at:new Date().toISOString()
    });
    return saveData('boms',record);
  }
  async function calculateMrp(productRef,quantity){
    const qty=n(quantity);if(!productRef||qty<=0)throw new Error('Indique o produto e uma quantidade superior a zero.');
    const [boms,products,stock]=await Promise.all([list('boms'),list('produtos'),list('estoque')]);
    const product=products.find(p=>productMatches(p,productRef));
    if(!product)throw new Error('Produto acabado não encontrado no catálogo.');
    const recipe=boms.filter(b=>productMatches(product,parentOf(b)));
    if(!recipe.length)throw new Error('O produto ainda não tem ficha técnica (BOM).');
    return recipe.map(b=>{
      const ref=componentOf(b),component=products.find(p=>productMatches(p,ref))||{};
      const stockRows=stock.filter(s=>String(s.produto_id??s.product_id)===String(component.id)||key(s.produto??s.nome_produto)===key(ref));
      const available=stockRows.length?stockRows.reduce((sum,s)=>sum+n(s.quantidade_atual??s.quantidade??s.stock),0):n(component.estoqueDisponivel??component.estoque??component.stock_quantity);
      const required=qty*qtyOf(b)*(1+lossOf(b)/100);
      return {componente_id:component.id??b.componente_id??null,material:component.nome??component.name??String(ref),quantidade_necessaria:required,stock_disponivel:available,falta:Math.max(0,required-available),suficiente:available>=required,etapa_producao:b.etapa_producao??b.etapa??''};
    });
  }
  async function createProductionOrder(data){
    const qty=n(data.quantidade_programada??data.quantidade);
    const productRef=data.produto_id??data.produto;
    if(!productRef||qty<=0)throw new Error('Produto e quantidade programada são obrigatórios.');
    const status=data.status_op??'agendada';if(!states.includes(status))throw new Error('Estado da ordem de produção inválido.');
    const products=await list('produtos'),product=products.find(p=>productMatches(p,productRef));
    if(!product)throw new Error('Produto não encontrado no catálogo.');
    const orders=await list('ordensProducao'),year=new Date().getFullYear();
    const used=new Set(orders.map(o=>String(o.codigo_op||'')));
    let seq=orders.filter(o=>String(o.codigo_op||'').startsWith('OP-'+year+'-')).length+1;
    let code=data.codigo_op||'OP-'+year+'-'+String(seq).padStart(4,'0');
    while(used.has(code)){seq++;code='OP-'+year+'-'+String(seq).padStart(4,'0');}
    return saveData('ordensProducao',Object.assign({},data,{
      codigo_op:code,produto_id:product.id,produto:product.nome??product.name,
      quantidade_programada:qty,quantidade_produzida_real:n(data.quantidade_produzida_real),
      status_op:status,created_at:new Date().toISOString()
    }));
  }
  async function saveQualityInspection(data){
    const inspected=n(data.quantidade_inspecionada),approved=n(data.quantidade_aprovada);
    if(!data.ordem_producao_id||inspected<=0||approved<0||approved>inspected)throw new Error('Inspecção inválida: aprovadas não podem exceder as inspeccionadas.');
    const orders=await list('ordensProducao');
    if(!orders.some(o=>String(o.id)===String(data.ordem_producao_id)))throw new Error('Ordem de produção não encontrada.');
    return saveData('controleQualidade',Object.assign({},data,{
      quantidade_inspecionada:inspected,quantidade_aprovada:approved,
      quantidade_rejeitada:inspected-approved,data_inspecao:new Date().toISOString()
    }));
  }
  window.KanawaIndustrial=Object.freeze({states,validBom,saveBom,calculateMrp,createProductionOrder,saveQualityInspection});
})();
