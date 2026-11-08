/* Kanawa Soft ERP 1.0 — gráficos e feedback de gravação, integrado ao menu responsivo existente. */
(function () {
  'use strict';
  let salesChart = null;
  let goalChart = null;
  let saveCount = 0;

  /* Não substitui o menu já existente: apenas inicializa os gráficos ao abrir o dashboard. */
  const originalOpenModule = window.openModule;
  if (originalOpenModule) {
    window.openModule = async function (id) {
      const result = await originalOpenModule.apply(this, arguments);
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


  /* Dashboard chart styles: classic and enhanced, persisted per browser. */
  const chartStyleKey = 'kanawa-dashboard-chart-style';
  function currentChartStyle() {
    try { return localStorage.getItem(chartStyleKey) === 'classic' ? 'classic' : 'enhanced'; }
    catch (_) { return 'enhanced'; }
  }
  function applyChartStyle(style) {
    const selected = style === 'classic' ? 'classic' : 'enhanced';
    document.documentElement.setAttribute('data-dashboard-chart-style', selected);
    const button = document.getElementById('dashboardChartStyleToggle');
    if (button) {
      button.textContent = selected === 'classic' ? 'Usar visual aprimorado' : 'Usar visual clássico';
      button.setAttribute('aria-pressed', selected === 'classic' ? 'true' : 'false');
    }
    if (salesChart) {
      const dataset = salesChart.data.datasets[0];
      dataset.backgroundColor = selected === 'classic' ? 'rgba(71,85,105,.72)' : 'rgba(37,99,235,.78)';
      dataset.borderColor = selected === 'classic' ? '#475569' : '#2563eb';
      salesChart.options.plugins.legend.display = selected === 'classic';
      if (salesChart.options.scales.x && salesChart.options.scales.x.grid) salesChart.options.scales.x.grid.color = selected === 'classic' ? 'rgba(100,116,139,.18)' : 'rgba(148,163,184,.10)';
      if (salesChart.options.scales.y && salesChart.options.scales.y.grid) salesChart.options.scales.y.grid.color = selected === 'classic' ? 'rgba(100,116,139,.22)' : 'rgba(148,163,184,.12)';
      salesChart.update();
    }
    if (goalChart) {
      goalChart.data.datasets[0].backgroundColor = selected === 'classic'
        ? ['#64748b', '#cbd5e1'] : ['#10b981', '#dbeafe'];
      goalChart.update();
    }
  }
  window.alternarEstiloGraficos = function () {
    const next = currentChartStyle() === 'classic' ? 'enhanced' : 'classic';
    try { localStorage.setItem(chartStyleKey, next); } catch (_) {}
    applyChartStyle(next);
  };
  function ensureChartStyleControl() {
    const area = document.querySelector('.dashboard-charts');
    if (!area) return;
    let control = document.getElementById('dashboardChartStyleToggle');
    if (!control) {
      control = document.createElement('button');
      control.id = 'dashboardChartStyleToggle';
      control.type = 'button';
      control.className = 'dashboard-chart-style-toggle';
      control.addEventListener('click', window.alternarEstiloGraficos);
      area.insertBefore(control, area.firstChild);
    }
    applyChartStyle(currentChartStyle());
  }
  const chartStyleCss = document.createElement('style');
  chartStyleCss.textContent = `
    .dashboard-chart-style-toggle{display:inline-flex;align-items:center;justify-content:center;margin:0 0 14px auto;padding:10px 15px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#1e293b;font-weight:700;cursor:pointer;box-shadow:0 3px 12px rgba(15,23,42,.09);transition:transform .2s,box-shadow .2s}
    .dashboard-chart-style-toggle:hover{transform:translateY(-2px);box-shadow:0 7px 18px rgba(15,23,42,.14)}
    .dashboard-chart-style-toggle{flex-basis:100%;width:max-content}
    .dashboard-chart-card{transition:background .2s,border-color .2s,box-shadow .2s}
    [data-dashboard-chart-style="classic"] .dashboard-chart-card{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;box-shadow:none}
    [data-dashboard-chart-style="classic"] .dashboard-chart-card h3{color:#334155;font-family:Georgia,serif}
    [data-dashboard-chart-style="enhanced"] .dashboard-chart-card{background:linear-gradient(145deg,#fff,#f5f8ff);border:1px solid #dbeafe;border-radius:16px;box-shadow:0 10px 28px rgba(37,99,235,.09)}
    [data-dashboard-chart-style="enhanced"] .dashboard-chart-card h3{color:#1d4ed8}
    @media(max-width:640px){.dashboard-chart-style-toggle{width:100%;margin-bottom:10px}.dashboard-chart-card{min-width:0;width:100%}}
  `;
  document.head.appendChild(chartStyleCss);
  const originalChartInitializer = window.inicializarDashboardGraficos;
  if (originalChartInitializer) {
    window.inicializarDashboardGraficos = async function () {
      const result = await originalChartInitializer.apply(this, arguments);
      ensureChartStyleControl();
      applyChartStyle(currentChartStyle());
      return result;
    };
  }

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

})();
