/* Kanawa Soft ERP — componente visual do menu lateral/superior.
 * Depende dos dados e controlos globais definidos em app.js:
 * MENU_GROUPS, expandedMenuGroup, megaMenuVisible, $, podeAcessar(),
 * planoPermiteModulo(), getModuleRequiredPlan(), esc().
 * Não contém regras de negócio nem substitui permissões/licenciamento.
 */
function renderSidebar() {
 const sidebar=$('sidebar');if(!sidebar)return;
 const groups=MENU_GROUPS.map(group=>{const sections=group.sections.map(section=>({id:section.id,label:section.label,items:section.items.filter(item=>podeAcessar(item.id))})).filter(section=>section.items.length);return Object.assign({},group,{sections,items:sections.flatMap(section=>section.items)});}).filter(group=>group.items.length);
 if(!groups.some(group=>group.id===expandedMenuGroup))expandedMenuGroup=groups[0]?.id||null;
 const active=groups.find(group=>group.id===expandedMenuGroup)||groups[0];
 const planLabels={standard:'Standard',premium:'Premium',enterprise:'Enterprise'};
 const categoryTabs=groups.map(group=>{const selected=group.id===active?.id,locked=group.items.filter(item=>!planoPermiteModulo(item.id)).length;return '<button type="button" class="mega-menu-tab'+(selected?' active':'')+'" data-group="'+esc(group.id)+'" aria-pressed="'+(selected?'true':'false')+'" onclick="openMenuGroupScreen(\''+esc(group.id)+'\')"><i class="fas '+esc(group.icon)+'" aria-hidden="true"></i><span>'+esc(group.label)+'</span><small>'+group.items.length+'</small>'+(locked?'<i class="fas fa-lock menu-tab-lock" title="'+locked+' módulo(s) exigem upgrade"></i>':'')+'</button>';}).join('');
 const sectionHtml=(active?.sections||[]).map(section=>'<section class="mega-menu-subgroup"><h4 class="mega-menu-subgroup-title">'+esc(section.label)+'</h4><div class="mega-menu-grid">'+section.items.map(item=>{const locked=!planoPermiteModulo(item.id),plan=planLabels[getModuleRequiredPlan(item.id)]||'superior',moduleClass=locked?'class="mega-menu-module is-plan-locked"':'class="mega-menu-module"';return '<button type="button" '+moduleClass+' '+(locked?'aria-label="'+esc(item.label)+' — requer plano '+plan+'" onclick="mostrarUpsellModulo(\''+esc(item.id)+'\')"':'onclick="openModule(\''+esc(item.id)+'\')"')+'><span class="mega-menu-module-icon"><i class="fas '+esc(item.icon)+'" aria-hidden="true"></i></span><span class="mega-menu-module-copy"><strong>'+esc(item.label)+'</strong><small>'+(locked?'Disponível no plano '+plan:'Abrir módulo')+'</small></span><i class="fas '+(locked?'fa-lock':'fa-arrow-up-right-from-square')+' mega-menu-module-arrow" aria-hidden="true"></i></button>';}).join('')+'</div></section>').join('');
 try{sidebar.classList.toggle('is-compact',localStorage.getItem('kanawa-sidebar-compact')==='1')}catch(_){}
 const compact=sidebar.classList.contains('is-compact');
 sidebar.classList.toggle('mega-menu-hidden',!megaMenuVisible);
 sidebar.classList.toggle('is-compact',compact);
 sidebar.innerHTML='<div class="mega-menu-shell"><div class="mega-menu-categories" role="tablist" aria-label="Categorias do ERP"><button type="button" class="mega-menu-compact-toggle" onclick="toggleSidebarCompact()" aria-label="Recolher ou expandir menu" title="Recolher ou expandir menu"><i class="fas '+(compact?'fa-angles-right':'fa-angles-left')+'"></i></button><button type="button" class="mega-menu-tab mega-menu-home" onclick="openModule(\'dashboard\')"><i class="fas fa-home" aria-hidden="true"></i><span>Visão geral</span></button>'+categoryTabs+'</div><section class="mega-menu-panel" aria-label="Módulos da categoria '+esc(active?.label||'')+'"><div class="mega-menu-panel-head"><div><span class="mega-menu-eyebrow">NAVEGAÇÃO POR MÓDULO</span><h3><i class="fas '+esc(active?.icon||'fa-th')+'"></i> '+esc(active?.label||'Módulos')+'</h3></div><span class="mega-menu-total">'+(active?.items.length||0)+' atalhos</span></div>'+(sectionHtml||'<p class="mega-menu-empty">Não existem módulos disponíveis nesta categoria para o seu perfil.</p>')+'</section></div>';
}
function toggleSidebarCompact(force){
 const sidebar=document.getElementById('sidebar');if(!sidebar)return;
 const compact=typeof force==='boolean'?force:!sidebar.classList.contains('is-compact');
 sidebar.classList.toggle('is-compact',compact);
 try{localStorage.setItem('kanawa-sidebar-compact',compact?'1':'0')}catch(_){}
 const button=sidebar.querySelector('.mega-menu-compact-toggle');
 if(button){button.innerHTML='<i class="fas '+(compact?'fa-angles-right':'fa-angles-left')+'"></i>';button.setAttribute('aria-label',compact?'Expandir menu':'Recolher menu');button.title=compact?'Expandir menu':'Recolher menu'}
}
