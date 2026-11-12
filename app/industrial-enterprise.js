/* Kanawa Soft ERP 1.0 Enterprise — manufacturing execution foundation.
 * Additive only: uses existing saveData/getData + ks_records sync adapter; no direct stock mutation.
 * Capacity and material plans are proposals until an authorised production transaction is implemented.
 */
(function(global){
  'use strict';
  const STORES = Object.freeze({
    centers:'centrosTrabalho', routings:'roteirosProducao', operations:'operacoesProducao',
    downtime:'paradasProducao', maintenance:'manutencaoEquipamentos',
    byproducts:'subprodutosProducao', traceability:'rastreabilidadeProducao',
    executions:'execucoesProducao'
  });
  const states=['agendada','em_preparacao','em_execucao','controle_qualidade','finalizada','cancelada'];
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const norm=v=>String(v??'').trim().toLocaleLowerCase('pt-AO').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const rows=async store=>{const v=await getData(store);return Array.isArray(v)?v:[];};
  const required=(v,label)=>{if(!String(v??'').trim())throw new Error(label+' é obrigatório.');};
  const positive=(v,label)=>{const n=num(v);if(n<=0)throw new Error(label+' deve ser superior a zero.');return n;};
  function canReadModule(moduleId){
    if(typeof global.podeAcessar!=='function'||!global.podeAcessar(moduleId))return false;
    return typeof global.planoPermiteModulo!=='function'||global.planoPermiteModulo(moduleId);
  }
  function requirePermission(moduleId,action){
    if(!canReadModule(moduleId))throw new Error('Sem acesso ao módulo '+moduleId+'.');
    if(typeof global.podeFazer!=='function'||!global.podeFazer(action,moduleId))throw new Error('Sem permissão para '+(action==='editar'?'editar':'criar')+' neste módulo.');
  }
  function requireSavePermission(moduleId,data){requirePermission(moduleId,data&&data.id?'editar':'criar');}
  const findProduct=(products,ref)=>products.find(p=>String(p.id)===String(ref)||[p.nome,p.name,p.codigo,p.sku].some(v=>norm(v)===norm(ref)));
  const componentParent=b=>b.produto_pai_id??b.produto_id??b.produto??b.produtoNome??b.produtoId;
  const componentRef=b=>b.componente_id??b.insumo_produto_id??b.material_id??b.material??b.materialNome;
  const componentQty=b=>num(b.quantidade_necessaria??b.quantidade??b.qtd);
  const componentLoss=b=>num(b.percentual_perda??b.perdaPercentual??b.perda_percentual);
  const matches=(p,ref)=>!!p&&([p.id,p.nome,p.name,p.codigo,p.sku].some(v=>v!==undefined&&norm(v)===norm(ref)));
  function validBom(b){
    const parent=componentParent(b||{}),part=componentRef(b||{}),qty=componentQty(b||{}),loss=componentLoss(b||{});
    return !!parent&&!!part&&norm(parent)!==norm(part)&&qty>0&&loss>=0&&loss<100;
  }
  async function saveBom(b){
    requireSavePermission('bom',b);
    if(!validBom(b))throw new Error('BOM inválida: produto pai, componente, quantidade positiva e perda entre 0 e 99,99% são obrigatórios.');
    const products=await rows('produtos'),parent=findProduct(products,componentParent(b)),part=findProduct(products,componentRef(b));
    if(!parent||!part)throw new Error('Produto acabado e componente devem existir no catálogo.');
    const all=await rows('boms');
    if(all.some(x=>String(x.id)!==String(b.id)&&matches(parent,componentParent(x))&&matches(part,componentRef(x))))throw new Error('Componente já existe nesta ficha técnica.');
    return saveData('boms',Object.assign({},b,{produto:parent.nome||parent.name,material:part.nome||part.name,produto_pai_id:parent.id,componente_id:part.id,quantidade:componentQty(b),perdaPercentual:componentLoss(b),unidade:b.unidade||part.unidade||'UN',updated_at:new Date().toISOString()}));
  }
  async function explodeBom(productRef,quantity,options){
    if(!canReadModule('mrp')||!canReadModule('bom')||!canReadModule('produtos'))throw new Error('Sem acesso aos módulos necessários para consultar o MRP.');
    const qty=positive(quantity,'Quantidade'),maxDepth=Math.min(20,Math.max(1,num(options&&options.maxDepth)||12));
    const [products,boms]=await Promise.all([rows('produtos'),rows('boms')]);
    const stock=canReadModule('estoque')?await rows('estoque'):[];
    const root=findProduct(products,productRef);if(!root)throw new Error('Produto acabado não encontrado.');
    const totals=new Map(),path=[];
    function walk(product,need,depth){
      if(depth>maxDepth)throw new Error('BOM excede a profundidade máxima de '+maxDepth+' níveis.');
      const id=String(product.id??product.codigo??product.nome);
      if(path.includes(id))throw new Error('Ciclo detectado na BOM: '+path.concat(id).join(' → '));
      const recipe=boms.filter(b=>matches(product,componentParent(b)));
      if(!recipe.length){const key=String(product.id??norm(product.nome));const old=totals.get(key)||{produto_id:product.id,material:product.nome||product.name||'',quantidade_necessaria:0,unidade:product.unidade||'UN',nivel:depth};old.quantidade_necessaria+=need;totals.set(key,old);return;}
      path.push(id);
      for(const line of recipe){
        const part=findProduct(products,componentRef(line));if(!part)throw new Error('Componente da BOM não existe no catálogo: '+String(componentRef(line)));
        const requiredQty=need*componentQty(line)*(1+componentLoss(line)/100);
        walk(part,requiredQty,depth+1);
      }
      path.pop();
    }
    walk(root,qty,0);
    return [...totals.values()].map(item=>{
      const found=stock.filter(s=>String(s.produto_id??s.product_id)===String(item.produto_id)||norm(s.produto??s.nome_produto)===norm(item.material));
      const available=found.length?found.reduce((sum,s)=>sum+num(s.quantidade_atual??s.quantidade??s.stock),0):num((findProduct(products,item.produto_id)||{}).estoque??0);
      return Object.assign(item,{stock_disponivel:available,falta:Math.max(0,item.quantidade_necessaria-available),suficiente:available>=item.quantidade_necessaria});
    });
  }
  async function calculateMrp(productRef,quantity){return explodeBom(productRef,quantity);}
  async function saveWorkCenter(data){
    requireSavePermission('producao',data);
    required(data.codigo,'Código do centro de trabalho');required(data.nome,'Nome do centro de trabalho');
    const capacity=positive(data.capacidade_horas_dia??8,'Capacidade diária');
    const all=await rows(STORES.centers);
    if(all.some(x=>norm(x.codigo)===norm(data.codigo)&&String(x.id)!==String(data.id)))throw new Error('Já existe um centro de trabalho com este código.');
    return saveData(STORES.centers,Object.assign({},data,{codigo:String(data.codigo).trim(),nome:String(data.nome).trim(),capacidade_horas_dia:capacity,eficiencia_percentual:Math.min(100,Math.max(1,num(data.eficiencia_percentual)||100)),ativo:data.ativo!==false,updated_at:new Date().toISOString()}));
  }
  async function saveRouting(data){
    requireSavePermission('producao',data);
    required(data.produto_id??data.produto,'Produto do roteiro');
    const steps=Array.isArray(data.operacoes)?data.operacoes:[];
    if(!steps.length)throw new Error('Adicione pelo menos uma operação ao roteiro.');
    const centers=await rows(STORES.centers);
    steps.forEach((s,i)=>{required(s.nome,'Nome da operação '+(i+1));positive(s.tempo_minutos,'Tempo da operação '+(i+1));if(s.centro_trabalho_id&&!centers.some(c=>String(c.id)===String(s.centro_trabalho_id)))throw new Error('Centro de trabalho não encontrado na operação '+(i+1)+'.');});
    const products=await rows('produtos'),product=findProduct(products,data.produto_id??data.produto);
    if(!product)throw new Error('Produto do roteiro não encontrado no catálogo.');
    return saveData(STORES.routings,Object.assign({},data,{produto_id:product.id,produto:product.nome||product.name,operacoes:steps.map((s,i)=>Object.assign({},s,{sequencia:i+1,tempo_minutos:num(s.tempo_minutos)})),updated_at:new Date().toISOString()}));
  }
  async function planCapacity(orderId){
    if(!canReadModule('producao')||!canReadModule('ordens-producao'))throw new Error('Sem acesso às ordens de produção.');
    const [orders,centers,routings,downtime]=await Promise.all([rows('ordensProducao'),rows(STORES.centers),rows(STORES.routings),rows(STORES.downtime)]);
    const shifts=canReadModule('rh')?await rows('turnos'):[];
    const order=orders.find(o=>String(o.id)===String(orderId));if(!order)throw new Error('Ordem de produção não encontrada.');
    const routing=routings.find(r=>String(r.produto_id)===String(order.produto_id)||norm(r.produto)===norm(order.produto));
    if(!routing)throw new Error('O produto ainda não possui roteiro de fabrico.');
    const quantity=positive(order.quantidade_programada??order.quantidade,'Quantidade da ordem');
    const results=routing.operacoes.map(op=>{
      const center=centers.find(c=>String(c.id)===String(op.centro_trabalho_id));
      if(!center) return {operacao:op.nome,centro:'Não atribuído',horas_necessarias:quantity*num(op.tempo_minutos)/60,capacidade_horas_dia:0,estado:'centro_em_falta'};
      const shiftHours=shifts.filter(s=>String(s.centro_trabalho_id||s.centroId||'')===String(center.id)&&s.ativo!==false).reduce((sum,s)=>sum+num(s.horas_dia??s.duracaoHoras),0);
      const gross=shiftHours||num(center.capacidade_horas_dia)||8;
      const stopHours=downtime.filter(d=>String(d.centro_trabalho_id)===String(center.id)&&d.estado!=='cancelada').reduce((sum,d)=>sum+num(d.duracao_horas),0);
      const capacity=Math.max(0,gross*num(center.eficiencia_percentual||100)/100-stopHours);
      const hours=quantity*num(op.tempo_minutos)/60;
      return {operacao:op.nome,centro:center.nome,centro_trabalho_id:center.id,horas_necessarias:hours,capacidade_horas_dia:capacity,dias_necessarios:capacity?hours/capacity:null,estado:hours<=capacity?'capacidade_disponivel':'capacidade_insuficiente'};
    });
    return {ordem_id:order.id,produto:order.produto,quantidade:quantity,operacoes:results,viavel:results.every(x=>x.estado==='capacidade_disponivel'),calculado_em:new Date().toISOString()};
  }
  async function saveDowntime(data){
    requireSavePermission('producao',data);
    required(data.centro_trabalho_id,'Centro de trabalho');required(data.motivo,'Motivo da paragem');
    const duration=positive(data.duracao_horas,'Duração da paragem');
    const centers=await rows(STORES.centers);if(!centers.some(c=>String(c.id)===String(data.centro_trabalho_id)))throw new Error('Centro de trabalho não encontrado.');
    return saveData(STORES.downtime,Object.assign({},data,{duracao_horas:duration,estado:data.estado||'registada',created_at:new Date().toISOString()}));
  }
  async function saveByproduct(data){
    requireSavePermission('producao',data);
    if(!canReadModule('ordens-producao')||!canReadModule('produtos'))throw new Error('Sem acesso às ordens ou produtos necessários.');
    required(data.ordem_producao_id,'Ordem de produção');required(data.produto_id??data.produto,'Subproduto');
    const qty=positive(data.quantidade,'Quantidade do subproduto');
    const [orders,products]=await Promise.all([rows('ordensProducao'),rows('produtos')]);
    if(!orders.some(o=>String(o.id)===String(data.ordem_producao_id)))throw new Error('Ordem de produção não encontrada.');
    const product=findProduct(products,data.produto_id??data.produto);if(!product)throw new Error('Subproduto não existe no catálogo.');
    return saveData(STORES.byproducts,Object.assign({},data,{produto_id:product.id,produto:product.nome||product.name,quantidade:qty,created_at:new Date().toISOString()}));
  }
  async function saveTraceability(data){
    requireSavePermission('producao',data);
    if(!canReadModule('ordens-producao')||!canReadModule('produtos'))throw new Error('Sem acesso às ordens ou produtos necessários.');
    required(data.ordem_producao_id,'Ordem de produção');required(data.lote_producao,'Lote de produção');
    const [orders,products,traces]=await Promise.all([rows('ordensProducao'),rows('produtos'),rows(STORES.traceability)]);
    const lots=canReadModule('estoque')?await rows('lotes'):[];
    const order=orders.find(o=>String(o.id)===String(data.ordem_producao_id));if(!order)throw new Error('Ordem de produção não encontrada.');
    const product=findProduct(products,data.produto_id??order.produto_id??order.produto);if(!product)throw new Error('Produto da ordem não encontrado.');
    const duplicateStock=lots.some(l=>norm(l.numero??l.codigo??l.lote)===norm(data.lote_producao)&&String(l.produto_id??l.product_id)===String(product.id)&&String(l.id)!==String(data.lote_id));
    const duplicateTrace=traces.some(l=>norm(l.lote_producao??l.lote)===norm(data.lote_producao)&&String(l.produto_id??l.product_id)===String(product.id)&&String(l.id)!==String(data.id));
    if(duplicateStock||duplicateTrace)throw new Error('Já existe um lote com este código para o produto.');
    return saveData(STORES.traceability,Object.assign({},data,{produto_id:product.id,produto:product.nome||product.name,ordem_codigo:order.codigo_op||order.id,created_at:new Date().toISOString()}));
  }
  async function saveMaintenance(data){
    requireSavePermission('producao',data);
    required(data.centro_trabalho_id,'Centro de trabalho/equipamento');required(data.descricao,'Descrição da manutenção');
    const [centers,existing]=await Promise.all([rows(STORES.centers),rows(STORES.maintenance)]);
    if(!centers.some(c=>String(c.id)===String(data.centro_trabalho_id)))throw new Error('Centro de trabalho/equipamento não encontrado.');
    if(data.data_prevista&&Number.isNaN(Date.parse(data.data_prevista)))throw new Error('Data prevista inválida.');
    return saveData(STORES.maintenance,Object.assign({},data,{estado:data.estado||'planeada',tipo:data.tipo||'preventiva',updated_at:new Date().toISOString()}));
  }
  async function createProductionOrder(data){
    requireSavePermission('ordens-producao',data);
    if(!canReadModule('produtos'))throw new Error('Sem acesso ao catálogo de produtos.');
    const qty=positive(data.quantidade_programada??data.quantidade,'Quantidade programada');
    const product=findProduct(await rows('produtos'),data.produto_id??data.produto);if(!product)throw new Error('Produto não encontrado no catálogo.');
    const current=await rows('ordensProducao'),year=new Date().getFullYear();
    const existing=current.find(o=>String(o.id)===String(data.id));
    let seq=current.filter(o=>String(o.codigo_op||'').startsWith('OP-'+year+'-')).length+1,code=data.codigo_op||(existing&&existing.codigo_op)||'OP-'+year+'-'+String(seq).padStart(5,'0');
    const used=new Set(current.filter(o=>String(o.id)!==String(data.id)).map(o=>String(o.codigo_op||'')));while(used.has(code)){seq++;code='OP-'+year+'-'+String(seq).padStart(5,'0');}
    const status=data.status_op||'agendada';if(!states.includes(status))throw new Error('Estado da ordem de produção inválido.');
    const legacyStatus=({agendada:'pendente',em_preparacao:'pendente',em_execucao:'em_andamento',controle_qualidade:'em_andamento',finalizada:'concluida',cancelada:'cancelada'})[status]||status;
    const timestamp=new Date().toISOString();
    return saveData('ordensProducao',Object.assign({},data,{codigo_op:code,produto_id:product.id,produto:product.nome||product.name,quantidade_programada:qty,quantidade:qty,quantidade_produzida_real:Math.max(0,num(data.quantidade_produzida_real)),status_op:status,status:legacyStatus,data:data.data||timestamp,created_at:existing&&existing.created_at||timestamp}));
  }
  async function saveQualityInspection(data){
    requireSavePermission('controle-qualidade',data);
    if(!canReadModule('ordens-producao'))throw new Error('Sem acesso às ordens de produção.');
    const inspected=positive(data.quantidade_inspecionada,'Quantidade inspeccionada'),approved=num(data.quantidade_aprovada);
    if(approved<0||approved>inspected)throw new Error('Quantidade aprovada não pode exceder a inspeccionada.');
    const orders=await rows('ordensProducao'),order=orders.find(o=>String(o.id)===String(data.ordem_producao_id));
    if(!order)throw new Error('Ordem de produção não encontrada.');
    const timestamp=new Date().toISOString();
    return saveData('controleQualidade',Object.assign({},data,{produto:data.produto||order.produto||'',ordem_codigo:order.codigo_op||String(order.id),lote:data.lote||data.lote_producao||'',quantidade_inspecionada:inspected,quantidade_aprovada:approved,quantidade_rejeitada:inspected-approved,data:data.data||timestamp,data_inspecao:timestamp}));
  }
  async function calculateCost(data){
    if(!canReadModule('custos-producao'))throw new Error('Sem acesso aos custos de produção.');
    const material=num(data.custo_materiais),laborHours=num(data.horas_mao_obra),laborRate=num(data.custo_hora),overhead=num(data.custos_indiretos),qty=positive(data.quantidade_produzida,'Quantidade produzida');
    if([material,laborHours,laborRate,overhead].some(v=>v<0))throw new Error('Os custos e horas não podem ser negativos.');
    const labor=laborHours*laborRate,total=material+labor+overhead;
    return {material,labor_hours:laborHours,labor_rate:laborRate,labor,overhead,total,unit_cost:total/qty,currency:'AOA'};
  }
  async function renderPanel(){
    if(!canReadModule('producao'))return '';
    const [centers,routings,orders,byproducts,maintenance,trace]=await Promise.all([rows(STORES.centers),rows(STORES.routings),canReadModule('ordens-producao')?rows('ordensProducao'):Promise.resolve([]),rows(STORES.byproducts),rows(STORES.maintenance),rows(STORES.traceability)]);
    const card=(label,value,action)=>'<div class="metric-card"><div class="label">'+label+'</div><div class="value">'+value+'</div>'+(action||'')+'</div>';
    const btn=(label,fn)=>'<button class="btn btn-sm btn-primary" onclick="'+fn+'">'+label+'</button>';
    const centerRows=centers.map(c=>[esc(c.codigo),esc(c.nome),fmtN(c.capacidade_horas_dia)+' h/dia',fmtN(c.eficiencia_percentual)+'%',badge(c.ativo?'Activo':'Inactivo',c.ativo?'success':'warning')]);
    const orderOptions=orders.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.codigo_op||('OP '+o.id))+' — '+esc(o.produto)+'</option>').join('');
    return '<section class="card"><div class="card-header"><h3 class="card-title">Gestão fabril avançada</h3><span class="badge badge-info">Planeamento e controlo</span></div>'+
      '<p class="text-muted">Centros de trabalho, roteiros, capacidade, subprodutos, rastreabilidade e manutenção. Os cálculos são de planeamento; não alteram stock nem certificam documentos fiscais.</p>'+
      '<div class="metric-grid">'+card('Centros de trabalho',centers.length,btn('Novo centro','KanawaIndustrialEnterprise.ui.center()'))+card('Roteiros',routings.length,btn('Novo roteiro','KanawaIndustrialEnterprise.ui.routing()'))+card('Ordens',orders.length,'')+card('Subprodutos',byproducts.length,'')+card('Manutenções',maintenance.length,'')+card('Rastreabilidade',trace.length,'')+'</div>'+
      '<div class="form-grid"><div class="form-group"><label>Ordem para análise de capacidade</label><select id="ksIndustrialOrder"><option value="">Seleccionar ordem</option>'+orderOptions+'</select></div><div class="form-group" style="align-self:end"><button class="btn btn-primary" onclick="KanawaIndustrialEnterprise.ui.capacity()">Calcular capacidade</button></div></div>'+
      '<div id="ksIndustrialCapacityResult" aria-live="polite"></div>'+
      '<div class="card"><h4>Centros de trabalho</h4>'+(centerRows.length?table(['Código','Centro','Capacidade','Eficiência','Estado'],centerRows):'<p class="text-muted">Ainda não há centros cadastrados.</p>')+'</div>'+
      '<div class="form-grid"><div class="form-group"><label>Ordem para registar subproduto</label><select id="ksIndustrialByproductOrder"><option value="">Seleccionar ordem</option>'+orderOptions+'</select></div><div class="form-group"><label>Produto/subproduto (ID ou nome)</label><input id="ksIndustrialByproductProduct"></div><div class="form-group"><label>Quantidade</label><input id="ksIndustrialByproductQty" type="number" min="0.001" step="0.001"></div><div class="form-group" style="align-self:end"><button class="btn btn-primary" onclick="KanawaIndustrialEnterprise.ui.byproduct()">Registar subproduto</button></div></div>'+
      '<div class="form-grid"><div class="form-group"><label>Ordem para rastreabilidade</label><select id="ksIndustrialTraceOrder"><option value="">Seleccionar ordem</option>'+orderOptions+'</select></div><div class="form-group"><label>Código do lote produzido</label><input id="ksIndustrialTraceLot"></div><div class="form-group"><label>Quantidade do lote</label><input id="ksIndustrialTraceQty" type="number" min="0.001" step="0.001"></div><div class="form-group" style="align-self:end"><button class="btn btn-primary" onclick="KanawaIndustrialEnterprise.ui.trace()">Guardar rastreabilidade</button></div></div>'+
      '<div class="card"><h4>Manutenção de equipamentos</h4><p class="text-muted">Registe intervenções preventivas ou correctivas associadas a um centro de trabalho.</p><button class="btn btn-secondary" onclick="KanawaIndustrialEnterprise.ui.maintenance()">Nova manutenção</button></div>'+
      '<div class="card"><h4>Custos industriais detalhados</h4><p class="text-muted">Calcule materiais, mão de obra por hora e custos indirectos sem lançar automaticamente movimentos financeiros.</p><button class="btn btn-secondary" onclick="KanawaIndustrialEnterprise.ui.cost()">Calcular custo industrial</button></div></section>';
  }
  const ui={
    async order(id){
      try{
        requirePermission('ordens-producao',id?'editar':'criar');
        if(!canReadModule('produtos'))throw new Error('Sem acesso ao catálogo de produtos.');
        const [products,orders]=await Promise.all([rows('produtos'),rows('ordensProducao')]);
        const current=id?orders.find(o=>String(o.id)===String(id)):null;
        if(id&&!current)throw new Error('Ordem de produção não encontrada.');
        const product=current&&products.find(p=>String(p.id)===String(current.produto_id)||norm(p.nome||p.name)===norm(current.produto));
        if(current&&!product)throw new Error('O produto desta ordem já não está disponível no catálogo.');
        const options=products.map(p=>'<option value="'+esc(p.id)+'" '+(product&&String(product.id)===String(p.id)?'selected':'')+'>'+esc(p.codigo?p.codigo+' — '+(p.nome||p.name):(p.nome||p.name||'Produto'))+'</option>').join('');
        const labels={agendada:'Agendada',em_preparacao:'Em preparação',em_execucao:'Em execução',controle_qualidade:'Controlo de qualidade',finalizada:'Finalizada',cancelada:'Cancelada'};
        const status=current&&current.status_op||'agendada',recordId=current?Number(current.id):'null';
        const body='<form onsubmit="event.preventDefault();KanawaIndustrialEnterprise.ui.saveOrder('+recordId+')"><div class="form-grid">'+
          '<div class="form-group"><label>Produto *</label><select id="ksIndustrialOrderProduct" required><option value="">Seleccionar produto</option>'+options+'</select></div>'+
          '<div class="form-group"><label>Quantidade programada *</label><input id="ksIndustrialOrderQuantity" type="number" min="0.001" step="0.001" required value="'+esc(current&&(current.quantidade_programada??current.quantidade)||1)+'"></div>'+
          '<div class="form-group"><label>Estado</label><select id="ksIndustrialOrderStatus">'+states.map(s=>'<option value="'+s+'" '+(status===s?'selected':'')+'>'+labels[s]+'</option>').join('')+'</select></div></div>'+
          '<p class="text-muted">A ordem é criada manualmente. Não reserva stock, não inicia produção e não altera movimentos de inventário.</p><button class="btn btn-primary btn-block" type="submit">Guardar ordem</button></form>';
        global.openModal(id?'Editar ordem de produção':'Nova ordem de produção',body,true);
      }catch(error){global.toast(error.message,'error');}
    },
    async saveOrder(id){
      try{
        const productId=global.document.getElementById('ksIndustrialOrderProduct')?.value;
        const quantity=global.document.getElementById('ksIndustrialOrderQuantity')?.value;
        const status=global.document.getElementById('ksIndustrialOrderStatus')?.value;
        await createProductionOrder({id:id||undefined,produto_id:productId,quantidade_programada:quantity,status_op:status});
        global.toast('Ordem de produção guardada.','success');global.closeModal();global.openModule('ordens-producao');
      }catch(error){global.toast(error.message,'error');}
    },
    async inspection(id){
      try{
        requirePermission('controle-qualidade',id?'editar':'criar');
        if(!canReadModule('ordens-producao'))throw new Error('Sem acesso às ordens de produção.');
        const [orders,inspections]=await Promise.all([rows('ordensProducao'),rows('controleQualidade')]);
        const current=id?inspections.find(x=>String(x.id)===String(id)):null;
        if(id&&!current)throw new Error('Inspecção não encontrada.');
        const options=orders.map(o=>'<option value="'+esc(o.id)+'" '+(current&&String(current.ordem_producao_id)===String(o.id)?'selected':'')+'>'+esc(o.codigo_op||('OP '+o.id))+' — '+esc(o.produto||'Produto')+'</option>').join('');
        const recordId=current?Number(current.id):'null';
        const body='<form onsubmit="event.preventDefault();KanawaIndustrialEnterprise.ui.saveInspection('+recordId+')"><div class="form-grid">'+
          '<div class="form-group"><label>Ordem de produção *</label><select id="ksIndustrialInspectionOrder" required><option value="">Seleccionar ordem</option>'+options+'</select></div>'+
          '<div class="form-group"><label>Lote (opcional)</label><input id="ksIndustrialInspectionLot" value="'+esc(current&&current.lote||'')+'"></div>'+
          '<div class="form-group"><label>Quantidade inspeccionada *</label><input id="ksIndustrialInspectionQty" type="number" min="0.001" step="0.001" required value="'+esc(current&&current.quantidade_inspecionada||'')+'"></div>'+
          '<div class="form-group"><label>Quantidade aprovada *</label><input id="ksIndustrialInspectionApproved" type="number" min="0" step="0.001" required value="'+esc(current&&current.quantidade_aprovada||0)+'"></div></div>'+
          '<p class="text-muted">A quantidade rejeitada é calculada automaticamente. Esta inspecção não movimenta stock.</p><button class="btn btn-primary btn-block" type="submit">Guardar inspecção</button></form>';
        global.openModal(id?'Editar inspecção de qualidade':'Nova inspecção de qualidade',body,true);
      }catch(error){global.toast(error.message,'error');}
    },
    async saveInspection(id){
      try{
        const orderId=global.document.getElementById('ksIndustrialInspectionOrder')?.value;
        const lot=global.document.getElementById('ksIndustrialInspectionLot')?.value;
        const inspected=global.document.getElementById('ksIndustrialInspectionQty')?.value;
        const approved=global.document.getElementById('ksIndustrialInspectionApproved')?.value;
        await saveQualityInspection({id:id||undefined,ordem_producao_id:orderId,lote:lot,quantidade_inspecionada:inspected,quantidade_aprovada:approved});
        global.toast('Inspecção de qualidade guardada.','success');global.closeModal();global.openModule('controle-qualidade');
      }catch(error){global.toast(error.message,'error');}
    },
    async center(){const code=prompt('Código do centro de trabalho:');if(!code)return;const name=prompt('Nome do centro de trabalho:');if(!name)return;const cap=prompt('Capacidade disponível (horas por dia):','8');try{await saveWorkCenter({codigo:code,nome:name,capacidade_horas_dia:cap,eficiencia_percentual:100});toast('Centro de trabalho guardado.','success');openModule('producao');}catch(e){toast(e.message,'error');}},
    async routing(){const product=prompt('ID ou nome do produto:');if(!product)return;const center=await rows(STORES.centers);if(!center.length){toast('Cadastre primeiro um centro de trabalho.','warning');return;}const name=prompt('Nome da primeira operação:','Preparação');if(!name)return;const minutes=prompt('Tempo por unidade (minutos):','10');try{await saveRouting({produto:product,operacoes:[{nome:name,centro_trabalho_id:center[0].id,tempo_minutos:minutes}]});toast('Roteiro guardado.','success');openModule('producao');}catch(e){toast(e.message,'error');}},
    async capacity(){const id=document.getElementById('ksIndustrialOrder')?.value;if(!id){toast('Seleccione uma ordem.','warning');return;}try{const result=await planCapacity(id);const el=document.getElementById('ksIndustrialCapacityResult');if(el)el.innerHTML='<div class="alert alert-info show">'+result.operacoes.map(o=>esc(o.operacao)+' — '+esc(o.centro)+': '+fmtN(o.horas_necessarias)+' h / '+fmtN(o.capacidade_horas_dia)+' h/dia ('+esc(o.estado)+')').join('<br>')+'</div>';}catch(e){toast(e.message,'error');}},
    async byproduct(){const id=document.getElementById('ksIndustrialByproductOrder')?.value,product=document.getElementById('ksIndustrialByproductProduct')?.value,qty=document.getElementById('ksIndustrialByproductQty')?.value;try{await saveByproduct({ordem_producao_id:id,produto:product,quantidade:qty});toast('Subproduto registado.','success');openModule('producao');}catch(e){toast(e.message,'error');}},
    async trace(){const id=document.getElementById('ksIndustrialTraceOrder')?.value,lot=document.getElementById('ksIndustrialTraceLot')?.value,qty=document.getElementById('ksIndustrialTraceQty')?.value;try{await saveTraceability({ordem_producao_id:id,lote_producao:lot,quantidade:qty});toast('Rastreabilidade guardada.','success');openModule('producao');}catch(e){toast(e.message,'error');}},
    async maintenance(){const centers=await rows(STORES.centers);if(!centers.length){toast('Cadastre primeiro um centro de trabalho.','warning');return;}const center=prompt('ID do centro/equipamento: '+centers.map(c=>c.id+'='+c.nome).join(', '),String(centers[0].id));if(!center)return;const description=prompt('Descrição da manutenção:');if(!description)return;const date=prompt('Data prevista (AAAA-MM-DD):',new Date().toISOString().slice(0,10));try{await saveMaintenance({centro_trabalho_id:center,descricao:description,data_prevista:date,tipo:'preventiva'});toast('Manutenção planeada.','success');openModule('producao');}catch(e){toast(e.message,'error');}},
    async cost(){const material=prompt('Custo dos materiais (Kz):','0'),hours=prompt('Horas de mão de obra:','0'),rate=prompt('Custo por hora (Kz):','0'),overhead=prompt('Custos indirectos (Kz):','0'),qty=prompt('Quantidade produzida:','1');try{const c=await calculateCost({custo_materiais:material,horas_mao_obra:hours,custo_hora:rate,custos_indiretos:overhead,quantidade_produzida:qty});toast('Custo total: '+fmt(c.total)+' Kz | custo unitário: '+fmt(c.unit_cost)+' Kz','success');}catch(e){toast(e.message,'error');}}
  };
  global.KanawaIndustrialEnterprise=Object.freeze({stores:STORES,validBom,saveBom,explodeBom,calculateMrp,saveWorkCenter,saveRouting,planCapacity,saveDowntime,saveByproduct,saveTraceability,saveMaintenance,createProductionOrder,saveQualityInspection,calculateCost,renderPanel,ui});
})(window);
