/* Kanawa Soft ERP — navegação ultra-slim por 10 categorias.
 * Mantém MENU_GROUPS, MENU_INTERNAL_TABS e os controlos de permissões/licenciamento.
 */
function renderSidebar() {
  const sidebar = $('sidebar');
  if (!sidebar) return;
  const groups = Array.isArray(MENU_GROUPS) ? MENU_GROUPS : [];
  if (!groups.some(group => group.id === expandedMenuGroup)) expandedMenuGroup = groups[0]?.id || null;
  const labels = { vendas:'Vendas', produtos:'Produtos', producao:'Produção', clientes:'Clientes/CRM',
    financeiro:'Finanças', rh:'RH', projetos:'Projetos', ativos:'Frotas', administracao:'Admin', formacao:'EAD' };
  sidebar.classList.remove('mega-menu-hidden', 'mobile-open');
  sidebar.classList.add('kanawa-ultra-sidebar');
  sidebar.setAttribute('aria-label', '10 categorias principais');
  sidebar.innerHTML = '<nav class="kanawa-category-nav" aria-label="Categorias do ERP">' +
    groups.map(group => {
      const accessible = group.items.filter(item => podeAcessar(item.id));
      const selected = group.id === expandedMenuGroup;
      const disabled = accessible.length === 0;
      return '<button type="button" class="kanawa-category-shortcut' +
        (selected ? ' is-active' : '') + (disabled ? ' is-disabled' : '') +
        '" data-group="' + esc(group.id) + '" title="' + esc(group.label) +
        (disabled ? ' — sem módulos disponíveis para este perfil' : '') + '"' +
        (disabled ? ' disabled aria-disabled="true"' : ' aria-current="' + (selected ? 'page' : 'false') + '"') + '>' +
        '<i class="fas ' + esc(group.icon || 'fa-layer-group') + '" aria-hidden="true"></i>' +
        '<span>' + esc(labels[group.id] || group.label) + '</span></button>';
    }).join('') + '</nav>';
  sidebar.querySelectorAll('.kanawa-category-shortcut:not(:disabled)').forEach(button => {
    button.addEventListener('click', () => openMenuGroupScreen(button.dataset.group));
  });
}

function renderCategoryHub(groupId, activeAnchorId) {
  const group = MENU_GROUPS.find(item => item.id === groupId);
  const content = $('content');
  if (!group || !content) return;
  const anchors = group.items.filter(item => podeAcessar(item.id));
  if (!anchors.length) { toast('Não existem módulos disponíveis nesta categoria para o seu perfil.', 'info'); return; }
  const active = anchors.find(item => item.id === activeAnchorId) || anchors[0];
  const tabs = anchors.map(item =>
    '<button type="button" class="kanawa-hub-tab' + (item.id === active.id ? ' is-active' : '') +
    '" data-hub-anchor="' + esc(item.id) + '" role="tab" aria-selected="' + (item.id === active.id ? 'true' : 'false') + '">' +
    '<i class="fas ' + esc(item.icon || 'fa-cube') + '" aria-hidden="true"></i><span>' + esc(item.label) + '</span></button>'
  ).join('');
  const ids = [active.id].concat(MENU_INTERNAL_TABS[active.id] || []);
  const seen = new Set();
  const cards = ids.map(id => {
    if (seen.has(id)) return '';
    const item = MENU.find(entry => entry.id === id);
    if (!item || !podeAcessar(id)) return '';
    seen.add(id);
    const locked = !planoPermiteModulo(id);
    return '<button type="button" class="kanawa-hub-module' + (locked ? ' is-locked' : '') +
      '" data-hub-module="' + esc(id) + '"><span class="kanawa-hub-module-icon"><i class="fas ' +
      esc(item.icon || 'fa-cube') + '" aria-hidden="true"></i></span><span class="kanawa-hub-module-copy"><strong>' +
      esc(item.label) + '</strong><small>' + (locked ? 'Disponível num plano superior' : (id === active.id ? 'Abrir área principal' : 'Abrir submódulo')) +
      '</small></span><i class="fas ' + (locked ? 'fa-lock' : 'fa-arrow-up-right-from-square') +
      ' kanawa-hub-module-arrow" aria-hidden="true"></i></button>';
  }).join('');
  content.innerHTML = '<section class="kanawa-category-hub" aria-label="' + esc(group.label) + '">' +
    '<header class="kanawa-hub-header"><div><span class="kanawa-hub-eyebrow">ÁREA DE TRABALHO</span><h2><i class="fas ' +
    esc(group.icon || 'fa-layer-group') + '" aria-hidden="true"></i> ' + esc(group.label) +
    '</h2><p>Escolha uma área ou submódulo para abrir no espaço de trabalho.</p></div><span class="kanawa-hub-count">' +
    seen.size + ' atalhos</span></header><nav class="kanawa-hub-tabs" role="tablist" aria-label="Áreas de ' +
    esc(group.label) + '">' + tabs + '</nav><div class="kanawa-hub-section-head"><h3>' + esc(active.label) +
    '</h3><span>Áreas e ferramentas</span></div><div class="kanawa-hub-grid">' + cards + '</div></section>';
  content.querySelectorAll('[data-hub-anchor]').forEach(button => {
    button.addEventListener('click', () => renderCategoryHub(groupId, button.dataset.hubAnchor));
  });
  content.querySelectorAll('[data-hub-module]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.hubModule;
      if (!planoPermiteModulo(id)) mostrarUpsellModulo(id);
      else openModule(id);
    });
  });
  content.scrollTop = 0;
  content.setAttribute('aria-label', 'Painel da categoria ' + group.label);
}

function toggleMegaMenu() { openModule('dashboard'); }

function pesquisarModuloTopbar(query) {
  const box = $('topbarModuleResults');
  if (!box) return;
  const term = String(query || '').trim().toLocaleLowerCase('pt');
  if (!term) { box.classList.remove('is-visible'); box.innerHTML = ''; return; }
  const matches = MENU.filter(item =>
    (item.id === 'dashboard' || MENU_GROUPED_IDS.has(item.id) || Object.prototype.hasOwnProperty.call(MENU_MODULE_PARENT, item.id)) &&
    podeAcessar(item.id) && String(item.label || '').toLocaleLowerCase('pt').includes(term)
  ).slice(0, 10);
  box.innerHTML = matches.length ? matches.map(item =>
    '<button type="button" class="topbar-module-result" role="option" data-search-module="' + esc(item.id) +
    '"><i class="fas ' + esc(item.icon) + '" aria-hidden="true"></i><span>' + esc(item.label) + '</span></button>'
  ).join('') : '<div class="topbar-module-empty">Nenhum módulo encontrado ou disponível para o seu perfil.</div>';
  box.classList.add('is-visible');
  box.querySelectorAll('[data-search-module]').forEach(button => button.addEventListener('click', () => selecionarModuloPesquisa(button.dataset.searchModule)));
}
function selecionarModuloPesquisa(id) {
  const input = $('topbarModuleSearch'), box = $('topbarModuleResults');
  if (input) input.value = '';
  if (box) { box.classList.remove('is-visible'); box.innerHTML = ''; }
  openModule(id);
}
function teclaPesquisaModulo(event) {
  if (event.key === 'Escape') {
    const box = $('topbarModuleResults');
    if (box) box.classList.remove('is-visible');
    event.target.blur();
  }
  if (event.key === 'Enter') {
    const first = $('topbarModuleResults')?.querySelector('.topbar-module-result');
    if (first) first.click();
  }
}
function toggleMenuGroup(groupId) { openMenuGroupScreen(groupId); }
