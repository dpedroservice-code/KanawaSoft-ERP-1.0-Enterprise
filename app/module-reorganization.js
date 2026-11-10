/* Kanawa Soft ERP — reorganização funcional dos módulos Projetos e Configurações.
 * Compatível com a arquitectura actual HTML/CSS/JS + IndexedDB + KanawaCloud.
 * Não substitui autenticação, permissões, hooks, nem contratos de servidor.
 */
'use strict';

const KS_PROJECT_STATUS = [
  ['planeamento','Planeamento'],['em_execucao','Em execução'],
  ['bloqueado','Bloqueado / pendente'],['concluido','Concluído'],['cancelado','Cancelado']
];
const KS_PROJECT_BILLING = [['fixo','Preço fixo'],['tempo_materiais','Tempo e materiais']];
let ksProjectMembersCache = [];

function ksProjectCode(projects) {
  const year = new Date().getFullYear();
  const prefix = 'PRJ-' + year + '-';
  const max = (projects || []).reduce((n,p) => {
    const code = String(p.project_code || p.codigo || '');
    const match = code.match(new RegExp('^PRJ-' + year + '-(\\d+)$'));
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return prefix + String(max + 1).padStart(3,'0');
}
function ksProjectStatusLabel(status) {
  return (KS_PROJECT_STATUS.find(x=>x[0]===status)||[])[1] || status || 'Planeamento';
}
function ksProjectStatusBadge(status) {
  const tone = status==='concluido'?'success':status==='bloqueado'?'warning':status==='cancelado'?'danger':status==='em_execucao'?'info':'secondary';
  return typeof badge==='function' ? badge(ksProjectStatusLabel(status),tone) : esc(ksProjectStatusLabel(status));
}
function ksProjectClientName(client) {
  return client && (client.nome || client.razaoSocial || client.empresa || client.name || client.nomeFiscal) || 'Cliente sem nome';
}
async function ksGetProjectTeam() {
  let members=[];
  try {
    if(window.KanawaCloud && KanawaCloud.ready && typeof KanawaCloud.listTeamMembers==='function') members=await KanawaCloud.listTeamMembers();
  } catch(error) { console.warn('Equipa de projectos indisponível no serviço central:',error); }
  if(!Array.isArray(members)||!members.length) {
    try { members=await getData('funcionarios'); } catch (_) { members=[]; }
  }
  ksProjectMembersCache=Array.isArray(members)?members:[];
  return ksProjectMembersCache;
}
async function renderProjetos() {
  const projects=await getData('projetos');
  const clients=await getData('clientes');
  const totalBudget=projects.reduce((n,p)=>n+Number(p.budget_total||p.orcamentoTotal||0),0);
  const completed=projects.filter(p=>p.status==='concluido'||p.status==='concluida').length;
  const active=projects.filter(p=>['em_execucao','ativo'].includes(p.status)).length;
  const rows=projects.slice().sort((a,b)=>String(b.created_at||b.dataInicio||'').localeCompare(String(a.created_at||a.dataInicio||''))).map(p=>{
    const client=clients.find(c=>String(c.id)===String(p.client_id||p.clienteId));
    const progress=Math.max(0,Math.min(100,Number(p.progresso)||0));
    const code=p.project_code||p.codigo||('PRJ-'+p.id);
    return [esc(code),'<strong>'+esc(p.title||p.nome||'Sem título')+'</strong><small class="ks-project-subline">'+esc(client?ksProjectClientName(client):(p.clienteNome||'Sem cliente'))+'</small>',
      ksProjectStatusBadge(p.status),'<div class="ks-project-progress"><span style="width:'+progress+'%"></span></div><small>'+progress+'%</small>',
      fmt(Number(p.budget_total||p.orcamentoTotal||0)),fmtD(p.due_date||p.prazoEntrega),
      '<div class="ks-project-actions"><button type="button" class="btn btn-sm btn-primary" onclick="abrirDetalheProjeto('+Number(p.id)+')"><i class="fas fa-folder-open"></i> Abrir</button> <button type="button" class="btn btn-sm btn-secondary" onclick="abrirModalProjeto('+Number(p.id)+')" title="Editar"><i class="fas fa-edit"></i></button></div>'];
  });
  return renderProjectsViewsNav('projetos')+
    header('Projectos','Gestão de entregas, prazos, equipa e rentabilidade','var(--primary)',
      '<button type="button" class="btn btn-success" onclick="abrirModalProjeto()"><i class="fas fa-plus"></i> Novo projecto</button>','fa-project-diagram')+
    '<div class="metric-grid ks-project-metrics">'+
      '<div class="metric-card"><div class="label">Projectos</div><div class="value">'+projects.length+'</div></div>'+
      '<div class="metric-card"><div class="label">Em execução</div><div class="value">'+active+'</div></div>'+
      '<div class="metric-card"><div class="label">Concluídos</div><div class="value">'+completed+'</div></div>'+
      '<div class="metric-card"><div class="label">Orçamento total</div><div class="value">'+fmt(totalBudget)+'</div></div>'+
    '</div><div class="card ks-project-table"><div class="ks-section-heading"><div><h3>Carteira de projectos</h3><p>Abra um projecto para consultar tarefas, despesas, equipa e horas.</p></div><span>'+projects.length+' registos</span></div>'+
    (rows.length?table(['Referência','Projecto / Cliente','Estado','Progresso','Orçamento','Prazo','Acções'],rows):emptyState('fa-folder-open','Ainda não existem projectos','Crie o primeiro projecto para começar a acompanhar a execução.'))+'</div>';
}

async function abrirModalProjeto(projectId) {
  if(!podeAcessar('projetos')) { toast('Sem permissão para gerir projectos.','error'); return; }
  const [projects,clients,team]=await Promise.all([getData('projetos'),getData('clientes'),ksGetProjectTeam()]);
  const project=projectId?projects.find(p=>String(p.id)===String(projectId)):null;
  const code=project?(project.project_code||project.codigo):ksProjectCode(projects);
  const selectedClient=String(project?.client_id||project?.clienteId||'');
  const clientOptions=clients.map(c=>'<option value="'+esc(c.id)+'" '+(String(c.id)===selectedClient?'selected':'')+'>'+esc(ksProjectClientName(c))+(c.nif?' · '+esc(c.nif):'')+'</option>').join('');
  const selectedManager=String(project?.manager_id||project?.gestorId||'');
  const managerOptions=team.map(m=>{
    const id=m.user_id||m.id;
    return '<option value="'+esc(id)+'" '+(String(id)===selectedManager?'selected':'')+'>'+esc(m.full_name||m.nome||m.name||m.email||'Colaborador')+' · '+esc(m.role||m.cargo||'Equipa')+'</option>';
  }).join('');
  const selectedTeam=(project?.team_ids||project?.equipaIds||[]).map(String);
  const teamOptions=team.map(m=>{
    const id=m.user_id||m.id;
    return '<option value="'+esc(id)+'" '+(selectedTeam.includes(String(id))?'selected':'')+'>'+esc(m.full_name||m.nome||m.name||m.email||'Colaborador')+' · '+esc(m.role||m.cargo||'Equipa')+'</option>';
  }).join('');
  const status=project?.status||'planeamento',billing=project?.billing_type||project?.tipoFaturamento||'fixo';
  const field=(label,id,value,type='text',placeholder='')=>'<div class="form-group"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value??'')+'" placeholder="'+esc(placeholder)+'"></div>';
  const html='<div class="ks-project-form">'+
    '<section class="ks-form-section"><div class="ks-form-section-title"><i class="fas fa-clipboard-list"></i><div><strong>Dados gerais</strong><small>Identificação e cliente responsável.</small></div></div>'+
    field('Nome do projecto *','pjTitle',project?.title||project?.nome||'','text','Ex.: Instalação CCTV — Cliente X')+
    '<div class="form-grid">'+
    '<div class="form-group"><label for="pjCode">Código / referência</label><input id="pjCode" value="'+esc(code)+'" readonly></div>'+
    '<div class="form-group"><label for="pjClient">Cliente vinculado</label><select id="pjClient"><option value="">Seleccionar cliente…</option>'+clientOptions+'</select></div></div>'+
    '<div class="form-group"><label for="pjDesc">Descrição e escopo</label><textarea id="pjDesc" rows="3" placeholder="Objectivos, entregáveis e observações">'+esc(project?.description||project?.descricao||'')+'</textarea></div></section>'+
    '<section class="ks-form-section"><div class="ks-form-section-title"><i class="fas fa-calendar-alt"></i><div><strong>Cronograma e estado</strong><small>Planeamento, entrega e conclusão.</small></div></div><div class="form-grid">'+
    field('Data de início','pjStart',project?.start_date||project?.dataInicio||'','date')+
    field('Prazo estimado de entrega','pjDue',project?.due_date||project?.prazoEntrega||'','date')+
    '<div class="form-group"><label for="pjStatus">Estado</label><select id="pjStatus">'+KS_PROJECT_STATUS.map(x=>'<option value="'+x[0]+'" '+(status===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'+
    '<div class="form-group"><label for="pjProgress">Progresso (%)</label><input id="pjProgress" type="number" min="0" max="100" step="1" value="'+Math.max(0,Math.min(100,Number(project?.progresso)||0))+'"></div></div></section>'+
    '<section class="ks-form-section"><div class="ks-form-section-title"><i class="fas fa-coins"></i><div><strong>Orçamento e cobrança</strong><small>Valores em kwanzas (Kz).</small></div></div><div class="form-grid">'+
    field('Orçamento total / valor vendido (Kz)','pjBudget',project?.budget_total??project?.orcamentoTotal??0,'number')+
    field('Custo estimado de execução (Kz)','pjCost',project?.estimated_cost??project?.custoEstimado??0,'number')+
    '<div class="form-group"><label for="pjBilling">Tipo de faturamento</label><select id="pjBilling">'+KS_PROJECT_BILLING.map(x=>'<option value="'+x[0]+'" '+(billing===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'+
    '<div class="form-group"><label for="pjBillingNotes">Condições / etapas de cobrança</label><input id="pjBillingNotes" value="'+esc(project?.billing_notes||project?.condicoesCobranca||'')+'" placeholder="Ex.: 50% na adjudicação, 50% na entrega"></div></div></section>'+
    '<section class="ks-form-section"><div class="ks-form-section-title"><i class="fas fa-users"></i><div><strong>Responsáveis e equipa</strong><small>Colaboradores existentes no ERP.</small></div></div><div class="form-grid">'+
    '<div class="form-group"><label for="pjManager">Gestor / responsável</label><select id="pjManager"><option value="">Por atribuir</option>'+managerOptions+'</select></div>'+
    '<div class="form-group"><label for="pjTeam">Equipa técnica (pode seleccionar vários)</label><select id="pjTeam" multiple size="4">'+teamOptions+'</select><small class="form-hint">Use Ctrl (Windows) ou Cmd (Mac) para seleccionar vários colaboradores.</small></div></div></section>'+
    '<div class="ks-form-actions"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="salvarProjeto('+Number(project?.id||0)+')"><i class="fas fa-save"></i> '+(project?'Guardar alterações':'Criar projecto')+'</button></div></div>';
  openModal(project?'Editar projecto':'Novo projecto',html,true);
}

async function salvarProjeto(projectId) {
  const title=$('pjTitle')?.value.trim();
  if(!title){toast('O nome do projecto é obrigatório.','warning');$('pjTitle')?.focus();return;}
  const projects=await getData('projetos');
  const old=projectId?projects.find(p=>String(p.id)===String(projectId)):null;
  const status=$('pjStatus').value,nowIso=now();
  const selectedTeam=Array.from($('pjTeam').selectedOptions).map(o=>o.value);
  const record=Object.assign({},old||{},{
    project_code:$('pjCode').value,title,description:$('pjDesc').value.trim(),
    client_id:$('pjClient').value||null,start_date:$('pjStart').value||null,due_date:$('pjDue').value||null,
    end_date:status==='concluido'?(old?.end_date||nowIso.slice(0,10)):null,
    status,budget_total:Math.max(0,num($('pjBudget').value)),estimated_cost:Math.max(0,num($('pjCost').value)),
    billing_type:$('pjBilling').value,billing_notes:$('pjBillingNotes').value.trim(),
    manager_id:$('pjManager').value||null,team_ids:selectedTeam,
    progresso:status==='concluido'?100:Math.max(0,Math.min(100,int($('pjProgress').value))),
    nome:title,descricao:$('pjDesc').value.trim(),clienteId:$('pjClient').value||null,
    prazoEntrega:$('pjDue').value||null,custoEstimado:Math.max(0,num($('pjCost').value)),
    tipoFaturamento:$('pjBilling').value,gestorId:$('pjManager').value||null,equipaIds:selectedTeam,
    updated_at:nowIso,created_at:old?.created_at||nowIso
  });
  try {
    await saveData('projetos',record);
    if(selectedTeam.length){
      const existing=await getData('membrosProjetos');
      for(const memberId of selectedTeam){
        if(!existing.some(x=>String(x.project_id||x.projectId)===String(record.id)&&String(x.user_id||x.member_id)===String(memberId))){
          await saveData('membrosProjetos',{project_id:record.id,user_id:memberId,role:'tecnico',assigned_at:nowIso});
        }
      }
    }
    toast(old?'Projecto actualizado.':'Projecto criado com a referência '+record.project_code+'.','success');
    closeModal();openModule('projetos');
  } catch(error) { console.error(error);toast(error.message||'Não foi possível guardar o projecto.','danger'); }
}

async function abrirDetalheProjeto(projectId,activeTab='overview') {
  const projects=await getData('projetos'),project=projects.find(p=>String(p.id)===String(projectId));
  if(!project){toast('Projecto não encontrado.','warning');return;}
  const clients=await getData('clientes'),client=clients.find(c=>String(c.id)===String(project.client_id||project.clienteId));
  const tabs=[['overview','Resumo','fa-circle-info'],['tasks','Tarefas','fa-list-check'],['expenses','Despesas','fa-receipt'],['hours','Horas','fa-clock'],['team','Equipa','fa-users']];
  const [tasks,expenses,hours,members]=await Promise.all([getData('tarefasProjetos'),getData('atividadesProjetos'),getData('timesheets'),getData('membrosProjetos')]);
  const idMatch=x=>String(x.project_id||x.projectId||x.projetoId||'')===String(project.id)||String(x.project_code||x.projeto||'')===String(project.project_code||project.codigo);
  const projectTasks=tasks.filter(idMatch),projectExpenses=expenses.filter(x=>idMatch(x)&&(x.kind==='expense'||x.tipo==='despesa'||x.type==='expense'));
  const projectHours=hours.filter(idMatch),projectMembers=members.filter(idMatch);
  const nav='<nav class="ks-project-detail-tabs">'+tabs.map(t=>'<button type="button" class="ks-project-detail-tab '+(activeTab===t[0]?'active':'')+'" onclick="abrirDetalheProjeto('+Number(project.id)+',\''+t[0]+'\')"><i class="fas '+t[2]+'"></i> '+t[1]+'</button>').join('')+'</nav>';
  let body='';
  if(activeTab==='overview'){
    const spent=projectExpenses.reduce((n,x)=>n+Number(x.amount||x.valor||0),0);
    const hoursTotal=projectHours.reduce((n,x)=>n+Number(x.hours||x.horas||0),0);
    body='<div class="metric-grid"><div class="metric-card"><div class="label">Orçamento</div><div class="value">'+fmt(project.budget_total||project.orcamentoTotal||0)+'</div></div><div class="metric-card"><div class="label">Custo estimado</div><div class="value">'+fmt(project.estimated_cost||project.custoEstimado||0)+'</div></div><div class="metric-card"><div class="label">Despesas registadas</div><div class="value">'+fmt(spent)+'</div></div><div class="metric-card"><div class="label">Horas registadas</div><div class="value">'+hoursTotal.toLocaleString('pt-AO')+' h</div></div></div>'+
      '<div class="ks-project-summary-grid"><div><small>Cliente</small><strong>'+esc(client?ksProjectClientName(client):(project.clienteNome||'Não associado'))+'</strong></div><div><small>Gestor</small><strong>'+esc(project.manager_name||project.gestorNome||'Por atribuir')+'</strong></div><div><small>Início</small><strong>'+fmtD(project.start_date||project.dataInicio)+'</strong></div><div><small>Entrega prevista</small><strong>'+fmtD(project.due_date||project.prazoEntrega)+'</strong></div><div><small>Estado</small><strong>'+ksProjectStatusBadge(project.status)+'</strong></div><div><small>Faturamento</small><strong>'+esc((KS_PROJECT_BILLING.find(x=>x[0]===(project.billing_type||project.tipoFaturamento))||[])[1]||'Preço fixo')+'</strong></div></div>'+
      '<div class="ks-project-toolbar"><button class="btn btn-primary" onclick="abrirModalProjeto('+Number(project.id)+')"><i class="fas fa-edit"></i> Editar projecto</button><button class="btn btn-secondary" onclick="alterarEstadoProjeto('+Number(project.id)+')"><i class="fas fa-exchange-alt"></i> Alterar estado</button></div>';
  } else if(activeTab==='tasks'){
    body='<div class="ks-project-toolbar"><button class="btn btn-success" onclick="adicionarTarefaProjeto('+Number(project.id)+')"><i class="fas fa-plus"></i> Nova tarefa</button></div>'+
      (projectTasks.length?table(['Tarefa','Responsável','Prioridade','Prazo','Estado'],projectTasks.map(x=>[esc(x.title||x.titulo),esc(x.assignee_name||x.responsavelNome||x.responsavel||'Por atribuir'),esc(x.priority||x.prioridade||'Normal'),fmtD(x.due_date||x.prazo),ksProjectStatusBadge(x.status||'planeamento')])):emptyState('fa-list-check','Sem tarefas','Adicione as etapas e tarefas de execução deste projecto.'));
  } else if(activeTab==='expenses'){
    body='<div class="ks-project-toolbar"><button class="btn btn-success" onclick="adicionarDespesaProjeto('+Number(project.id)+')"><i class="fas fa-plus"></i> Registar despesa</button></div>'+
      (projectExpenses.length?table(['Data','Descrição','Categoria','Valor'],projectExpenses.map(x=>[fmtD(x.date||x.data),esc(x.description||x.descricao||x.nome),esc(x.category||x.categoria||'Operacional'),fmt(x.amount||x.valor)])):emptyState('fa-receipt','Sem despesas','Registe combustível, materiais, deslocações e outros custos directos.'));
  } else if(activeTab==='hours'){
    body='<div class="ks-project-toolbar"><button class="btn btn-success" onclick="adicionarHorasProjeto('+Number(project.id)+')"><i class="fas fa-plus"></i> Registar horas</button></div>'+
      (projectHours.filter(idMatch).length?table(['Data','Colaborador','Actividade','Horas'],projectHours.filter(idMatch).map(x=>[fmtD(x.date||x.data),esc(x.resource_name||x.recurso||'—'),esc(x.description||x.actividade||'—'),Number(x.hours||x.horas||0)+' h'])):emptyState('fa-clock','Sem horas registadas','Registe o tempo de trabalho da equipa.'));
  } else {
    body='<div class="ks-project-toolbar"><button class="btn btn-success" onclick="adicionarMembroProjeto('+Number(project.id)+')"><i class="fas fa-user-plus"></i> Associar colaborador</button></div>'+
      (projectMembers.length?table(['Colaborador','Função','Atribuído em'],projectMembers.map(x=>[esc(x.full_name||x.nome||x.member_name||x.user_id),esc(x.role||x.funcao||'Técnico'),fmtD(x.assigned_at||x.data)])):emptyState('fa-users','Equipa por associar','Associe os técnicos e responsáveis deste projecto.'));
  }
  openModal((project.project_code||project.codigo||'Projecto')+' — '+(project.title||project.nome),'<div class="ks-project-detail">'+nav+'<div class="ks-project-detail-body">'+body+'</div></div>',true);
}

async function alterarEstadoProjeto(id) {
  const project=await DB.get('projetos',id);if(!project)return;
  const options=KS_PROJECT_STATUS.map(x=>'<option value="'+x[0]+'" '+(project.status===x[0]?'selected':'')+'>'+x[1]+'</option>').join('');
  openModal('Alterar estado do projecto','<div class="form-group"><label for="pjNewStatus">Novo estado</label><select id="pjNewStatus">'+options+'</select></div><div class="ks-form-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="confirmarEstadoProjeto('+Number(id)+')">Guardar estado</button></div>');
}
async function confirmarEstadoProjeto(id) {
  const p=await DB.get('projetos',id);if(!p)return;
  const oldStatus=p.status;p.status=$('pjNewStatus').value;p.updated_at=now();
  if(p.status==='concluido'){p.end_date=p.end_date||now().slice(0,10);p.progresso=100;}
  else if(oldStatus==='concluido')p.end_date=null;
  await saveData('projetos',p);toast('Estado actualizado: '+ksProjectStatusLabel(p.status)+'.','success');closeModal();openModule('projetos');
}
async function adicionarTarefaProjeto(projectId) {
  const team=await ksGetProjectTeam(),opts=team.map(m=>'<option value="'+esc(m.user_id||m.id)+'">'+esc(m.full_name||m.nome||m.name||'Colaborador')+'</option>').join('');
  openModal('Nova tarefa do projecto','<div class="form-grid"><div class="form-group full"><label>Título *</label><input id="ksPTaskTitle" maxlength="180"></div><div class="form-group"><label>Responsável</label><select id="ksPTaskAssignee"><option value="">Por atribuir</option>'+opts+'</select></div><div class="form-group"><label>Prioridade</label><select id="ksPTaskPriority"><option>Normal</option><option>Baixa</option><option>Alta</option><option>Urgente</option></select></div><div class="form-group"><label>Prazo</label><input id="ksPTaskDue" type="date"></div></div><button class="btn btn-primary btn-block" onclick="guardarTarefaProjeto('+Number(projectId)+')">Guardar tarefa</button>');
}
async function guardarTarefaProjeto(projectId) {
  const title=$('ksPTaskTitle').value.trim();if(!title){toast('Informe o título da tarefa.','warning');return;}
  const member=ksProjectMembersCache.find(m=>String(m.user_id||m.id)===$('ksPTaskAssignee').value);
  await saveData('tarefasProjetos',{project_id:projectId,title,assignee_id:$('ksPTaskAssignee').value||null,assignee_name:member?.full_name||member?.nome||member?.name||null,priority:$('ksPTaskPriority').value,due_date:$('ksPTaskDue').value||null,status:'planeamento',created_at:now()});
  toast('Tarefa adicionada ao projecto.','success');abrirDetalheProjeto(projectId,'tasks');
}
function adicionarDespesaProjeto(projectId) {
  openModal('Registar despesa do projecto','<div class="form-grid"><div class="form-group full"><label>Descrição *</label><input id="ksPExpenseDesc" placeholder="Ex.: combustível, cabos, consumíveis"></div><div class="form-group"><label>Categoria</label><select id="ksPExpenseCategory"><option>Materiais</option><option>Deslocação</option><option>Combustível</option><option>Alimentação</option><option>Subcontratação</option><option>Outro</option></select></div><div class="form-group"><label>Valor (Kz)</label><input id="ksPExpenseAmount" type="number" min="0" step="0.01"></div><div class="form-group"><label>Data</label><input id="ksPExpenseDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div></div><button class="btn btn-primary btn-block" onclick="guardarDespesaProjeto('+Number(projectId)+')">Guardar despesa</button>');
}
async function guardarDespesaProjeto(projectId) {
  const description=$('ksPExpenseDesc').value.trim(),amount=Number($('ksPExpenseAmount').value);
  if(!description||!Number.isFinite(amount)||amount<=0){toast('Informe a descrição e um valor superior a zero.','warning');return;}
  await saveData('atividadesProjetos',{project_id:projectId,kind:'expense',description,category:$('ksPExpenseCategory').value,amount,date:$('ksPExpenseDate').value||new Date().toISOString().slice(0,10),created_at:now()});
  toast('Despesa registada no projecto.','success');abrirDetalheProjeto(projectId,'expenses');
}
async function adicionarHorasProjeto(projectId) {
  const team=await ksGetProjectTeam(),opts=team.map(m=>'<option value="'+esc(m.user_id||m.id)+'">'+esc(m.full_name||m.nome||m.name||'Colaborador')+'</option>').join('');
  openModal('Registar horas de trabalho','<div class="form-grid"><div class="form-group"><label>Colaborador</label><select id="ksPTimeMember">'+opts+'</select></div><div class="form-group"><label>Horas</label><input id="ksPTimeHours" type="number" min="0.25" max="24" step="0.25"></div><div class="form-group"><label>Data</label><input id="ksPTimeDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div><div class="form-group full"><label>Actividade realizada</label><input id="ksPTimeDesc" placeholder="Descreva o trabalho realizado"></div></div><button class="btn btn-primary btn-block" onclick="guardarHorasProjeto('+Number(projectId)+')">Guardar registo de horas</button>');
}
async function guardarHorasProjeto(projectId) {
  const hours=Number($('ksPTimeHours').value),member=ksProjectMembersCache.find(m=>String(m.user_id||m.id)===$('ksPTimeMember').value);
  if(!Number.isFinite(hours)||hours<=0||hours>24){toast('Introduza um número de horas entre 0,25 e 24.','warning');return;}
  await saveData('timesheets',{project_id:projectId,resource_id:$('ksPTimeMember').value||null,resource_name:member?.full_name||member?.nome||member?.name||'Colaborador',hours,date:$('ksPTimeDate').value,description:$('ksPTimeDesc').value.trim(),created_at:now()});
  toast('Horas registadas.','success');abrirDetalheProjeto(projectId,'hours');
}
async function adicionarMembroProjeto(projectId) {
  const team=await ksGetProjectTeam(),existing=await getData('membrosProjetos'),assigned=existing.filter(x=>String(x.project_id||x.projectId)===String(projectId)).map(x=>String(x.user_id||x.member_id));
  const opts=team.filter(m=>!assigned.includes(String(m.user_id||m.id))).map(m=>'<option value="'+esc(m.user_id||m.id)+'">'+esc(m.full_name||m.nome||m.name||'Colaborador')+' · '+esc(m.role||m.cargo||'Equipa')+'</option>').join('');
  openModal('Associar colaborador','<div class="form-group"><label>Colaborador</label><select id="ksPNewMember">'+opts+'</select></div><button class="btn btn-primary btn-block" onclick="guardarMembroProjeto('+Number(projectId)+')">Associar ao projecto</button>');
}
async function guardarMembroProjeto(projectId) {
  const userId=$('ksPNewMember').value;if(!userId){toast('Não há colaboradores disponíveis para associar.','warning');return;}
  const m=ksProjectMembersCache.find(x=>String(x.user_id||x.id)===String(userId));
  await saveData('membrosProjetos',{project_id:projectId,user_id:userId,full_name:m?.full_name||m?.nome||m?.name||'Colaborador',role:m?.role||m?.cargo||'Técnico',assigned_at:now()});
  toast('Colaborador associado.','success');abrirDetalheProjeto(projectId,'team');
}

/* Keep the established company settings handlers and data adapters. */
const ksBaseRenderConfig = renderConfig;
const ksBaseSaveCompanyConfig = salvarConfigEmpresa;
async function renderConfig() {
  let html=await ksBaseRenderConfig();
  if(!html||html.includes('Sem permissão'))return html;
  html=html.replace(/<div class="form-group"><label>Banco<\/label>[\s\S]*?<\/div><div class="form-group full"><label>IBAN<\/label>[\s\S]*?<\/div>/,
    '<div class="form-group full"><div id="cfgBankAccounts" class="ks-bank-accounts"></div></div>');
  html=html.replace(/(<div class="form-group"><label>Nº Alvará<\/label><input id="cfgAlvara"[^>]*><\/div>)/,
    '$1<div class="form-group"><label for="cfgRegistry">Conservatória / Registo comercial</label><input id="cfgRegistry" value="'+esc((JSON.parse(localStorage.getItem('kanawa_empresa')||'{}')).registoComercial||'')+'" placeholder="Número de registo"></div><div class="form-group"><label for="cfgCapital">Capital social (Kz)</label><input id="cfgCapital" type="number" min="0" value="'+Number((JSON.parse(localStorage.getItem('kanawa_empresa')||'{}')).capitalSocial||0)+'"></div>');
  const bankAccounts=(JSON.parse(localStorage.getItem('kanawa_empresa')||'{}')).contasBancarias||[];
  window.setTimeout(()=>ksEnhanceSettingsScreen(bankAccounts),0);
  return html;
}
function ksEnhanceSettingsScreen(bankAccounts) {
  const root=$('content');if(!root||!root.querySelector('#cfgBankAccounts'))return;
  ksRenderBankAccounts(bankAccounts);
  const allCards=Array.from(root.querySelectorAll(':scope > .card'));
  const cards=allCards.slice(1);
  const navItems=[
    ['empresa','Perfil da empresa','fa-building'],['regras','Regras do sistema','fa-sliders-h'],
    ['aparencia','Faturação e design','fa-file-invoice'],['seguranca','Segurança e acesso','fa-shield-alt'],
    ['dados','Sincronização e dados','fa-database'],['ferramentas','Ferramentas','fa-tools']
  ];
  const classify=card=>{
    const title=(card.querySelector('.card-title,.card-header h3,h3')?.textContent||'').toLowerCase();
    if(title.includes('dados da empresa'))return 'empresa';
    if(title.includes('regras do sistema'))return 'regras';
    if(title.includes('modelos de faturação'))return 'aparencia';
    if(title.includes('sms')||title.includes('acesso por'))return 'seguranca';
    if(title.includes('ligação e armazenamento')||title.includes('armazenamento local'))return 'dados';
    if(title.includes('ferramentas'))return 'ferramentas';
    return 'dados';
  };
  cards.forEach(card=>card.dataset.settingsSection=classify(card));
  const nav=document.createElement('nav');nav.className='ks-settings-nav';nav.setAttribute('aria-label','Secções de configurações');
  nav.innerHTML=navItems.map((x,i)=>'<button type="button" class="ks-settings-tab'+(i===0?' active':'')+'" data-settings-tab="'+x[0]+'"><i class="fas '+x[2]+'"></i><span>'+x[1]+'</span></button>').join('');
  const headerCard=root.querySelector(':scope > .card');
  if(headerCard)headerCard.insertAdjacentElement('afterend',nav);else root.prepend(nav);
  const activate=key=>{
    nav.querySelectorAll('[data-settings-tab]').forEach(b=>{const on=b.dataset.settingsTab===key;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');});
    cards.forEach(card=>{card.hidden=card.dataset.settingsSection!==key;});
  };
  nav.querySelectorAll('[data-settings-tab]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.settingsTab)));
  activate('empresa');
  const storageCard=cards.find(c=>c.dataset.settingsSection==='dados'&&c.textContent.toLowerCase().includes('coleção'));
  if(storageCard){
    const heading=storageCard.querySelector('h3');
    if(heading)heading.insertAdjacentHTML('afterend','<p class="ks-settings-note">Contagem lida directamente do IndexedDB neste dispositivo. A fila _sync_queue indica operações pendentes de sincronização.</p>');
    storageCard.querySelectorAll('tbody tr').forEach(row=>{
      const collection=row.querySelector('code')?.textContent;
      const action=row.querySelector('button');
      if(collection==='_sync_queue'&&action)action.textContent='Ver fila';
    });
  }
}
function ksRenderBankAccounts(accounts) {
  const host=$('cfgBankAccounts');if(!host)return;
  const rows=Array.isArray(accounts)?accounts:[];
  host.innerHTML='<div class="ks-bank-head"><div><strong>Contas bancárias da empresa</strong><small>Escolha a conta principal que poderá ser apresentada nos documentos.</small></div><button type="button" class="btn btn-secondary btn-sm" onclick="ksAddBankAccount()"><i class="fas fa-plus"></i> Adicionar banco</button></div>'+
    '<div class="ks-bank-list">'+(rows.length?rows.map((x,i)=>'<div class="ks-bank-row" data-bank-index="'+i+'"><label class="ks-bank-default"><input type="radio" name="ksBankDefault" '+(x.padrao?'checked':'')+' onchange="ksSetDefaultBank('+i+')"><span>Padrão</span></label><div class="form-group"><label>Banco</label><input data-bank-name value="'+esc(x.banco||'')+'" placeholder="BAI, BFA, BIC…"></div><div class="form-group"><label>IBAN</label><input data-bank-iban maxlength="34" value="'+esc(x.iban||'')+'" placeholder="AO06…"></div><button type="button" class="btn btn-sm btn-danger" onclick="ksRemoveBankAccount('+i+')" aria-label="Remover conta"><i class="fas fa-trash"></i></button></div>').join(''):'<p class="ks-empty-banks">Ainda não existem contas bancárias. Use “Adicionar banco” para cadastrar uma.</p>')+'</div>';
}
function ksReadBankAccounts() {
  return Array.from(document.querySelectorAll('.ks-bank-row')).map((row,i)=>({
    banco:row.querySelector('[data-bank-name]')?.value.trim()||'',
    iban:(row.querySelector('[data-bank-iban]')?.value||'').replace(/\s+/g,'').toUpperCase(),
    padrao:!!row.querySelector('input[type=radio]')?.checked
  })).filter(x=>x.banco||x.iban).map((x,i,a)=>Object.assign(x,{padrao:a.some(y=>y.padrao)?x.padrao:i===0}));
}
function ksAddBankAccount() {
  const accounts=ksReadBankAccounts();accounts.push({banco:'',iban:'',padrao:accounts.length===0});ksRenderBankAccounts(accounts);
  const inputs=document.querySelectorAll('.ks-bank-row [data-bank-name]');inputs[inputs.length-1]?.focus();
}
function ksSetDefaultBank(index) {
  const accounts=ksReadBankAccounts().map((x,i)=>Object.assign({},x,{padrao:i===index}));ksRenderBankAccounts(accounts);
}
function ksRemoveBankAccount(index) {
  const accounts=ksReadBankAccounts().filter((_,i)=>i!==index);
  if(accounts.length&&!accounts.some(x=>x.padrao))accounts[0].padrao=true;
  ksRenderBankAccounts(accounts);
}
async function salvarConfigEmpresa() {
  const accounts=ksReadBankAccounts();
  if(accounts.some(x=>!x.banco||!/^AO\d{2}[A-Z0-9]{20,30}$/.test(x.iban.replace(/[.\s-]/g,'')))) {
    toast('Verifique o nome do banco e o formato do IBAN. Use AO + 2 dígitos de controlo + identificador bancário.','warning');return;
  }
  const existing=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
  const primary=accounts.find(x=>x.padrao)||accounts[0]||{};
  if($('cfgBanco'))$('cfgBanco').value=primary.banco||'';
  if($('cfgIban'))$('cfgIban').value=primary.iban||'';
  await ksBaseSaveCompanyConfig();
  const updated=Object.assign({},JSON.parse(localStorage.getItem('kanawa_empresa')||'{}'),{
    registoComercial:$('cfgRegistry')?.value.trim()||existing.registoComercial||'',
    capitalSocial:Math.max(0,num($('cfgCapital')?.value,existing.capitalSocial||0)),
    contasBancarias:accounts
  });
  localStorage.setItem('kanawa_empresa',JSON.stringify(updated));
  try { await saveData('empresaConfig',Object.assign({id:'company-config'},updated)); }
  catch(error){console.warn('Contas bancárias guardadas localmente; sincronização pendente:',error);}
  toast('Dados da empresa e contas bancárias guardados.','success');
}

/* Public functions stay available to inline event handlers in the legacy app. */
window.abrirModalProjeto=abrirModalProjeto;
window.salvarProjeto=salvarProjeto;
window.abrirDetalheProjeto=abrirDetalheProjeto;
window.alterarEstadoProjeto=alterarEstadoProjeto;
window.confirmarEstadoProjeto=confirmarEstadoProjeto;
window.adicionarTarefaProjeto=adicionarTarefaProjeto;
window.guardarTarefaProjeto=guardarTarefaProjeto;
window.adicionarDespesaProjeto=adicionarDespesaProjeto;
window.guardarDespesaProjeto=guardarDespesaProjeto;
window.adicionarHorasProjeto=adicionarHorasProjeto;
window.guardarHorasProjeto=guardarHorasProjeto;
window.adicionarMembroProjeto=adicionarMembroProjeto;
window.guardarMembroProjeto=guardarMembroProjeto;
window.ksAddBankAccount=ksAddBankAccount;
window.ksSetDefaultBank=ksSetDefaultBank;
window.ksRemoveBankAccount=ksRemoveBankAccount;
