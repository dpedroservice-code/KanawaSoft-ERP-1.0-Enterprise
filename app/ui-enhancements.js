/* Kanawa Soft ERP 1.0 — UI enhancements, safe extension layer */
(function () {
  'use strict';

  const GROUPS = [
    { id: 'overview', label: 'Visão Geral', icon: 'fa-chart-pie', match: id => id === 'dashboard' },
    { id: 'commercial', label: 'Comercial', icon: 'fa-cash-register', match: id => ['pdv','vendas','orcamentos','produtos','categorias','servicos','produtos-avaliacoes','tabelas-precos'].includes(id) },
    { id: 'customers', label: 'Clientes & CRM', icon: 'fa-handshake', match: id => ['clientes','crm','crm-pipeline','crm-automacao','crm-score','crm-remarketing','clientes-fidelidade','clientes-cupons','clientes-segmentacao','portal-cliente','marketing-campanhas','marketing-analise'].includes(id) },
    { id: 'stock', label: 'Stock & Compras', icon: 'fa-warehouse', match: id => ['estoque','compras','fornecedores','transportadoras'].includes(id) },
    { id: 'production', label: 'Produção', icon: 'fa-industry', match: id => ['producao','ordens-producao','mrp','bom','custos-producao','controle-qualidade','planos-producao'].includes(id) },
    { id: 'finance', label: 'Finanças & Fiscal', icon: 'fa-coins', match: id => ['contabilidade','financeiro','fiscal','orcamento-empresa','despesas-gerais'].includes(id) },
    { id: 'people', label: 'Recursos Humanos', icon: 'fa-users', match: id => id === 'rh' || id.startsWith('rh-') || ['folha-salarial','ferias-dispensas'].includes(id) },
    { id: 'projects', label: 'Projetos & Tarefas', icon: 'fa-diagram-project', match: id => ['projetos','tarefas'].includes(id) || id.startsWith('projetos-') },
    { id: 'logistics', label: 'Logística & Frota', icon: 'fa-truck', match: id => id.startsWith('logistica-') || id === 'frota' || id.startsWith('frota-') },
    { id: 'assets', label: 'Activos & Serviços', icon: 'fa-screwdriver-wrench', match: id => ['ativos','os','contratos','tickets'].includes(id) || id.startsWith('ativos-') || id.startsWith('os-') },
    { id: 'digital', label: 'E-commerce', icon: 'fa-store', match: id => id === 'ecommerce' || id.startsWith('ecommerce-') },
    { id: 'learning', label: 'Academia & Formação', icon: 'fa-graduation-cap', match: id => id.startsWith('elearning-') },
    { id: 'company', label: 'Empresa & Administração', icon: 'fa-building', match: id => ['empresa-legal','licenca','agenda','reunioes','comunicacao','aprovacoes-empresa','departamentos-empresa','rh-documentos','integracoes','conformidade','documentos','relatorios','notificacoes','usuarios','auditoria','perfil','dispositivos','config','modulos'].includes(id) }
  ];

  let expandedGroup = 'overview';
  let salesChart = null;
  let goalChart = null;
  let saveCount = 0;

  function groupFor(id) {
    return GROUPS.find(group => group.match(id)) || GROUPS[GROUPS.length - 1];
  }

  window.toggleMenuGroup = function (groupId) {
    const group = GROUPS.find(item => item.id === groupId);
    if (!group) return;
    const items = MENU.filter(item => podeAcessar(item.id) && group.match(item.id));
    if (items.length === 1) {
      window.openModule(items[0].id);
      expandedGroup = groupId;
      return;
    }
    expandedGroup = expandedGroup === groupId ? '' : groupId;
    renderGroupedSidebar();
  };

  function renderGroupedSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || typeof MENU === 'undefined') return;
    const available = MENU.filter(item => podeAcessar(item.id));
    const groups = GROUPS.map(group => ({
      ...group,
      items: available.filter(item => group.match(item.id))
    })).filter(group => group.items.length);
    const activeGroup = groupFor(currentModule);
    if (activeGroup && expandedGroup === 'overview' && currentModule !== 'dashboard') expandedGroup = activeGroup.id;

    sidebar.innerHTML = groups.map(group => {
      const active = group.id === activeGroup.id;
      const open = expandedGroup === group.id;
      const children = group.items.map(item =>
        '<button type="button" class="sidebar-item' + (item.id === currentModule ? ' active' : '') +
        '" data-id="' + esc(item.id) + '" onclick="openModule(\'' + esc(item.id) + '\')">' +
        '<i class="fas ' + esc(item.icon) + '"></i><span>' + esc(item.label) + '</span></button>'
      ).join('');
      return '<section class="menu-group' + (open ? ' open' : '') + (active ? ' active' : '') + '" data-group="' + group.id + '">' +
        '<button type="button" class="menu-group-toggle" aria-expanded="' + (open ? 'true' : 'false') +
        '" onclick="toggleMenuGroup(\'' + group.id + '\')"><i class="fas ' + group.icon + '"></i><span>' +
        group.label + '</span></button><div class="menu-group-items"><div class="menu-group-items-inner">' +
        children + '</div></div></section>';
    }).join('');
  }

  const originalSidebar = window.renderSidebar;
  window.renderSidebar = function () {
    if (typeof MENU !== 'undefined' && typeof podeAcessar === 'function') return renderGroupedSidebar();
    if (originalSidebar) return originalSidebar();
  };

  const originalOpenModule = window.openModule;
  if (originalOpenModule) {
    window.openModule = async function (id) {
      expandedGroup = groupFor(id).id;
      const result = await originalOpenModule(id);
      renderGroupedSidebar();
      if (id === 'dashboard') {
        try { await window.inicializarDashboardGraficos(6); }
        catch (error) { console.warn('Dashboard charts:', error); }
      }
      return result;
    };
  }

  const originalDashboard = window.renderDashboard;
  if (originalDashboard) {
    window.renderDashboard = async function () {
      const base = await originalDashboard();
      return base +
        '<section class="dashboard-charts">' +
          '<article class="dashboard-chart-card">' +
            '<div class="chart-heading"><h3><i class="fas fa-chart-line"></i> Evolução das vendas</h3>' +
            '<select class="dashboard-chart-select" aria-label="Período do gráfico" onchange="inicializarDashboardGraficos(Number(this.value))">' +
              '<option value="6" selected>Últimos 6 meses</option><option value="12">Últimos 12 meses</option></select></div>' +
            '<canvas id="dashSalesChart" role="img" aria-label="Gráfico de vendas por mês"></canvas>' +
          '</article>' +
          '<article class="dashboard-chart-card">' +
            '<div class="chart-heading"><h3><i class="fas fa-bullseye"></i> Meta anual</h3></div>' +
            '<div class="dashboard-goal-value" id="dashGoalValue">A calcular…</div>' +
            '<div class="dashboard-goal-note" id="dashGoalNote">Comparação entre vendas e orçamento aprovado</div>' +
            '<canvas id="dashGoalChart" role="img" aria-label="Progresso da meta anual"></canvas>' +
          '</article>' +
        '</section>';
    };
  }

  function parseSaleDate(sale) {
    const raw = sale.data || sale.created_at || sale.date || sale.dataVenda || sale.createdAt;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function monthKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function monthLabel(date) {
    return date.toLocaleDateString('pt-AO', { month: 'short', year: '2-digit' });
  }

  window.inicializarDashboardGraficos = async function (months) {
    const salesCanvas = document.getElementById('dashSalesChart');
    const goalCanvas = document.getElementById('dashGoalChart');
    if (!salesCanvas || !goalCanvas || typeof Chart === 'undefined') return;
    const period = Math.max(3, Math.min(24, Number(months) || 6));
    const [sales, localBudgets, productionPlans] = await Promise.all([
      getData('vendas'),
      getData('budgets').catch(() => []),
      getData('planosProducao').catch(() => [])
    ]);
    let budgets = localBudgets || [];
    if (window.KanawaCloud && KanawaCloud.ready && typeof KanawaCloud.listBudgets === 'function') {
      try {
        const remoteBudgets = await KanawaCloud.listBudgets();
        if (Array.isArray(remoteBudgets) && remoteBudgets.length) budgets = remoteBudgets;
      } catch (error) { console.warn('Não foi possível obter metas cloud:', error); }
    }

    const today = new Date();
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - period + 1, 1);
    const buckets = Array.from({ length: period }, (_, index) => {
      const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
      return { key: monthKey(date), label: monthLabel(date), total: 0 };
    });
    const bucketMap = new Map(buckets.map(item => [item.key, item]));
    (sales || []).forEach(sale => {
      const date = parseSaleDate(sale);
      if (!date) return;
      const bucket = bucketMap.get(monthKey(date));
      if (bucket) bucket.total += Number(sale.total || sale.valorTotal || 0);
    });

    const annualGoal = (budgets || []).filter(item => {
      const year = Number(item.fiscal_year || item.fiscalYear || item.ano || today.getFullYear());
      return year === today.getFullYear() && !['rejected', 'cancelled', 'cancelado', 'rejeitado'].includes(String(item.status || '').toLowerCase());
    }).reduce((sum, item) => sum + Number(item.approved_amount || item.amount || item.valor || 0), 0);
    const actual = (sales || []).reduce((sum, sale) => {
      const date = parseSaleDate(sale);
      return sum + (date && date.getFullYear() === today.getFullYear() ? Number(sale.total || sale.valorTotal || 0) : 0);
    }, 0);
    const remaining = Math.max(0, annualGoal - actual);
    const percent = annualGoal > 0 ? Math.min(100, Math.round(actual / annualGoal * 100)) : 0;

    if (salesChart) salesChart.destroy();
    salesChart = new Chart(salesCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: buckets.map(item => item.label),
        datasets: [{
          label: 'Vendas (Kz)',
          data: buckets.map(item => item.total),
          backgroundColor: 'rgba(37,99,235,.72)',
          borderColor: '#2563eb',
          borderWidth: 1,
          borderRadius: 7,
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: context => ' ' + new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(context.parsed.y || 0)
        } } },
        scales: { y: { beginAtZero: true, ticks: { callback: value => new Intl.NumberFormat('pt-AO', { notation: 'compact' }).format(value) } } }
      }
    });
    salesCanvas.parentElement.style.height = '330px';

    const goalValue = document.getElementById('dashGoalValue');
    const goalNote = document.getElementById('dashGoalNote');
    if (goalValue) goalValue.textContent = annualGoal > 0 ? percent + '% da meta anual' : 'Meta não definida';
    if (goalNote) goalNote.textContent = annualGoal > 0
      ? new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(actual) +
        ' realizado de ' + new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(annualGoal) +
        ' · ' + new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(remaining) + ' em falta'
      : 'Crie um orçamento aprovado no módulo Orçamento Empresarial para acompanhar a meta.';

    if (goalChart) goalChart.destroy();
    goalChart = new Chart(goalCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: annualGoal > 0 ? ['Realizado', 'Por alcançar'] : ['Meta por definir'],
        datasets: [{
          data: annualGoal > 0 ? [Math.min(actual, annualGoal), remaining] : [1],
          backgroundColor: annualGoal > 0 ? ['#10b981', '#e2e8f0'] : ['#94a3b8'],
          borderWidth: 0,
          hoverOffset: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
          tooltip: { callbacks: { label: context => context.label + ': ' +
            new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(context.parsed || 0) } } }
      }
    });
    goalCanvas.parentElement.style.height = '250px';

    const planNote = document.getElementById('dashGoalNote');
    const finishedPlans = (productionPlans || []).filter(plan => String(plan.status || '').toLowerCase() === 'concluido').length;
    if (planNote && productionPlans && productionPlans.length) {
      planNote.textContent += ' · Planos de produção concluídos: ' + finishedPlans + '/' + productionPlans.length;
    }
  };

  /* Show a lightweight animated saving indicator for all writes using saveData. */
  const originalSaveData = window.saveData;
  if (originalSaveData) {
    window.saveData = async function () {
      saveCount++;
      document.body.classList.add('is-saving');
      try {
        return await originalSaveData.apply(this, arguments);
      } finally {
        saveCount = Math.max(0, saveCount - 1);
        if (!saveCount) document.body.classList.remove('is-saving');
      }
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && typeof MENU !== 'undefined') renderGroupedSidebar();
  });
})();