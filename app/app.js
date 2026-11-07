'use strict';
/* KANAWA SOFT ERP 1.0 — aplicação principal unificada (perfil, AGT, firma, gaveta, impressora, líquido, produção, logística, ecommerce, RH, projetos, ativos, frota, OS, tickets, contratos, docs, auditoria, e-learning, CRM, marketing, integrações, dispositivos). */

const APP_VERSION = '1.0.0';
const IS_DESKTOP = !!(window.kanawaNative && window.kanawaNative.isDesktop);
let API_ONLINE = false;
let setupStep = 1;
let currentModule = 'dashboard';
let scanner = null, scannerActive = false, scannerCallback = null;
let syncTimer = null;
let pdvState = { screen: 1, carrinho: [], cliente: { nome: 'Cliente Anônimo', nif: '', telefone: '' }, pagamento: 'dinheiro', desconto: 0, valorRecebido: 0, aplicarIVA: true, regime: 'geral', observacoes: '' };
let pdvCache = { produtos: [], favoritos: JSON.parse(localStorage.getItem('kanawa_favoritos') || '[]'), ts: 0 };
const AGT_CONFIG = {
  iva: 0.14,
  ivaReduzido: 0.07,
  irt: {
    versao: '2026',
    effectiveFrom: '2026-01-01',
    legalReference: 'Lei n.º 14/25 — OGE 2026, Anexo I',
    sourceUrl: 'https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf',
    faixas: [
      { min: 0, max: 150000, taxa: 0, parcela: 0, excesso: 0 },
      { min: 150000.01, max: 200000, taxa: 0.16, parcela: 12500, excesso: 150000 },
      { min: 200000.01, max: 300000, taxa: 0.18, parcela: 31250, excesso: 200000 },
      { min: 300000.01, max: 500000, taxa: 0.19, parcela: 49250, excesso: 300000 },
      { min: 500000.01, max: 1000000, taxa: 0.20, parcela: 87250, excesso: 500000 },
      { min: 1000000.01, max: 1500000, taxa: 0.21, parcela: 187250, excesso: 1000000 },
      { min: 1500000.01, max: 2000000, taxa: 0.22, parcela: 292250, excesso: 1500000 },
      { min: 2000000.01, max: 2500000, taxa: 0.23, parcela: 402250, excesso: 2000000 },
      { min: 2500000.01, max: 5000000, taxa: 0.24, parcela: 517250, excesso: 2500000 },
      { min: 5000000.01, max: 10000000, taxa: 0.245, parcela: 1117250, excesso: 5000000 },
      { min: 10000000.01, max: Infinity, taxa: 0.25, parcela: 2342250, excesso: 10000000 }
    ]
  }
};

/* ====== UTILITÁRIOS ====== */
const fmt = v => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(Number(v) || 0);
const fmtN = v => new Intl.NumberFormat('pt-AO').format(Number(v) || 0);
const fmtD = d => d ? new Date(d).toLocaleDateString('pt-AO') : '-';
const fmtDT = d => d ? new Date(d).toLocaleString('pt-AO') : '-';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const num = (v, d = 0) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
const int = (v, d = 0) => { const n = parseInt(v); return isNaN(n) ? d : n; };
const now = () => new Date().toISOString();
const copy = o => JSON.parse(JSON.stringify(o));
const formatCurrency = fmt, formatDate = fmtD, formatDateTime = fmtDT, formatarData = fmtD, formatarNumero = fmtN, generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
const formatarHora = d => d ? new Date(d).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }) : '-';
const formatarTamanho = b => { if (!b) return '0 B'; const k = 1024, s = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + s[i]; };

/* ====== RESPONSIVE VIEWPORT ADAPTER ====== */
function updateResponsiveLayout() {
  const root = document.documentElement;
  const width = Math.max(320, window.innerWidth || root.clientWidth || 1024);
  const height = Math.max(320, window.innerHeight || root.clientHeight || 768);
  const tier = width <= 600 ? 'mobile' : width <= 900 ? 'tablet' : width <= 1200 ? 'laptop' : 'desktop';
  root.dataset.screenSize = tier;
  root.dataset.orientation = width > height ? 'landscape' : 'portrait';
  root.style.setProperty('--viewport-width', width + 'px');
  root.style.setProperty('--viewport-height', height + 'px');
}
if (typeof window !== 'undefined') {
  updateResponsiveLayout();
  window.addEventListener('resize', updateResponsiveLayout, { passive: true });
  window.addEventListener('orientationchange', updateResponsiveLayout, { passive: true });
}


function numeroPorExtenso(n) {
  n = Math.round(Number(n) || 0); if (n === 0) return 'zero kwanzas';
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const d = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const e = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function g(x) { if (x === 0) return ''; if (x < 10) return u[x]; if (x < 20) return e[x - 10]; if (x < 100) return d[Math.floor(x / 10)] + (x % 10 ? ' e ' + u[x % 10] : ''); return c[Math.floor(x / 100)] + (x % 100 ? ' e ' + g(x % 100) : ''); }
  const p = [], m = Math.floor(n / 1000000), mil = Math.floor((n % 1000000) / 1000), r = n % 1000;
  if (m) p.push(g(m) + (m === 1 ? ' milhão' : ' milhões'));
  if (mil) p.push(g(mil) + (mil === 1 ? ' mil' : ' mil'));
  if (r) p.push(g(r));
  return p.join(' e ') + ' kwanzas';
}

function toast(msg, type = 'info') {
  const c = $('toastContainer'); if (!c) return;
  const t = document.createElement('div'); t.className = 'toast ' + type;
  const ic = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  t.innerHTML = '<span style="font-size:1.2rem">' + (ic[type] || 'ℹ️') + '</span><span>' + esc(msg) + '</span>';
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}
function mostrarToast(a, b) {
  const tipos = ['success', 'error', 'warning', 'info'];
  if (arguments.length === 2) {
    if (tipos.includes(b)) toast(a, b); else if (tipos.includes(a)) toast(b, a); else toast(a, 'info');
  } else toast(a, 'info');
}
function openModal(title, body, large) {
  const o = $('modalOverlay'), c = $('modalContent'); if (!o || !c) return;
  $('modalTitle').textContent = title; $('modalBody').innerHTML = body;
  c.className = large ? 'modal modal-large' : 'modal'; o.classList.add('active');
}
function closeModal() { const o = $('modalOverlay'); if (o) o.classList.remove('active'); }
function updateApiStatus(on) { const b = $('apiStatus'), t = $('apiStatusText'); if (!b || !t) return; b.className = 'api-badge ' + (on ? 'online' : 'offline'); t.textContent = on ? 'Online' : 'Offline'; }
function toggleTheme() {
  const h = document.documentElement, isDark = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const ic = $('themeIcon'); if (ic) ic.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
  localStorage.setItem('kanawa_theme', isDark ? 'light' : 'dark');
}
function toggleUserMenu() { openModule('perfil'); }
function calcIRT(taxableBase) {
  const base=Math.max(0,Number(taxableBase)||0);
  const faixa=AGT_CONFIG.irt.faixas.find(f=>base>=Number(f.min)&&base<=Number(f.max));
  if(!faixa||base<=150000)return {irt:0,faixa:faixa||null,base:base};
  const irt=Math.max(0,Number(faixa.parcela||0)+Math.max(0,base-Number(faixa.excesso||faixa.min||0))*Number(faixa.taxa||0));
  return {irt:Math.round(irt*100)/100,faixa:faixa,base:base};
}
function gerarHash(d) { const s = JSON.stringify(d) + Date.now() + Math.random(); let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h; } return Math.abs(h).toString(16).toUpperCase().padStart(16, '0'); }
function gerarAssinatura(v) { const d = (v.numeroFatura || '') + '|' + (v.total || 0) + '|' + (v.data || '') + '|' + ((v.empresa && v.empresa.nif) || ''); let h = 0; for (let i = 0; i < d.length; i++) { h = ((h << 5) - h) + d.charCodeAt(i); h = h & h; } return Math.abs(h).toString(36).toUpperCase().padStart(12, '0'); }

/* ====== INDEXEDDB ====== */
const DB_STORES = [
  'produtos','clientes','fornecedores','vendas','compras','estoque','contasReceber','contasPagar','funcionarios','categorias','projetos','tarefas','ativos','frotas','ordensServico','notificacoes','documentos','mensagens','cursos','leads','campanhas','eventos','devolucoes','faturas','pagamentos','empresas','usuarios','movimentacoesEstoque','promocoes','ecommerce','auditoria','orcamentos','transportadoras','contratos','aprovacoes','sincronizacao','tickets','dispositivos','_sync_queue',
  'producao','ordensProducao','mrp','boms','custosProducao','controleQualidade','planosProducao','planoContas','budgets','forecasts','conciliacoes','transacoesBancarias','previsoesVendas','tendencias','folhasPagamento','turnos','ferias','vagas','candidatos','desempenhoRH','beneficios','planosCarreira','onboarding','pontoDigital','rescisoes','automacoes','scoreLeads','campanhasMarketing','segmentacoes','cupons','fidelidade','ganttProjetos','timesheets','manutencoes','ordensManutencao','garantias','pecasEstoque','checklistsInspecao','calendarioManutencoes','gpsTracking','abastecimentos','configuracoesFatura','empresaConfig','multas','tecnicos','roteirizacao','etiquetas','transferencias','inventarios','lotes','rastreios','recebimentos','ecommerceProdutos','ecommerceCarrinhos','ecommercePedidos','avaliacoes','pagamentosEcommerce','vendasConsignadas','tabelasPrecos','assinaturasDigitais','documentosFiscais','certificacoes','quizzes','mensagensChat','mensagensWhatsApp','eventosCalendar','unidades','servicos','clientesPortal','acessos','politicasSenha','tentativasLogin','sessoes','sms2FA','integracoesAGT','ivas','irts','backups','backupsAgendados','backupsNuvem','audiobooks','ddgHistorico','bingHistorico','dashboardsCustom','modulosPersonalizados','departamentos','frequencias','feriasFuncionarios','pagamentosFuncionarios','motoristas','manutencoesAtivos','depreciacoes','historicoOS','contatosWhatsApp','templatesWhatsApp','carrinhosSalvos','feedbacks','logsSeguranca','seguranca','migracoes','tarefasProjetos','membrosProjetos','atividadesProjetos','gruposUsuarios','config','armazens'
];
let lastGeneratedRecordId = 0;
function nextGeneratedRecordId() {
  const candidate = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  lastGeneratedRecordId = Math.max(candidate, lastGeneratedRecordId + 1);
  return lastGeneratedRecordId;
}
const DB = {
  name: 'kanawa_erp_v15', version: 8, db: null, stores: DB_STORES,
  init() { return new Promise((res, rej) => { const req = indexedDB.open(this.name, this.version); req.onupgradeneeded = e => { const db = e.target.result; DB_STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true }); }); }; req.onsuccess = e => { this.db = e.target.result; res(this.db); }; req.onerror = e => rej(e.target.error); }); },
  _tx(s, m) { return this.db.transaction(s, m || 'readonly').objectStore(s); },
  add(s, i) { if (s !== '_sync_queue' && i && (i.id === undefined || i.id === null)) i.id = nextGeneratedRecordId(); return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').add(i); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  put(s, i) { return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').put(i); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  get(s, id) { return new Promise((res, rej) => { const r = this._tx(s).get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  getAll(s) { return new Promise((res, rej) => { const r = this._tx(s).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); },
  del(s, id) { return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  clear(s) { return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  count(s) { return new Promise((res, rej) => { const r = this._tx(s).count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
};

/* ====== CLOUD DATABASE / OFFLINE CACHE ====== */
const API = {
  async checkHealth() {
    try { API_ONLINE = !!(window.KanawaCloud && await window.KanawaCloud.check()); }
    catch (e) { API_ONLINE = false; }
    updateApiStatus(API_ONLINE);
    return API_ONLINE;
  }
};

async function getData(store) {
  try {
    if (window.KanawaCloud && KanawaCloud.ready && !KanawaCloud.isLocalOnly(store)) {
      const pending = await DB.getAll('_sync_queue');
      if (!pending.some(x => !x.synced && x.entity === store)) {
        try {
          const remote = await KanawaCloud.getStore(store);
          if (Array.isArray(remote)) {
            await DB.clear(store);
            for (const item of remote) await DB.put(store, item);
          }
        } catch (cloudError) {
          console.warn('Kanawa cloud read:', store, cloudError);
        }
      }
    }
    return await DB.getAll(store);
  } catch (e) {
    console.warn('getData:', store, e);
    return [];
  }
}

async function saveData(store, item, options) {
  const existed = !!item.id;
  const id = existed ? (await DB.put(store, item), item.id) : await DB.add(store, item);
  const record = Object.assign({}, item, { id: id });
  if (window.KanawaCloud && store === 'empresas' && KanawaCloud.ready) {
    try { await KanawaCloud.updateCompany(record); }
    catch (e) { console.warn('Atualização da empresa pendente:', e); }
  } else if (window.KanawaCloud && !KanawaCloud.isLocalOnly(store)) {
    if (KanawaCloud.ready) {
      try { await KanawaCloud.upsertRecord(store, record, options || {}); }
      catch (e) {
        // A database validation/quota error must not be reported as a completed invoice.
        if (store === 'vendas' && item.status === 'finalizada' && e && e.code) {
          await DB.del(store, id);
          throw e;
        }
        await queueSync(store, existed ? 'update' : 'create', record, options || {});
        if (store === 'vendas' && item.status === 'finalizada') {
          toast('Venda guardada neste dispositivo; sincronização pendente: ' + (e.message || 'sem ligação'), 'warning');
        }
        console.warn('Kanawa cloud write queued:', store, e);
      }
    } else {
      await queueSync(store, existed ? 'update' : 'create', record, options || {});
    }
  }
  return id;
}

async function deleteData(store, id) {
  await DB.del(store, id);
  if (window.KanawaCloud && !KanawaCloud.isLocalOnly(store)) {
    if (KanawaCloud.ready) {
      try { await KanawaCloud.deleteRecord(store, id); }
      catch (e) { await queueSync(store, 'delete', { id: id }); }
    } else {
      await queueSync(store, 'delete', { id: id });
    }
  }
}

async function queueSync(entity, action, payload, options) {
  if (window.KanawaCloud && KanawaCloud.isLocalOnly(entity)) return;
  try { await DB.add('_sync_queue', { entity: entity, action: action, payload: payload, options: options || {}, data: now(), synced: false }); }
  catch (e) { console.warn('Não foi possível guardar fila de sincronização:', e); }
}

async function processSyncQueue() {
  if (!window.KanawaCloud || !KanawaCloud.ready) return 0;
  const queue = await DB.getAll('_sync_queue');
  let sent = 0;
  for (const item of queue.filter(x => !x.synced)) {
    try {
      if (item.action === 'delete') await KanawaCloud.deleteRecord(item.entity, item.payload.id);
      else await KanawaCloud.upsertRecord(item.entity, item.payload, item.options || {});
      await DB.del('_sync_queue', item.id);
      sent++;
    } catch (e) {
      console.warn('Fila de sincronização aguardando:', item.entity, e);
      break;
    }
  }
  return sent;
}

async function pullFromServer() {
  if (!window.KanawaCloud || !KanawaCloud.ready) return 0;
  const records = await KanawaCloud.getAllRecords();
  const queue = await DB.getAll('_sync_queue');
  const dirty = new Set(queue.filter(x => !x.synced).map(x => x.entity));
  const grouped = new Map();
  for (const row of records) {
    if (!grouped.has(row.store_key)) grouped.set(row.store_key, []);
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const id = payload.id !== undefined ? payload.id : (/^\d+$/.test(row.record_id) ? Number(row.record_id) : row.record_id);
    grouped.get(row.store_key).push(Object.assign({}, payload, { id: id }));
  }
  let total = 0;
  for (const store of DB_STORES) {
    if (KanawaCloud.isLocalOnly(store) || dirty.has(store)) continue;
    await DB.clear(store);
    for (const item of (grouped.get(store) || [])) {
      await DB.put(store, item);
      total++;
    }
  }
  return total;
}

async function syncNow(showMessage) {
  const online = await API.checkHealth();
  if (!online) {
    if (showMessage) toast('Sem ligação à base de dados. Os dados ficam guardados neste dispositivo.', 'warning');
    return false;
  }
  const indicator = $('syncIndicator'), label = $('syncText');
  if (indicator) indicator.className = 'sync-indicator show syncing';
  if (label) label.textContent = 'A preparar sincronização segura...';
  try {
    const sent = await processSyncQueue();
    const received = await pullFromServer();
    if (indicator) indicator.className = 'sync-indicator show online';
    if (label) label.textContent = 'Dados sincronizados ✓';
    if (showMessage) toast('Sincronização concluída: ' + sent + ' enviados, ' + received + ' recebidos.', 'success');
    setTimeout(() => { if (indicator) indicator.className = 'sync-indicator'; }, 2200);
    return true;
  } catch (e) {
    if (indicator) indicator.className = 'sync-indicator show offline';
    if (label) label.textContent = 'Sincronização pendente';
    if (showMessage) toast('Falha na sincronização: ' + e.message, 'error');
    return false;
  }
}
function toggleSync() { syncNow(true); }
function startAutoSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    if (window.KanawaCloud && KanawaCloud.ready) syncNow(false);
  }, 60000);
}

async function activateCloudSession(ctx, migrateLocal) {
  const companyId = ctx.company.id;
  const previousCompanyId = localStorage.getItem('kanawa_cloud_company_id');
  const localOnly = new Set(['empresas','usuarios','config','dispositivos','sessoes','tentativasLogin','politicasSenha','sms2FA','acessos','logsSeguranca','seguranca','migracoes','_sync_queue']);

  if (previousCompanyId && previousCompanyId !== companyId) {
    for (const store of DB_STORES) await DB.clear(store);
    localStorage.setItem('kanawa_cloud_company_id', companyId);
    localStorage.removeItem('kanawa_legacy_company');
  } else if (previousCompanyId !== companyId) {
    let remoteRows = null;
    try { remoteRows = await KanawaCloud.getAllRecords(); }
    catch (networkError) { console.warn('Base central indisponível; mantém-se o cache local:', networkError); }

    if (remoteRows !== null) {
      let localCompany = null;
      try {
        localCompany = JSON.parse(
          localStorage.getItem('kanawa_legacy_company') ||
          localStorage.getItem('kanawa_empresa') || 'null'
        );
      } catch (e) { localCompany = null; }

      const localNif = String(localCompany && (localCompany.nif || localCompany.tax_id) || '').replace(/\D/g, '');
      const cloudNif = String(ctx.company.tax_id || '').replace(/\D/g, '');
      const localName = String(localCompany && (localCompany.nome || localCompany.firma || localCompany.legal_name) || '').trim().toLowerCase();
      const cloudName = String(ctx.company.legal_name || ctx.company.trade_name || '').trim().toLowerCase();
      const sameCompany = (!!localNif && !!cloudNif && localNif === cloudNif) ||
        (!localNif && !cloudNif && !!localName && !!cloudName && localName === cloudName);

      if (remoteRows.length > 0 && !sameCompany) {
        for (const store of DB_STORES) if (!localOnly.has(store)) await DB.clear(store);
      } else if (migrateLocal && sameCompany) {
        const remoteKeys = new Set(remoteRows.map(function (row) { return row.store_key + ':' + row.record_id; }));
        for (const store of DB_STORES) {
          if (localOnly.has(store) || store.startsWith('_')) continue;
          const rows = await DB.getAll(store);
          for (const row of rows) {
            if (!row || row.id === undefined || row.id === null) continue;
            const key = store + ':' + String(row.id);
            if (remoteKeys.has(key)) continue;
            try {
              await KanawaCloud.upsertRecord(store, row, { skipSaleFinalize: true });
              remoteKeys.add(key);
            } catch (migrationError) {
              await queueSync(store, 'create', row, { skipSaleFinalize: true });
              console.warn('Migração cloud pendente:', store, migrationError);
            }
          }
        }
      } else if (remoteRows.length > 0) {
        for (const store of DB_STORES) if (!localOnly.has(store)) await DB.clear(store);
      }
      localStorage.setItem('kanawa_cloud_company_id', companyId);
      localStorage.removeItem('kanawa_legacy_company');
    }
  }

  const company = {
    id: 1,
    firma: ctx.company.trade_name || ctx.company.legal_name,
    nome: ctx.company.legal_name,
    nif: ctx.company.tax_id || '',
    telefone: ctx.company.phone || '',
    email: ctx.company.email || ctx.user.email || '',
    regime: ctx.company.tax_regime || 'not_configured',
    dataCriacao: ctx.company.created_at || now()
  };
  const user = {
    id: 1,
    nome: (ctx.profile && ctx.profile.full_name) || ctx.user.email,
    email: ctx.user.email,
    perfil: ctx.role,
    role: ctx.role,
    avatar: null
  };
  await DB.put('empresas', company);
  await DB.put('usuarios', user);
  localStorage.setItem('kanawa_empresa', JSON.stringify(company));
  localStorage.setItem('kanawa_user', JSON.stringify(user));
  localStorage.setItem('kanawa_setup_done', 'true');

  try { await pullFromServer(); }
  catch (pullError) { console.warn('Sincronização inicial adiada; será retomada quando houver internet:', pullError); }
  try { await KanawaCloud.registerInstallation(APP_VERSION); }
  catch (e) { console.warn('Registo de instalação pendente:', e); }

  try {
    const license = await KanawaCloud.getLicense();
    if (license) localStorage.setItem('kanawa_license', JSON.stringify(license));
    const entitlements = await KanawaCloud.getEntitlements();
    if (entitlements) localStorage.setItem('kanawa_entitlements', JSON.stringify(entitlements));
    try {
      const expiryAlerts = await KanawaCloud.getExpiringDocuments(90);
      localStorage.setItem('kanawa_document_expiry_alerts', JSON.stringify(expiryAlerts));
      const urgent = expiryAlerts.filter(function (item) { return item.days_remaining <= 30; });
      if (urgent.length) toast(urgent.length + ' documento(s) expirado(s) ou a vencer nos próximos 30 dias. Consulte Empresa e Documentos Legais.', 'warning');
    } catch (expiryError) { console.warn('Alertas de validade indisponíveis:', expiryError); }
    if (entitlements && entitlements.read_only) toast('A licença ou os limites do plano estão em modo de consulta. Verifique a subscrição.', 'warning');
    if (license && license.expires_at) {
      const expiry = new Date(license.expires_at);
      const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
      if (license.status === 'expired' || days < 0) toast('A licença Kanawa Soft expirou. Contacte a D.PEDRO SOLUÇÕES.', 'warning');
      else if (days <= 5) toast('A licença expira em ' + Math.max(0, days) + ' dia(s).', 'warning');
    }
    const pendingKey = sessionStorage.getItem('kanawa_pending_license_key');
    if (pendingKey) {
      try {
        const activation = await KanawaCloud.redeemLicenseKey(pendingKey);
        sessionStorage.removeItem('kanawa_pending_license_key');
        if ($('preLoginLicenseKey')) $('preLoginLicenseKey').value = '';
        toast('Licença '+activation.plan_code+' activada.','success');
      } catch (keyError) {
        toast('A chave de licença não foi activada: '+(keyError.message||'verifique a chave'),'warning');
      }
    }
  } catch (e) { console.warn('Não foi possível consultar a licença:', e); }
  await API.checkHealth();
  return { company: company, user: user };
}

function mostrarAplicacaoAutenticada(ctx) {
  const user = JSON.parse(localStorage.getItem('kanawa_user') || '{}');
  const company = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  if ($('setupWizard')) $('setupWizard').classList.remove('active');
  if ($('authScreen')) $('authScreen').classList.remove('active');
  if ($('app')) $('app').classList.add('active');
  if ($('topbarEmpresa')) $('topbarEmpresa').textContent = company.firma || company.nome || 'Kanawa Soft';
  if ($('userName')) $('userName').textContent = user.nome || 'Utilizador';
  if ($('userRole')) $('userRole').textContent = user.role || user.perfil || 'operador';
  if ($('userAvatar')) {
    $('userAvatar').src = user.avatar || 'logo.png';
    $('userAvatar').onerror = function () { this.src = 'logo.png'; };
  }
  renderSidebar();
  openModule('dashboard');
  updateNotifBadge();
}

async function abrirCadastroEmpresa() {
  localStorage.setItem('kanawa_plan_intro_seen_v1','true');
  if ($('planWelcome')) $('planWelcome').classList.remove('active');
  if ($('authScreen')) $('authScreen').classList.remove('active');
  if ($('setupWizard')) $('setupWizard').classList.add('active');
}

/* ====== PERMISSÕES ====== */
// Convites suspensos até o backend validar invitation_code e associar o membro à empresa correcta.
const TEAM_INVITATIONS_ENABLED = true;
const PERMISSOES = {
  admin: { modulos: '*', acoes: ['criar','editar','excluir','ver','configurar','aprovar','cancelar','exportar','importar'], verFinanceiro: true, excluir: true, configurar: true, descontoMax: 100 },
  contabilista: { modulos: ['dashboard','contabilidade','fiscal','financeiro','relatorios','documentos','auditoria','perfil','ativos','orcamentos','folha-salarial','despesas-gerais','notificacoes'], acoes: ['criar','editar','ver','exportar','aprovar'], verFinanceiro: true, excluir: false, configurar: false, descontoMax: 0 },
  gerente: { modulos: ['dashboard','pdv','vendas','produtos','categorias','ecommerce','estoque','compras','clientes','fornecedores','crm','financeiro','fiscal','contabilidade','rh','projetos','tarefas','ativos','frota','os','documentos','relatorios','notificacoes','orcamentos','transportadoras','contratos','tickets','perfil','dispositivos','producao','ordens-producao','mrp','bom','custos-producao','controle-qualidade','planos-producao','logistica-roteirizacao','logistica-etiquetas','logistica-picking','logistica-armazens','logistica-crossdocking','logistica-rastreio','ecommerce-vitrine','ecommerce-carrinho','ecommerce-pedidos','ecommerce-produtos','ecommerce-pagamento','ecommerce-rastreio','rh-recrutamento','rh-desempenho','rh-beneficios','rh-onboarding','rh-ponto','rh-rescisao','rh-plano-carreira','projetos-tarefas','projetos-kanban','projetos-gantt','projetos-recursos','projetos-timesheet','projetos-custos','projetos-riscos','ativos-depreciacao','ativos-manutencao','ativos-garantia','frota-manutencao','frota-rotas','frota-gps','frota-combustivel','frota-documentos','frota-multas','frota-desempenho','os-manutencao','os-checklist','os-calendario','os-tecnicos','produtos-avaliacoes','tabelas-precos','vendas-consignadas','vendas-promocoes','clientes-fidelidade','clientes-cupons','portal-cliente','clientes-segmentacao','crm-pipeline','crm-automacao','crm-score','crm-remarketing','marketing-campanhas','marketing-analise','empresa-legal','despesas-gerais','ferias-dispensas','agenda','reunioes','comunicacao','aprovacoes-empresa','departamentos-empresa','orcamento-empresa','rh-documentos','folha-salarial','elearning-cursos','elearning-certificacoes','elearning-quizzes','elearning-progresso','elearning-relatorios','servicos'], acoes: ['criar','editar','ver','aprovar','cancelar','exportar'], verFinanceiro: true, excluir: false, configurar: false, descontoMax: 30 },
  operador: { modulos: ['dashboard','pdv','vendas','produtos','clientes','estoque','notificacoes','perfil','producao','ordens-producao','controle-qualidade','os','os-manutencao','os-checklist','os-calendario','agenda','reunioes','comunicacao','ferias-dispensas','projetos-tarefas','projetos-kanban','tarefas'], acoes: ['criar','ver'], verFinanceiro: false, excluir: false, configurar: false, descontoMax: 10 },
  caixa: { modulos: ['pdv','vendas','clientes','notificacoes','perfil','ecommerce-vitrine','ecommerce-carrinho','ecommerce-pedidos'], acoes: ['criar','ver'], verFinanceiro: false, excluir: false, configurar: false, descontoMax: 5 }
};
function getPerms() {
  const context = window.KanawaCloud && KanawaCloud.context || {};
  const membership = context.membership || {};
  const rawRole = String(membership.role || context.role || 'operator').trim().toLowerCase();
  if (context.isPlatformAdmin === true || rawRole === 'owner' || rawRole === 'admin') return PERMISSOES.admin;
  const roleKey = ({
    manager:'gerente', gerente:'gerente',
    accountant:'contabilista', contabilista:'contabilista',
    operator:'operador', operador:'operador', employee:'operador', funcionario:'operador', worker:'operador', trabalhador:'operador',
    cashier:'caixa', caixa:'caixa'
  })[rawRole] || 'operador';
  return PERMISSOES[roleKey] || PERMISSOES.operador;
}
function getModuleOverride(moduleId, action) {
  const membership = window.KanawaCloud && KanawaCloud.context && KanawaCloud.context.membership;
  const permissions = membership && membership.permissions || {};
  const modules = permissions.modules || {};
  const entry = modules[moduleId] || permissions[moduleId] || {};
  return typeof entry[action] === 'boolean' ? entry[action] : null;
}
function podeAcessar(moduleId) {
  const p = getPerms();
  if (p.modulos === '*') return true;
  const context = window.KanawaCloud && KanawaCloud.context || {};
  if (context.companyModules && context.companyModules[moduleId] === false) return false;
  const override = getModuleOverride(moduleId,'ver');
  if (override !== null) return override;
  return Array.isArray(p.modulos) && p.modulos.includes(moduleId);
}
function podeFazer(action, moduleId) {
  const p = getPerms();
  if (p.modulos === '*') return true;
  const module = moduleId || currentModule;
  if (module && !podeAcessar(module)) return false;
  const override = module ? getModuleOverride(module,action) : null;
  if (override !== null) return override;
  return Array.isArray(p.acoes) && p.acoes.includes(action);
}


/* ====== MENU ====== */
const MENU = [
  { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
  { id: 'pdv', icon: 'fa-cash-register', label: 'PDV' },
  { id: 'vendas', icon: 'fa-receipt', label: 'Vendas' },
  { id: 'orcamentos', icon: 'fa-file-invoice', label: 'Orçamentos' },
  { id: 'produtos', icon: 'fa-boxes', label: 'Produtos' },
  { id: 'produtos-avaliacoes', icon: 'fa-star', label: 'Avaliações' },
  { id: 'categorias', icon: 'fa-tags', label: 'Categorias' },
  { id: 'servicos', icon: 'fa-concierge-bell', label: 'Serviços' },
  { id: 'tabelas-precos', icon: 'fa-table', label: 'Tabelas de Preços' },
  { id: 'ecommerce-vitrine', icon: 'fa-store', label: 'E-commerce' },
  { id: 'ecommerce-carrinho', icon: 'fa-shopping-bag', label: 'Carrinho' },
  { id: 'ecommerce-pedidos', icon: 'fa-truck', label: 'Pedidos' },
  { id: 'ecommerce-pagamento', icon: 'fa-credit-card', label: 'Pagamento' },
  { id: 'ecommerce-rastreio', icon: 'fa-map-marker-alt', label: 'Rastreio' },
  { id: 'estoque', icon: 'fa-warehouse', label: 'Estoque' },
  { id: 'producao', icon: 'fa-industry', label: 'Produção' },
  { id: 'ordens-producao', icon: 'fa-clipboard-list', label: 'Ordens Produção' },
  { id: 'mrp', icon: 'fa-cogs', label: 'MRP' },
  { id: 'bom', icon: 'fa-sitemap', label: 'BOM' },
  { id: 'custos-producao', icon: 'fa-calculator', label: 'Custos Produção' },
  { id: 'controle-qualidade', icon: 'fa-check-double', label: 'Qualidade' },
  { id: 'planos-producao', icon: 'fa-calendar-alt', label: 'Planos Produção' },
  { id: 'compras', icon: 'fa-shopping-bag', label: 'Compras' },
  { id: 'clientes', icon: 'fa-users', label: 'Clientes' },
  { id: 'clientes-fidelidade', icon: 'fa-star', label: 'Fidelidade' },
  { id: 'clientes-cupons', icon: 'fa-ticket-alt', label: 'Cupons' },
  { id: 'clientes-segmentacao', icon: 'fa-users-cog', label: 'Segmentação' },
  { id: 'portal-cliente', icon: 'fa-user-circle', label: 'Portal Cliente' },
  { id: 'fornecedores', icon: 'fa-truck', label: 'Fornecedores' },
  { id: 'transportadoras', icon: 'fa-shipping-fast', label: 'Transportadoras' },
  { id: 'crm', icon: 'fa-handshake', label: 'CRM' },
  { id: 'crm-pipeline', icon: 'fa-columns', label: 'Pipeline' },
  { id: 'crm-automacao', icon: 'fa-robot', label: 'Automação' },
  { id: 'crm-score', icon: 'fa-chart-line', label: 'Score Leads' },
  { id: 'crm-remarketing', icon: 'fa-retweet', label: 'Remarketing' },
  { id: 'marketing-campanhas', icon: 'fa-bullhorn', label: 'Marketing' },
  { id: 'integracoes', icon: 'fa-plug', label: 'Integrações API' },
  { id: 'conformidade', icon: 'fa-balance-scale', label: 'Conformidade' },
  { id: 'empresa-legal', icon: 'fa-building', label: 'Empresa e Documentos Legais' },
  { id: 'licenca', icon: 'fa-key', label: 'Licença e Pacotes' },
  { id: 'despesas-gerais', icon: 'fa-file-invoice-dollar', label: 'Despesas Gerais' },
  { id: 'ferias-dispensas', icon: 'fa-calendar-minus', label: 'Férias e Dispensas' },
  { id: 'agenda', icon: 'fa-calendar-alt', label: 'Agenda e Marcações' },
  { id: 'reunioes', icon: 'fa-users', label: 'Reuniões' },
  { id: 'comunicacao', icon: 'fa-comments', label: 'Comunicação Interna' },
  { id: 'aprovacoes-empresa', icon: 'fa-clipboard-check', label: 'Aprovações' },
  { id: 'departamentos-empresa', icon: 'fa-sitemap', label: 'Departamentos' },
  { id: 'orcamento-empresa', icon: 'fa-chart-pie', label: 'Orçamento Empresarial' },
  { id: 'rh-documentos', icon: 'fa-id-card', label: 'Documentos Funcionários' },
  { id: 'folha-salarial', icon: 'fa-money-check-alt', label: 'Folha Salarial' },
  { id: 'marketing-analise', icon: 'fa-chart-pie', label: 'Análise Marketing' },
  { id: 'contabilidade', icon: 'fa-book', label: 'Contabilidade' },
  { id: 'financeiro', icon: 'fa-coins', label: 'Financeiro' },
  { id: 'fiscal', icon: 'fa-landmark', label: 'Fiscal AGT' },
  { id: 'rh', icon: 'fa-user-tie', label: 'RH' },
  { id: 'rh-recrutamento', icon: 'fa-user-plus', label: 'Recrutamento' },
  { id: 'rh-desempenho', icon: 'fa-chart-bar', label: 'Desempenho' },
  { id: 'rh-beneficios', icon: 'fa-gift', label: 'Benefícios' },
  { id: 'rh-onboarding', icon: 'fa-user-graduate', label: 'Onboarding' },
  { id: 'rh-ponto', icon: 'fa-clock', label: 'Ponto' },
  { id: 'rh-rescisao', icon: 'fa-file-signature', label: 'Rescisão' },
  { id: 'rh-plano-carreira', icon: 'fa-arrow-up', label: 'Carreira' },
  { id: 'projetos', icon: 'fa-project-diagram', label: 'Projetos' },
  { id: 'projetos-tarefas', icon: 'fa-tasks', label: 'Tarefas' },
  { id: 'projetos-kanban', icon: 'fa-columns', label: 'Kanban' },
  { id: 'projetos-gantt', icon: 'fa-chart-bar', label: 'Gantt' },
  { id: 'projetos-recursos', icon: 'fa-users-cog', label: 'Recursos' },
  { id: 'projetos-timesheet', icon: 'fa-clock', label: 'Timesheet' },
  { id: 'projetos-custos', icon: 'fa-calculator', label: 'Custos Projeto' },
  { id: 'projetos-riscos', icon: 'fa-exclamation-triangle', label: 'Riscos' },
  { id: 'ativos', icon: 'fa-building', label: 'Ativos' },
  { id: 'ativos-depreciacao', icon: 'fa-chart-line', label: 'Depreciação' },
  { id: 'ativos-manutencao', icon: 'fa-tools', label: 'Manutenção' },
  { id: 'ativos-garantia', icon: 'fa-shield-alt', label: 'Garantias' },
  { id: 'frota', icon: 'fa-truck-moving', label: 'Frota' },
  { id: 'frota-manutencao', icon: 'fa-tools', label: 'Manutenção' },
  { id: 'frota-rotas', icon: 'fa-route', label: 'Rotas' },
  { id: 'frota-gps', icon: 'fa-satellite', label: 'GPS' },
  { id: 'frota-combustivel', icon: 'fa-gas-pump', label: 'Combustível' },
  { id: 'frota-documentos', icon: 'fa-file-alt', label: 'Documentos' },
  { id: 'frota-multas', icon: 'fa-exclamation-circle', label: 'Multas' },
  { id: 'frota-desempenho', icon: 'fa-chart-bar', label: 'Desempenho' },
  { id: 'os', icon: 'fa-clipboard-list', label: 'Ordens Serviço' },
  { id: 'os-manutencao', icon: 'fa-tools', label: 'OS Manutenção' },
  { id: 'os-checklist', icon: 'fa-clipboard-check', label: 'Checklist' },
  { id: 'os-calendario', icon: 'fa-calendar-alt', label: 'Calendário' },
  { id: 'os-tecnicos', icon: 'fa-user-cog', label: 'Técnicos' },
  { id: 'logistica-roteirizacao', icon: 'fa-route', label: 'Logística' },
  { id: 'logistica-etiquetas', icon: 'fa-tag', label: 'Etiquetas' },
  { id: 'logistica-picking', icon: 'fa-boxes', label: 'Picking' },
  { id: 'logistica-armazens', icon: 'fa-warehouse', label: 'Armazéns' },
  { id: 'logistica-crossdocking', icon: 'fa-exchange-alt', label: 'Cross-docking' },
  { id: 'logistica-rastreio', icon: 'fa-map-marked-alt', label: 'Rastreio' },
  { id: 'contratos', icon: 'fa-file-contract', label: 'Contratos' },
  { id: 'documentos', icon: 'fa-folder-open', label: 'Documentos' },
  { id: 'tickets', icon: 'fa-ticket-alt', label: 'Tickets' },
  { id: 'elearning-cursos', icon: 'fa-graduation-cap', label: 'Cursos' },
  { id: 'elearning-certificacoes', icon: 'fa-certificate', label: 'Certificações' },
  { id: 'elearning-quizzes', icon: 'fa-question-circle', label: 'Quizzes' },
  { id: 'elearning-progresso', icon: 'fa-chart-line', label: 'Progresso' },
  { id: 'elearning-relatorios', icon: 'fa-file-alt', label: 'Relatórios EAD' },
  { id: 'relatorios', icon: 'fa-chart-bar', label: 'Relatórios' },
  { id: 'notificacoes', icon: 'fa-bell', label: 'Notificações' },
  { id: 'usuarios', icon: 'fa-user-shield', label: 'Usuários' },
  { id: 'auditoria', icon: 'fa-history', label: 'Auditoria' },
  { id: 'perfil', icon: 'fa-user-circle', label: 'Meu Perfil' },
  { id: 'dispositivos', icon: 'fa-print', label: 'Dispositivos' },
  { id: 'config', icon: 'fa-cog', label: 'Configurações' },
  { id: 'modulos', icon: 'fa-code', label: 'Módulos' }
];

const MENU_GROUP_DEFINITIONS = [
 {id:'inicio',label:'Visão geral',icon:'fa-home',ids:['dashboard']},
 {id:'vendas',label:'Vendas e PDV',icon:'fa-cash-register',ids:['pdv','vendas','orcamentos']},
 {id:'produtos',label:'Produtos e inventário',icon:'fa-boxes',ids:['produtos','produtos-avaliacoes','categorias','servicos','tabelas-precos','estoque','producao','ordens-producao','mrp','bom','custos-producao','controle-qualidade','planos-producao']},
 {id:'compras',label:'Compras e fornecedores',icon:'fa-shopping-cart',ids:['compras','fornecedores','transportadoras']},
 {id:'clientes',label:'Clientes e CRM',icon:'fa-users',ids:['clientes','clientes-fidelidade','clientes-cupons','clientes-segmentacao','portal-cliente','crm','crm-pipeline','crm-automacao','crm-score','crm-remarketing','marketing-campanhas','marketing-analise']},
 {id:'ecommerce',label:'Comércio electrónico',icon:'fa-store',ids:['ecommerce-vitrine','ecommerce-carrinho','ecommerce-pedidos','ecommerce-produtos','ecommerce-pagamento','ecommerce-rastreio']},
 {id:'financeiro',label:'Financeiro e fiscalidade',icon:'fa-coins',ids:['financeiro','fiscal','despesas-gerais','orcamento-empresa']},
 {id:'contabilidade',label:'Contabilidade',icon:'fa-book',ids:['contabilidade']},
 {id:'rh',label:'Recursos humanos',icon:'fa-user-tie',ids:['rh','rh-recrutamento','rh-desempenho','rh-beneficios','rh-onboarding','rh-ponto','rh-rescisao','rh-plano-carreira','rh-documentos','folha-salarial','ferias-dispensas','departamentos-empresa']},
 {id:'projetos',label:'Projectos e tarefas',icon:'fa-project-diagram',ids:['projetos','tarefas','projetos-tarefas','projetos-kanban','projetos-gantt','projetos-recursos','projetos-timesheet','projetos-custos','projetos-riscos']},
 {id:'ativos',label:'Activos e património',icon:'fa-building',ids:['ativos','ativos-depreciacao','ativos-manutencao','ativos-garantia']},
 {id:'frota',label:'Gestão de frota',icon:'fa-truck-moving',ids:['frota','frota-manutencao','frota-rotas','frota-gps','frota-combustivel','frota-documentos','frota-multas','frota-desempenho']},
 {id:'operacoes',label:'Serviços e operações',icon:'fa-tools',ids:['os','os-manutencao','os-checklist','os-calendario','os-tecnicos','agenda','reunioes','comunicacao','aprovacoes-empresa']},
 {id:'logistica',label:'Logística',icon:'fa-route',ids:['logistica-roteirizacao','logistica-etiquetas','logistica-picking','logistica-armazens','logistica-crossdocking','logistica-rastreio']},
 {id:'documentos',label:'Documentos e conformidade',icon:'fa-folder-open',ids:['contratos','documentos','tickets','empresa-legal','conformidade','licenca','integracoes']},
 {id:'formacao',label:'Formação',icon:'fa-graduation-cap',ids:['elearning-cursos','elearning-certificacoes','elearning-quizzes','elearning-progresso','elearning-relatorios']},
 {id:'administracao',label:'Administração e sistema',icon:'fa-sliders-h',ids:['relatorios','notificacoes','usuarios','auditoria','perfil','dispositivos','config','modulos']}
];
const MENU_GROUPS = MENU_GROUP_DEFINITIONS.map(group => ({id:group.id,label:group.label,icon:group.icon,items:group.ids.map(id=>MENU.find(item=>item.id===id)).filter(Boolean)})).filter(group=>group.items.length);
const MENU_GROUPED_IDS = new Set(MENU_GROUPS.flatMap(group=>group.items.map(item=>item.id)));
const MENU_UNGROUPED = MENU.filter(item=>!MENU_GROUPED_IDS.has(item.id));
if(MENU_UNGROUPED.length) MENU_GROUPS.push({id:'outros',label:'Outros módulos',icon:'fa-ellipsis-h',items:MENU_UNGROUPED});

let expandedMenuGroup = null;
function toggleMenuGroup(groupId){
 const group=MENU_GROUPS.find(item=>item.id===groupId); if(!group)return;
 if(group.items.length===1){openModule(group.items[0].id);return;}
 expandedMenuGroup=expandedMenuGroup===groupId?null:groupId; renderSidebar();
}
function renderSidebar() {
  const sidebar = $('sidebar');
  if (!sidebar) return;
  const groups = MENU_GROUPS.map(group => Object.assign({},group,{
    items: group.items.filter(item => podeAcessar(item.id))
  })).filter(group => group.items.length);
  const activeGroup = groups.find(group => group.items.some(item => item.id === currentModule));
  const openGroup = activeGroup ? activeGroup.id : expandedMenuGroup;
  if (activeGroup) expandedMenuGroup = activeGroup.id;
  sidebar.innerHTML = groups.map(group => {
    const opened = group.id === openGroup;
    const items = group.items.map(item =>
      '<button type="button" class="sidebar-item sidebar-subitem'+(item.id===currentModule?' active':'')+
      '" data-id="'+esc(item.id)+'" onclick="openModule(\''+esc(item.id)+'\')" aria-current="'+(item.id===currentModule?'page':'false')+'">'+
      '<i class="fas '+item.icon+'" aria-hidden="true"></i><span>'+esc(item.label)+'</span></button>'
    ).join('');
    return '<section class="sidebar-group" data-group="'+esc(group.id)+'">'+
      '<button type="button" class="sidebar-group-trigger'+(opened?' active':'')+'" aria-expanded="'+(opened?'true':'false')+
      '" onclick="toggleMenuGroup(\''+esc(group.id)+'\')"><i class="fas '+group.icon+'" aria-hidden="true"></i>'+
      '<span>'+esc(group.label)+'</span>'+(group.items.length>1?'<i class="fas fa-chevron-'+(opened?'down':'right')+' sidebar-chevron" aria-hidden="true"></i>':'')+'</button>'+
      (opened&&group.items.length>1?'<div class="sidebar-submenu">'+items+'</div>':'')+'</section>';
  }).join('');
}


async function openModule(id) {
  if (!podeAcessar(id)) { toast('🔒 Sem permissão', 'error'); return; }
  currentModule = id;
  renderSidebar();
  closeMobileSidebar();
  const c = $('content');
  c.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:3rem;color:var(--primary)"></i></div>';
  const R = {
    dashboard: renderDashboard, pdv: renderPDV, vendas: renderVendas, orcamentos: renderOrcamentos,
    integracoes: renderIntegracoes,
    conformidade: renderConformidade,
    'empresa-legal': renderEmpresaLegal,
    licenca: renderLicenca,
    'despesas-gerais': renderDespesasGerais,
    'ferias-dispensas': renderFeriasDispensas,
    agenda: renderAgenda,
    reunioes: renderReunioes,
    comunicacao: renderComunicacao,
    'aprovacoes-empresa': renderAprovacoesEmpresa,
    'departamentos-empresa': renderDepartamentosEmpresa,
    'orcamento-empresa': renderOrcamentoEmpresa,
    'rh-documentos': renderDocumentosFuncionarios,
    'folha-salarial': renderFolhaSalarial,
    produtos: renderProdutos, categorias: renderCategorias, ecommerce: renderEcommerce,
    estoque: renderEstoque, compras: renderCompras, clientes: renderClientes,
    fornecedores: renderFornecedores, transportadoras: renderTransportadoras, crm: renderCRM,
    contabilidade: renderContabilidade, financeiro: renderFinanceiro, fiscal: renderFiscal, rh: renderRH,
    projetos: renderProjetos, tarefas: renderTarefas, ativos: renderAtivos,
    frota: renderFrota, os: renderOS, contratos: renderContratos,
    documentos: renderDocumentos, tickets: renderTickets, relatorios: renderRelatorios,
    notificacoes: renderNotificacoes, usuarios: renderUsuarios, auditoria: renderAuditoria,
    perfil: renderPerfil, dispositivos: renderDispositivos, config: renderConfig, modulos: renderModulos,
    producao: renderProducao, 'ordens-producao': renderOrdensProducao, mrp: renderMRP, bom: renderBOM,
    'custos-producao': renderCustosProducao, 'controle-qualidade': renderControleQualidade, 'planos-producao': renderPlanosProducao,
    'logistica-roteirizacao': renderLogisticaRoteirizacao, 'logistica-etiquetas': renderLogisticaEtiquetas,
    'logistica-picking': renderLogisticaPicking, 'logistica-armazens': renderLogisticaArmazens,
    'logistica-crossdocking': renderLogisticaCrossdocking, 'logistica-rastreio': renderLogisticaRastreio,
    'ecommerce-vitrine': renderEcommerceVitrine, 'ecommerce-carrinho': renderEcommerceCarrinho,
    'ecommerce-pedidos': renderEcommercePedidos, 'ecommerce-produtos': renderEcommerceProdutos,
    'ecommerce-pagamento': renderEcommercePagamento, 'ecommerce-rastreio': renderEcommerceRastreio,
    'rh-recrutamento': renderRHRecrutamento, 'rh-desempenho': renderRHDesempenho, 'rh-beneficios': renderRHBeneficios,
    'rh-onboarding': renderRHOnboarding, 'rh-ponto': renderRHPonto, 'rh-rescisao': renderRHRescisao, 'rh-plano-carreira': renderRHPlanoCarreira,
    'projetos-tarefas': renderProjetosTarefas, 'projetos-kanban': renderKanban, 'projetos-gantt': renderProjetosGantt,
    'projetos-recursos': renderProjetosRecursos, 'projetos-timesheet': renderProjetosTimesheet,
    'projetos-custos': renderProjetosCustos, 'projetos-riscos': renderProjetosRiscos,
    'ativos-depreciacao': renderAtivosDepreciacao, 'ativos-manutencao': renderAtivosManutencao, 'ativos-garantia': renderAtivosGarantia,
    'frota-manutencao': renderFrotaManutencao, 'frota-rotas': renderFrotaRotas, 'frota-gps': renderFrotaGPS,
    'frota-combustivel': renderFrotaCombustivel, 'frota-documentos': renderFrotaDocumentos,
    'frota-multas': renderFrotaMultas, 'frota-desempenho': renderFrotaDesempenho,
    'os-manutencao': renderOSManutencao, 'os-checklist': renderOSChecklist, 'os-calendario': renderOSCalendario, 'os-tecnicos': renderOSTecnicos,
    'produtos-avaliacoes': renderProdutosAvaliacoes, 'tabelas-precos': renderTabelasPrecos,
    'vendas-consignadas': renderVendasConsignadas, 'vendas-promocoes': renderVendasPromocoes,
    'clientes-fidelidade': renderClientesFidelidade, 'clientes-cupons': renderClientesCupons,
    'portal-cliente': renderPortalCliente, 'clientes-segmentacao': renderClientesSegmentacao,
    'crm-pipeline': renderCRMPipeline, 'crm-automacao': renderCRMAutomacao, 'crm-score': renderCRMScore, 'crm-remarketing': renderCRMRemarketing,
    'marketing-campanhas': renderMarketingCampanhas, 'marketing-analise': renderMarketingAnalise,
    'elearning-cursos': renderElearningCursos, 'elearning-certificacoes': renderElearningCertificacoes,
    'elearning-quizzes': renderElearningQuizzes, 'elearning-progresso': renderElearningProgresso, 'elearning-relatorios': renderElearningRelatorios,
    servicos: renderServicos
  };
  try {
    c.innerHTML = R[id] ? await R[id]() : '<div class="card"><h3>Módulo ' + id + '</h3></div>';
    c.scrollTop = 0;
  } catch (e) { console.error(e); c.innerHTML = '<div class="card"><h3>Erro</h3><p>' + esc(e.message) + '</p></div>'; }
}

/* ====== UI HELPERS ====== */
function header(title, subtitle, color, buttons, icon) {
  return '<div class="card" style="background:linear-gradient(135deg,' + (color || 'var(--primary)') + ',var(--primary-dark));color:#fff;border:none">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
    '<div><h2 style="font-size:1.3rem;font-weight:800"><i class="fas ' + (icon || 'fa-th') + '"></i> ' + esc(title) + '</h2>' +
    (subtitle ? '<p style="opacity:.85;font-size:.9rem;margin-top:4px">' + subtitle + '</p>' : '') + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (buttons || '') + '</div></div></div>';
}
function emptyState(icon, msg) { return '<div class="empty"><i class="fas ' + icon + '"></i>' + msg + '</div>'; }
function badge(text, type) { return '<span class="badge badge-' + (type || 'info') + '">' + esc(text) + '</span>'; }
function table(headers, rows) {
  if (!rows.length) return emptyState('fa-inbox', 'Sem registros');
  return '<div class="table-wrap"><table><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#e2e8f0"/><text x="100" y="130" font-size="80" text-anchor="middle">📦</text></svg>');
function imgSrc(p) { return p && p.imagem ? p.imagem : PLACEHOLDER; }
function aplicarLogo() {
  const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const src = (emp.logo && emp.logo.indexOf('data:') === 0) ? emp.logo : 'logo.png';
  ['loadingLogo', 'setupLogo', 'authLogo', 'topbarLogo'].forEach(id => { const el = $(id); if (el) el.innerHTML = '<img src="' + src + '" alt="Logo" onerror="this.parentElement.textContent=\'K\'">'; });
}

/* ====== DASHBOARD ====== */
async function renderDashboard() {
  const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const hoje = new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const html = header('Bem-vindo, ' + (emp.nome || 'Admin'), hoje + ' • NIF: ' + (emp.nif || '-'), 'var(--primary)', '', 'fa-chart-pie') +
    '<div class="metric-grid">' +
    '<div class="metric-card" onclick="openModule(\'vendas\')"><div class="label">💰 Vendas</div><div class="value" id="dashVendas">...</div><div class="sub" id="dashVendasSub">...</div><i class="fas fa-money-bill-wave icon"></i></div>' +
    '<div class="metric-card" onclick="openModule(\'produtos\')" style="border-left-color:var(--info)"><div class="label">📦 Produtos</div><div class="value" id="dashProdutos">...</div><div class="sub" id="dashProdutosSub">...</div><i class="fas fa-boxes icon"></i></div>' +
    '<div class="metric-card" onclick="openModule(\'clientes\')" style="border-left-color:var(--warning)"><div class="label">👥 Clientes</div><div class="value" id="dashClientes">...</div><div class="sub" id="dashClientesSub">...</div><i class="fas fa-users icon"></i></div>' +
    '<div class="metric-card" onclick="openModule(\'pdv\')" style="border-left-color:var(--success)"><div class="label">🛒 PDV</div><div class="value">Abrir</div><div class="sub">Nova venda</div><i class="fas fa-cash-register icon"></i></div></div>' +
    '<div class="metric-grid">' +
    '<div class="metric-card" onclick="openModule(\'financeiro\')" style="border-left-color:var(--success)"><div class="label">📥 A Receber</div><div class="value" style="color:var(--success)" id="dashReceber">...</div></div>' +
    '<div class="metric-card" onclick="openModule(\'financeiro\')" style="border-left-color:var(--danger)"><div class="label">📤 A Pagar</div><div class="value" style="color:var(--danger)" id="dashPagar">...</div></div>' +
    '<div class="metric-card" onclick="openModule(\'notificacoes\')" style="border-left-color:var(--warning)"><div class="label">🔔 Não Lidas</div><div class="value" id="dashNotif">...</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-bolt"></i> Ações Rápidas</h3></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">' +
    '<button class="btn btn-success btn-lg" onclick="openModule(\'pdv\')"><i class="fas fa-cash-register"></i> Nova Venda</button>' +
    '<button class="btn btn-primary btn-lg" onclick="abrirModalProduto()"><i class="fas fa-plus"></i> Novo Produto</button>' +
    '<button class="btn btn-info btn-lg" onclick="abrirModalCliente()"><i class="fas fa-user-plus"></i> Novo Cliente</button>' +
    '<button class="btn btn-warning btn-lg" onclick="openModule(\'estoque\')"><i class="fas fa-warehouse"></i> Estoque</button></div></div>';
  Promise.all([getData('produtos'), getData('clientes'), getData('vendas'), getData('contasReceber'), getData('contasPagar'), getData('notificacoes')]).then(([prod, cli, vend, cRec, cPag, notifs]) => {
    const totalV = vend.reduce((s, v) => s + (v.total || 0), 0);
    const baixo = prod.filter(p => (p.estoque || 0) < (p.estoqueMin || 10)).length;
    const totalR = cRec.filter(c => c.status !== 'pago').reduce((s, c) => s + (c.valor || 0), 0);
    const totalP = cPag.filter(c => c.status !== 'pago').reduce((s, c) => s + (c.valor || 0), 0);
    const naoLidas = notifs.filter(n => !n.lida).length;
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('dashVendas', fmt(totalV)); set('dashVendasSub', vend.length + ' vendas');
    set('dashProdutos', prod.length); set('dashProdutosSub', baixo + ' estoque baixo');
    set('dashClientes', cli.length); set('dashClientesSub', 'cadastrados');
    set('dashReceber', fmt(totalR)); set('dashPagar', fmt(totalP)); set('dashNotif', naoLidas);
  }).catch(() => { });
  return html;
}

/* ====== PERFIL ====== */
async function renderPerfil() {
  const user = JSON.parse(localStorage.getItem('kanawa_user') || '{}');
  const avatarSrc = user.avatar || '';
  return header('Meu Perfil', 'Editar dados pessoais', 'var(--primary)', '', 'fa-user-circle') +
    '<div class="card"><div style="display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:start">' +
    '<div style="text-align:center"><div style="position:relative;display:inline-block">' +
    '<img id="perfilAvatarImg" src="' + (avatarSrc || 'logo.png') + '" style="width:150px;height:150px;border-radius:50%;object-fit:cover;border:4px solid var(--primary);background:#f0f0f0" onerror="this.src=\'logo.png\'">' +
    '<label for="perfilAvatarInput" style="position:absolute;bottom:5px;right:5px;background:var(--primary);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:3px solid var(--bg-card)"><i class="fas fa-camera"></i></label>' +
    '<input type="file" id="perfilAvatarInput" accept="image/*" style="display:none" onchange="escolherAvatarPerfil(this)"></div>' +
    '<div style="margin-top:12px"><button class="btn btn-sm btn-danger" onclick="removerAvatarPerfil()"><i class="fas fa-trash"></i> Remover foto</button></div></div>' +
    '<div><div class="form-grid">' +
    '<div class="form-group full"><label>Nome Completo *</label><input id="perfilNome" value="' + esc(user.nome || '') + '"></div>' +
    '<div class="form-group"><label>Email *</label><input id="perfilEmail" type="email" value="' + esc(user.email || '') + '"></div>' +
    '<div class="form-group"><label>Telefone</label><input id="perfilTel" value="' + esc(user.telefone || '') + '"></div>' +
    '<div class="form-group"><label>Perfil / Cargo</label><select id="perfilRole">' + ['admin', 'gerente', 'operador', 'caixa'].map(r => '<option value="' + r + '" ' + (user.role === r ? 'selected' : '') + '>' + r.charAt(0).toUpperCase() + r.slice(1) + '</option>').join('') + '</select></div>' +
    '<div class="form-group"><label>NIF</label><input id="perfilNif" value="' + esc(user.nif || '') + '"></div>' +
    '</div></div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-lock"></i> Alterar Senha</h3></div>' +
    '<div class="form-grid" style="max-width:500px">' +
    '<div class="form-group full"><label>Senha Atual</label><input type="password" id="perfilSenhaAtual"></div>' +
    '<div class="form-group"><label>Nova Senha</label><input type="password" id="perfilNovaSenha" minlength="6"></div>' +
    '<div class="form-group"><label>Confirmar Nova Senha</label><input type="password" id="perfilConfSenha" minlength="6"></div></div>' +
    '<button class="btn btn-warning" onclick="alterarSenhaPerfil()"><i class="fas fa-key"></i> Alterar Senha</button></div>' +
    '<div class="card" style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn btn-success btn-lg" onclick="salvarPerfil()"><i class="fas fa-save"></i> Salvar Alterações</button>' +
    '<button class="btn btn-secondary btn-lg" onclick="openModule(\'dashboard\')"><i class="fas fa-arrow-left"></i> Cancelar</button></div>';
}
function escolherAvatarPerfil(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Imagem muito grande (máx 2MB)', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = e => { const url = e.target.result; if ($('perfilAvatarImg')) $('perfilAvatarImg').src = url; localStorage.setItem('kanawa_avatar_temp', url); toast('✅ Foto carregada — clique em Salvar', 'success'); };
  reader.readAsDataURL(file);
}
function removerAvatarPerfil() { localStorage.removeItem('kanawa_avatar_temp'); localStorage.setItem('kanawa_avatar_remove', 'true'); if ($('perfilAvatarImg')) $('perfilAvatarImg').src = 'logo.png'; toast('Foto removida — clique em Salvar', 'info'); }
async function salvarPerfil() {
  const user = JSON.parse(localStorage.getItem('kanawa_user') || '{}');
  const nome = $('perfilNome').value.trim(), email = $('perfilEmail').value.trim();
  if (!nome || !email) { toast('Preencha nome e email', 'warning'); return; }
  user.nome = nome; user.email = email; user.telefone = $('perfilTel').value; user.role = $('perfilRole').value; user.nif = $('perfilNif').value;
  if (localStorage.getItem('kanawa_avatar_temp')) { user.avatar = localStorage.getItem('kanawa_avatar_temp'); localStorage.removeItem('kanawa_avatar_temp'); }
  if (localStorage.getItem('kanawa_avatar_remove')) { delete user.avatar; localStorage.removeItem('kanawa_avatar_remove'); }
  localStorage.setItem('kanawa_user', JSON.stringify(user));
  try { const users = await DB.getAll('usuarios'); const match = users.find(u => u.email === user.email || u.id === 1); if (match) { match.nome = nome; match.email = email; match.telefone = user.telefone; match.perfil = user.role; match.nif = user.nif; if (user.avatar) match.avatar = user.avatar; await DB.put('usuarios', match); } } catch (e) { }
  if ($('userName')) $('userName').textContent = nome;
  if ($('userRole')) $('userRole').textContent = user.role;
  if ($('userAvatar')) { $('userAvatar').src = user.avatar || 'logo.png'; $('userAvatar').onerror = function () { this.src = 'logo.png'; }; }
  await registrarAuditoria('editar', 'perfil', { nome, email });
  toast('✅ Perfil atualizado', 'success');
  openModule('perfil');
}
async function alterarSenhaPerfil() {
  const user = JSON.parse(localStorage.getItem('kanawa_user') || '{}');
  const atual = $('perfilSenhaAtual').value, nova = $('perfilNovaSenha').value, conf = $('perfilConfSenha').value;
  if (!atual || !nova || !conf) { toast('Preencha todos os campos', 'warning'); return; }
  if (nova !== conf) { toast('Senhas não coincidem', 'error'); return; }
  if (nova.length < 6) { toast('Senha muito curta', 'warning'); return; }
  const users = await DB.getAll('usuarios');
  const match = users.find(u => u.email === user.email || u.id === 1);
  if (match && match.senha && match.senha !== atual) { toast('Senha atual incorreta', 'error'); return; }
  if (match) { match.senha = nova; await DB.put('usuarios', match); }
  $('perfilSenhaAtual').value = ''; $('perfilNovaSenha').value = ''; $('perfilConfSenha').value = '';
  await registrarAuditoria('editar', 'senha', {});
  toast('✅ Senha alterada', 'success');
}

/* ====== DISPOSITIVOS ====== */
async function renderDispositivos() {
  const disps = await getData('dispositivos');
  const detectadas = await detectarImpressoras();
  return header('Dispositivos & Impressoras', 'Auto-detecção + configuração manual', 'var(--info)',
    '<button class="btn btn-success" onclick="abrirModalDispositivo()"><i class="fas fa-plus"></i> Adicionar</button>' +
    '<button class="btn btn-primary" onclick="detectarEDetalhes()"><i class="fas fa-search"></i> Detectar Novamente</button>', 'fa-print') +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-search"></i> Dispositivos Detectados</h3></div>' +
    '<div>' + (detectadas.length ? detectadas.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px"><div><strong>' + esc(d.nome) + '</strong><br><small style="color:var(--text-muted)">' + esc(d.tipo) + ' • ' + esc(d.metodo) + '</small></div><div>' + badge(d.disponivel ? 'Disponível' : 'Indisponível', d.disponivel ? 'success' : 'secondary') + '</div></div>').join('') : '<div style="padding:12px;color:var(--text-muted);text-align:center"><i class="fas fa-info-circle"></i> Nenhum dispositivo detectado. Use "Adicionar".</div>') + '</div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-question-circle"></i> Como Conectar</h3></div>' +
    '<div style="font-size:.9rem;line-height:1.9;color:var(--text-muted)"><p><strong>🖨️ Impressora Térmica (58mm/80mm):</strong> USB/Bluetooth — detectada automaticamente</p>' +
    '<p><strong>📄 Impressora A4:</strong> USB/Rede — configurar no Windows</p>' +
    '<p><strong>💰 Gaveta de Dinheiro:</strong> conecta na impressora térmica via RJ11 (ESC/POS abre automaticamente)</p></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Minhas Configurações</h3></div>' +
    (disps.length ? '<div style="display:grid;gap:12px">' + disps.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px;border:1px solid var(--border);border-radius:8px;gap:10px;flex-wrap:wrap"><div style="flex:1"><div style="font-weight:700">' + esc(d.nome) + ' ' + badge(d.padrao ? 'Padrão' : 'Secundária', d.padrao ? 'success' : 'secondary') + '</div><div style="font-size:.85rem;color:var(--text-muted);margin-top:4px">Tipo: ' + esc(d.tipo) + ' • Conexão: ' + esc(d.conexao) + '</div></div><div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="btn btn-sm btn-primary" onclick="testarImpressora(' + d.id + ')"><i class="fas fa-print"></i> Testar</button>' +
      (d.tipo !== 'gaveta' ? '<button class="btn btn-sm btn-warning" onclick="abrirGaveta(' + d.id + ')"><i class="fas fa-cash-register"></i> Gaveta</button>' : '') +
      '<button class="btn btn-sm btn-info" onclick="definirPadrao(' + d.id + ')"><i class="fas fa-star"></i></button>' +
      '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'dispositivos\',' + d.id + ',\'dispositivos\')"><i class="fas fa-trash"></i></button></div></div>').join('') + '</div>' : emptyState('fa-print', 'Nenhum dispositivo configurado')) + '</div>';
}
async function detectarImpressoras() {
  const det = [];
  if (window.kanawaNative && window.kanawaNative.listarImpressoras) { try { const l = await window.kanawaNative.listarImpressoras(); l.forEach(i => det.push({ nome: i.name, tipo: 'Sistema', metodo: 'Electron', disponivel: true })); } catch (e) { } }
  try { if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) { const dv = await navigator.mediaDevices.enumerateDevices(); dv.filter(d => d.kind === 'audiooutput' || d.kind === 'videoinput').forEach(d => { if (!det.find(x => x.nome === d.label)) det.push({ nome: d.label || 'Dispositivo sem nome', tipo: d.kind, metodo: 'MediaDevices', disponivel: true }); }); } } catch (e) { }
  if (navigator.serial) { try { const p = await navigator.serial.getPorts(); p.forEach((pp, i) => det.push({ nome: 'Porta Serial ' + (i + 1), tipo: 'Serial', metodo: 'Web Serial', disponivel: true })); } catch (e) { } }
  if (navigator.usb) { try { const dv = await navigator.usb.getDevices(); dv.forEach(d => det.push({ nome: d.productName || 'USB Device', tipo: 'USB', metodo: 'Web USB', disponivel: true })); } catch (e) { } }
  return det;
}
function detectarEDetalhes() { toast('🔍 Detectando dispositivos...', 'info'); setTimeout(() => { openModule('dispositivos'); toast('✅ Detecção concluída', 'success'); }, 1000); }
function abrirModalDispositivo() {
  openModal('Adicionar Dispositivo',
    '<div class="form-group"><label>Nome / Identificação *</label><input id="dispNome" placeholder="Ex: Epson TM-T20"></div>' +
    '<div class="form-group"><label>Tipo</label><select id="dispTipo"><option value="termica_58">Impressora Térmica 58mm</option><option value="termica_80">Impressora Térmica 80mm</option><option value="a4">Impressora A4</option><option value="gaveta">Gaveta de Dinheiro</option><option value="balanca">Balança</option><option value="leitor">Leitor de Código</option></select></div>' +
    '<div class="form-group"><label>Conexão</label><select id="dispConexao"><option value="USB">USB</option><option value="Bluetooth">Bluetooth</option><option value="Rede">Rede (Wi-Fi)</option><option value="Serial">Serial (COM)</option></select></div>' +
    '<div class="form-group"><label>Nome no sistema (opcional)</label><input id="dispSistema" placeholder="Ex: EPSON TM-T20 Receipt"></div>' +
    '<div class="form-group"><label><input type="checkbox" id="dispPadrao" checked> Definir como padrão</label></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarDispositivo()">Salvar</button>');
}
async function salvarDispositivo() {
  const nome = $('dispNome').value.trim();
  if (!nome) { toast('Informe o nome', 'warning'); return; }
  const isP = $('dispPadrao').checked;
  if (isP) { const all = await DB.getAll('dispositivos'); for (const d of all) { d.padrao = false; await DB.put('dispositivos', d); } }
  await saveData('dispositivos', { nome, tipo: $('dispTipo').value, conexao: $('dispConexao').value, dispositivoSistema: $('dispSistema').value, padrao: isP, data: now() });
  toast('✅ Dispositivo adicionado', 'success');
  closeModal(); openModule('dispositivos');
}
async function definirPadrao(id) { const all = await DB.getAll('dispositivos'); for (const d of all) { d.padrao = (d.id === id); await DB.put('dispositivos', d); } toast('✅ Definido como padrão', 'success'); openModule('dispositivos'); }
async function testarImpressora(id) {
  const d = await DB.get('dispositivos', id); if (!d) return;
  const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write('<html><head><title>Teste ' + esc(d.nome) + '</title></head><body style="font-family:monospace;text-align:center;padding:20px;font-size:12px">' +
    '<h2 style="margin:0">' + (emp.firma || emp.nome || 'KANAWA SOFT') + '</h2>' +
    '<p style="font-size:10px">' + esc(emp.endereco || 'Luanda, Angola') + '</p>' +
    '<p style="font-size:10px">NIF: ' + esc(emp.nif || '-') + '</p><hr><h3>=== TESTE DE IMPRESSÃO ===</h3>' +
    '<p>Dispositivo: <strong>' + esc(d.nome) + '</strong></p><p>Tipo: ' + esc(d.tipo) + '</p>' +
    '<p>Conexão: ' + esc(d.conexao) + '</p><p>' + new Date().toLocaleString('pt-AO') + '</p><hr>' +
    '<p>Se você está vendo este recibo impresso, a impressora está funcionando!</p><hr>' +
    '<p style="font-size:10px">Kanawa Soft ERP v' + APP_VERSION + '</p></body></html>');
  w.document.close(); setTimeout(() => { w.print(); }, 500);
  toast('📄 Teste enviado para impressão', 'success');
}
function abrirGaveta(id) {
  toast('💵 Enviando comando para abrir gaveta...', 'info');
  try {
    if (navigator.serial) { navigator.serial.getPorts().then(ports => { if (ports.length > 0) { const p = ports[0]; return p.open({ baudRate: 9600 }).then(() => { const w = p.writable.getWriter(); const cmd = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]); return w.write(cmd).then(() => w.releaseLock()).then(() => p.close()); }).then(() => toast('✅ Gaveta aberta via Serial', 'success')); } }).catch(e => console.warn('Serial:', e.message)); }
    if (window.kanawaNative && window.kanawaNative.abrirGaveta) { window.kanawaNative.abrirGaveta().then(() => { toast('✅ Comando enviado', 'success'); }).catch(() => { }); }
    setTimeout(() => { console.log('ESC/POS: 0x1B 0x70 0x00 0x19 0xFA'); }, 500);
  } catch (e) { console.warn(e); }
}
function abrirGavetaAutomatico() {
  try {
    if (localStorage.getItem('kanawa_gaveta_auto') !== 'false') {
      if (navigator.serial) { navigator.serial.getPorts().then(ports => { if (ports.length > 0) { const p = ports[0]; p.open({ baudRate: 9600 }).then(() => { const w = p.writable.getWriter(); const cmd = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]); return w.write(cmd).then(() => w.releaseLock()).then(() => p.close()); }).catch(() => { }); } }).catch(() => { }); }
    }
  } catch (e) { }
}
/* ====== FATURA COM QR CODE + AGT ====== */
async function abrirFatura(venda) {
  await carregarConfigEmpresa();
  await carregarConfigFatura();
  const emp = Object.assign({}, venda.empresa || {}, JSON.parse(localStorage.getItem('kanawa_empresa') || '{}'));
  const logo = (emp.logo && emp.logo.indexOf('data:') === 0) ? emp.logo : (emp.logo || 'logo.png');
  const qrText = JSON.stringify({ document: venda.numeroFatura, date: venda.data, companyTaxId: emp.nif || null, total: Number(venda.total || 0), currency: 'AOA' });
  const subtotal = Number(venda.subtotal || 0), desconto = Number(venda.descontoValor || 0), base = subtotal - desconto, iva = Number(venda.iva || 0), total = Number(venda.total || 0);
  const totalExtenso = numeroPorExtenso(total);
  const itensHTML = (venda.itens || []).map((it, i) => '<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:6px;font-size:.75rem">' + (i + 1) + '</td><td style="padding:6px;font-size:.75rem">' + esc(it.nome) + '</td><td style="padding:6px;text-align:center;font-size:.75rem">' + it.qty + '</td><td style="padding:6px;text-align:right;font-size:.75rem">' + fmt(it.preco) + '</td><td style="padding:6px;text-align:right;font-size:.75rem">' + fmt(it.subtotal || it.preco * it.qty) + '</td></tr>').join('');
  const invoiceSettings = window.KanawaInvoiceTemplates ? KanawaInvoiceTemplates.getSettings() : {};
  const faturaHTML = window.KanawaInvoiceTemplates
    ? KanawaInvoiceTemplates.render(venda, emp, logo, invoiceSettings)
    : '<div id="faturaPreview"><h2>' + esc(emp.firma || emp.nome || 'Empresa') + '</h2><p>Modelo de fatura indisponível.</p></div>';
  window._vendaAtual = venda;
  openModal('🖨️ Fatura / Recibo — ' + venda.numeroFatura,
    '<div style="max-height:65vh;overflow-y:auto;background:#fff;padding:0;border-radius:var(--radius-sm)">' + faturaHTML + '</div>' +
    '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
    '<button class="btn btn-success" onclick="imprimirFatura()"><i class="fas fa-print"></i> A4</button>' +
    '<button class="btn btn-primary" onclick="imprimirTermica()"><i class="fas fa-receipt"></i> Térmica</button>' +
    '<button class="btn btn-info" onclick="baixarFaturaPDF()"><i class="fas fa-file-pdf"></i> PDF</button>' +
    '<button class="btn btn-warning" onclick="compartilharWhatsApp(window._vendaAtual)"><i class="fab fa-whatsapp"></i> WhatsApp</button>' +
    '<button class="btn btn-purple" onclick="abrirGaveta()"><i class="fas fa-cash-register"></i> Abrir Gaveta</button>' +
    '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>', true);
  if (invoiceSettings.showQr === true) setTimeout(() => gerarQRCodeFatura(qrText), 250);
}

function gerarQRCodeFatura(texto) {
  const container = $('qrcodeContainer'); if (!container) return;
  container.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    container.textContent = 'QR indisponível neste dispositivo';
    return;
  }
  try {
    new QRCode(container, { text: String(texto), width: 120, height: 120, colorDark: '#1a3a5c', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  } catch (error) {
    console.warn('Não foi possível gerar um QR válido:', error);
    container.textContent = 'Não foi possível gerar o QR';
  }
}

function imprimirFatura() {
  const el = $('faturaPreview'); if (!el) return;
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>Fatura</title><style>body{font-family:Arial;padding:20px;margin:0}table{width:100%;border-collapse:collapse}th{background:#1a3a5c;color:#fff;padding:8px}td{padding:6px;border-bottom:1px solid #e2e8f0}@media print{@page{margin:5mm}}</style></head><body>' + el.innerHTML + '</body></html>');
  w.document.close(); setTimeout(() => { w.print(); }, 500);
}
function imprimirTermica() {
  const v = window._vendaAtual; if (!v) return;
  const emp = v.empresa || JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const texto = ['=================================', '   ' + (emp.firma || emp.nome || 'KANAWA SOFT').toUpperCase(), '   NIF: ' + (emp.nif || '-'), '   ' + (emp.endereco || 'Luanda, Angola'), '   Tel: ' + (emp.telefone || '-'), '=================================', 'FATURA-RECIBO: ' + v.numeroFatura, 'Data: ' + fmtDT(v.data), 'Cliente: ' + v.clienteNome, (v.clienteNif ? 'NIF: ' + v.clienteNif : ''), '=================================', ...(v.itens || []).map(it => it.nome.substring(0, 20).padEnd(20) + '\n  ' + it.qty + ' x ' + fmt(it.preco).padEnd(12) + fmt(it.subtotal)), '=================================', 'Subtotal:    ' + fmt(v.subtotal), (v.desconto > 0 ? 'Desconto:    -' + fmt(v.descontoValor) : ''), 'Imposto:     ' + fmt(v.iva), 'TOTAL:       ' + fmt(v.total), v.valorRecebido > 0 ? 'Recebido:    ' + fmt(v.valorRecebido) : '', v.valorRecebido > 0 ? 'Troco:       ' + fmt(v.troco) : '', '=================================', 'Valor: ' + numeroPorExtenso(v.total), '---------------------------------', (emp.banco ? 'Banco: ' + emp.banco : ''), (emp.iban ? 'IBAN: ' + emp.iban : ''), '---------------------------------', '    Obrigado pela preferência!', '   Processado por Kanawa Soft ERP', '       www.kanawasoft.com', '================================='].filter(Boolean).join('\n');
  const w = window.open('', '_blank', 'width=300,height=600');
  w.document.write('<html><head><title>Recibo</title><style>@media print{@page{margin:0;size:58mm auto}}body{font-family:"Courier New",monospace;font-size:11px;width:200px;margin:0 auto;padding:5px;white-space:pre;line-height:1.3}</style></head><body>' + texto + '</body></html>');
  w.document.close(); setTimeout(() => { w.print(); }, 500); abrirGavetaAutomatico();
}
async function baixarFaturaPDF() {
  const el = $('faturaPreview'); if (!el) return;
  if (!window.jspdf) { toast('PDF indisponível', 'warning'); return; }
  const { jsPDF } = window.jspdf; const d = new jsPDF('p', 'pt', 'a4');
  d.html(el, { callback: x => { x.save('fatura_' + Date.now() + '.pdf'); toast('📄 PDF baixado', 'success'); }, x: 10, y: 10, width: 580 });
}
function compartilharWhatsApp(v) {
  if (!v) return;
  const txt = '*' + (v.empresa && v.empresa.nome || 'Kanawa') + '*\n\nFatura: ' + v.numeroFatura + '\nData: ' + fmtDT(v.data) + '\nTotal: ' + fmt(v.total) + '\n\n' + (v.itens || []).map(i => '• ' + i.nome + ' x' + i.qty + ' = ' + fmt(i.subtotal)).join('\n') + '\n\nHash: ' + v.hash;
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

/* ====== PDV ====== */
async function carregarCachePDV(force) {
  const t = Date.now();
  if (!force && pdvCache.produtos.length && (t - pdvCache.ts) < 30000) return pdvCache.produtos;
  pdvCache.produtos = await getData('produtos'); pdvCache.ts = t; return pdvCache.produtos;
}
function renderGridProdutos(produtos, favs) {
  if (!produtos.length) return '<div style="grid-column:1/-1">' + emptyState('fa-box-open', 'Sem produtos — clique em "Novo"') + '</div>';
  return produtos.slice(0, 150).map(p => {
    const isFav = favs.indexOf(p.id) !== -1;
    return '<div class="pdv-prod-card" data-id="' + p.id + '" data-nome="' + esc((p.nome || '').toLowerCase()) + '" onclick="pdvSelecionarProduto(' + p.id + ')">' +
      '<span class="favorite ' + (isFav ? 'active' : '') + '" onclick="event.stopPropagation();toggleFavorito(' + p.id + ',this)"><i class="fas fa-star"></i></span>' +
      '<div class="img"><img src="' + imgSrc(p) + '" alt="' + esc(p.nome) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div>' +
      '<div class="info"><div class="name">' + esc(p.nome) + '</div><div class="price">' + fmt(p.preco) + '</div>' +
      '<div class="stock">Estoque: ' + (p.estoque || 0) + '</div>' + (p.codigoBarras ? '<div class="codigo">' + esc(p.codigoBarras) + '</div>' : '') + '</div></div>';
  }).join('');
}

async function renderPDV() {
  const produtos = await carregarCachePDV();
  const favs = pdvCache.favoritos;
  const pags = [{ v: 'dinheiro', i: 'fa-money-bill-wave', l: 'Dinheiro' }, { v: 'cartao', i: 'fa-credit-card', l: 'Cartão' }, { v: 'transferencia', i: 'fa-university', l: 'Transferência' }, { v: 'multicaixa', i: 'fa-mobile-alt', l: 'Multicaixa' }, { v: 'misto', i: 'fa-random', l: 'Misto' }, { v: 'credito', i: 'fa-file-invoice', l: 'Crédito' }];
  return header('PDV — Ponto de Venda', produtos.length + ' produtos disponíveis', 'var(--success)',
    '<button class="btn btn-sm" onclick="abrirScanner()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-barcode"></i> Scanner</button>' +
    '<button class="btn btn-sm" onclick="imprimirEtiquetasLote()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-tags"></i> Etiquetas</button>' +
    '<button class="btn btn-sm" onclick="openModule(\'vendas\')" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-history"></i> Histórico</button>', 'fa-cash-register') +
    '<div class="pdv-breadcrumb"><div class="step active" data-step="1"><span class="num">1</span>Produtos</div><span class="sep">›</span><div class="step" data-step="2"><span class="num">2</span>Carrinho</div><span class="sep">›</span><div class="step" data-step="3"><span class="num">3</span>Cliente</div><span class="sep">›</span><div class="step" data-step="4"><span class="num">4</span>Pagamento</div><span class="sep">›</span><div class="step" data-step="5"><span class="num">5</span>Valores</div><span class="sep">›</span><div class="step" data-step="6"><span class="num">6</span>Finalizar</div></div>' +
    '<div class="pdv-screen active" id="pdvScreen1"><div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-boxes"></i> Produtos</h3><div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<input type="text" id="pdvBusca" placeholder="🔍 Buscar..." style="padding:10px 14px;border:2px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);min-width:200px" oninput="filtrarPDV(this.value)">' +
    '<input type="text" id="pdvCodigoBarras" placeholder="📷 Código" style="padding:10px 14px;border:2px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);width:150px" onkeypress="if(event.key===\'Enter\'){buscarPorCodigo(this.value);this.value=\'\'}">' +
    '<button class="btn btn-sm btn-info" onclick="abrirScanner()"><i class="fas fa-camera"></i></button></div></div>' +
    '<div class="pdv-products-grid" id="pdvProductsGrid">' + renderGridProdutos(produtos, favs) + '</div></div>' +
    '<div style="position:sticky;bottom:16px;background:var(--bg-card);padding:16px;border-radius:14px;box-shadow:var(--shadow-hover);display:flex;justify-content:space-between;align-items:center;margin-top:16px;border:1px solid var(--border)">' +
    '<div><div style="font-size:.8rem;color:var(--text-muted)">Carrinho</div><div style="font-size:1.3rem;font-weight:800" id="pdvScreen1Total">' + pdvState.carrinho.length + ' itens</div></div>' +
    '<button class="btn btn-primary btn-lg" onclick="pdvIrParaTela(2)">Ver Carrinho <i class="fas fa-arrow-right"></i></button></div></div>' +
    '<div class="pdv-screen" id="pdvScreen2"><div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-shopping-cart"></i> Carrinho</h3><button class="btn btn-sm btn-secondary" onclick="pdvIrParaTela(1)"><i class="fas fa-arrow-left"></i> Voltar</button></div><div class="pdv-cart-full" id="pdvCarrinhoFull"></div></div>' +
    '<div style="position:sticky;bottom:16px;background:var(--bg-card);padding:16px;border-radius:14px;box-shadow:var(--shadow-hover);display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border)">' +
    '<div><div style="font-size:.8rem;color:var(--text-muted)">Subtotal</div><div style="font-size:1.5rem;font-weight:800;color:var(--secondary)" id="pdvSubtotalTela2">' + fmt(0) + '</div></div>' +
    '<button class="btn btn-primary btn-lg" onclick="pdvIrParaTela(3)">Continuar <i class="fas fa-arrow-right"></i></button></div></div>' +
    '<div class="pdv-screen" id="pdvScreen3"><div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-user"></i> Cliente</h3><button class="btn btn-sm btn-secondary" onclick="pdvIrParaTela(2)"><i class="fas fa-arrow-left"></i> Voltar</button></div>' +
    '<div class="form-grid" style="max-width:600px"><div class="form-group full"><label>Nome *</label><input id="pdvClienteNome" value="' + esc(pdvState.cliente.nome) + '"></div>' +
    '<div class="form-group"><label>NIF</label><input id="pdvClienteNif" value="' + esc(pdvState.cliente.nif) + '"></div>' +
    '<div class="form-group"><label>Telefone</label><input id="pdvClienteTel" value="' + esc(pdvState.cliente.telefone) + '"></div></div>' +
    '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-info" onclick="abrirModalPDVCliente()"><i class="fas fa-user-plus"></i> Novo Cliente</button><button class="btn btn-secondary" onclick="pdvClienteAnonimo()"><i class="fas fa-user-secret"></i> Anônimo</button></div></div>' +
    '<div style="position:sticky;bottom:16px;background:var(--bg-card);padding:16px;border-radius:14px;box-shadow:var(--shadow-hover);display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border)">' +
    '<div><div style="font-size:.8rem;color:var(--text-muted)">Cliente</div><div style="font-size:1.1rem;font-weight:700" id="pdvClienteResumo">' + esc(pdvState.cliente.nome) + '</div></div>' +
    '<button class="btn btn-primary btn-lg" onclick="pdvSalvarCliente()">Continuar <i class="fas fa-arrow-right"></i></button></div></div>' +
    '<div class="pdv-screen" id="pdvScreen4"><div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-credit-card"></i> Pagamento</h3><button class="btn btn-sm btn-secondary" onclick="pdvIrParaTela(3)"><i class="fas fa-arrow-left"></i> Voltar</button></div>' +
    '<div class="payment-methods-grid">' + pags.map(p => '<div class="payment-method-card ' + (pdvState.pagamento === p.v ? 'selected' : '') + '" data-payment="' + p.v + '" onclick="pdvSelecionarPagamento(\'' + p.v + '\')"><i class="fas ' + p.i + '"></i><span>' + p.l + '</span></div>').join('') + '</div></div>' +
    '<div style="position:sticky;bottom:16px;background:var(--bg-card);padding:16px;border-radius:14px;box-shadow:var(--shadow-hover);display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border)">' +
    '<div><div style="font-size:.8rem;color:var(--text-muted)">Pagamento</div><div style="font-size:1.1rem;font-weight:700" id="pdvPagamentoResumo">Dinheiro</div></div>' +
    '<button class="btn btn-primary btn-lg" onclick="pdvIrParaTela(5)">Continuar <i class="fas fa-arrow-right"></i></button></div></div>' +
    '<div class="pdv-screen" id="pdvScreen5"><div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-calculator"></i> Valores e Impostos</h3><button class="btn btn-sm btn-secondary" onclick="pdvIrParaTela(4)"><i class="fas fa-arrow-left"></i> Voltar</button></div>' +
    '<div class="form-grid">' +
    '<div class="form-group"><label>🏷️ Desconto (%) máx: ' + getPerms().descontoMax + '%</label><input type="number" id="pdvDescontoInput" value="' + pdvState.desconto + '" min="0" max="' + getPerms().descontoMax + '" oninput="pdvAtualizarValores()" style="font-size:1.1rem;text-align:right"></div>' +
    '<div class="form-group"><label>💰 Valor Recebido</label><input type="number" id="pdvValorRecebidoInput" value="' + pdvState.valorRecebido + '" oninput="pdvAtualizarValores()" style="font-size:1.1rem;text-align:right"></div>' +
    '<div class="form-group"><label>⚖️ Regime Fiscal</label><select id="pdvRegimeInput" onchange="pdvAtualizarValores()"><option value="geral" ' + (pdvState.regime === 'geral' ? 'selected' : '') + '>Regime Geral (IVA 14%)</option><option value="simplificado" ' + (pdvState.regime === 'simplificado' ? 'selected' : '') + '>Simplificado (7%)</option><option value="isento" ' + (pdvState.regime === 'isento' ? 'selected' : '') + '>Isento</option></select></div>' +
    '<div class="form-group"><label>Aplicações</label><div style="padding-top:6px"><label style="display:block;margin-bottom:6px;font-weight:400"><input type="checkbox" id="pdvAplicarIVA" ' + (pdvState.aplicarIVA ? 'checked' : '') + ' onchange="pdvAtualizarValores()"> Aplicar IVA</label></div></div></div>' +
    '<div class="form-group"><label>📝 Observações</label><textarea id="pdvObs" rows="2">' + esc(pdvState.observacoes) + '</textarea></div>' +
    '<div class="total-box" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border-radius:14px;padding:18px;margin:16px 0">' +
    '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>Subtotal:</span><span id="pdvCalcSubtotal">' + fmt(0) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>Desconto:</span><span id="pdvCalcDesconto">-' + fmt(0) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>Montante Ilíquido:</span><span id="pdvCalcBase">' + fmt(0) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>Imposto Devido:</span><span id="pdvCalcIVA">' + fmt(0) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;border-top:2px solid rgba(255,255,255,.3);margin-top:8px;padding-top:12px;font-size:1.3rem;font-weight:800"><span>TOTAL LÍQUIDO:</span><span id="pdvCalcTotal">' + fmt(0) + '</span></div></div>' +
    '<div id="pdvTrocoBox" style="background:linear-gradient(135deg,var(--success),var(--secondary));color:#fff;border-radius:10px;padding:16px;margin-top:12px;display:none"><div style="font-size:.85rem;opacity:.9">💵 Troco</div><div style="font-size:2rem;font-weight:800;margin-top:4px" id="pdvTrocoValue">' + fmt(0) + '</div></div></div>' +
    '<div style="position:sticky;bottom:16px;background:var(--bg-card);padding:16px;border-radius:14px;box-shadow:var(--shadow-hover);display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border)">' +
    '<div><div style="font-size:.8rem;color:var(--text-muted)">Total a Pagar</div><div style="font-size:1.5rem;font-weight:800;color:var(--secondary)" id="pdvTotalFinalTela5">' + fmt(0) + '</div></div>' +
    '<button class="btn btn-primary btn-lg" onclick="pdvIrParaTela(6)">Revisar <i class="fas fa-arrow-right"></i></button></div></div>' +
    '<div class="pdv-screen" id="pdvScreen6"><div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-check-circle"></i> Revisão Final</h3><button class="btn btn-sm btn-secondary" onclick="pdvIrParaTela(5)"><i class="fas fa-arrow-left"></i> Voltar</button></div>' +
    '<div style="background:var(--bg);border-radius:10px;padding:16px;margin-bottom:16px" id="pdvResumoFinal"></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">' +
    '<button class="btn btn-danger btn-lg" onclick="pdvCancelarVenda()"><i class="fas fa-times-circle"></i> Cancelar</button>' +
    '<button class="btn btn-warning btn-lg" onclick="pdvSalvarRascunho()"><i class="fas fa-save"></i> Rascunho</button>' +
    '<button class="btn btn-info btn-lg" onclick="pdvSalvarOrcamento()"><i class="fas fa-file-invoice"></i> Orçamento</button>' +
    '<button class="btn btn-purple btn-lg" onclick="pdvFinalizarVenda()"><i class="fas fa-print"></i> Finalizar & Imprimir</button></div></div></div>';
}

function pdvIrParaTela(n) {
  $$('.pdv-screen').forEach(el => el.classList.remove('active'));
  const t = $('pdvScreen' + n); if (t) t.classList.add('active');
  $$('.pdv-breadcrumb .step').forEach(el => { const s = parseInt(el.dataset.step); el.classList.toggle('active', s === n); el.classList.toggle('done', s < n); });
  pdvState.screen = n;
  if (n === 2) pdvRenderCarrinhoFull();
  if (n === 5) pdvAtualizarValores();
  if (n === 6) pdvRenderResumoFinal();
  const c = $('content'); if (c) c.scrollTop = 0;
}
async function pdvSelecionarProduto(id) {
  const p = pdvCache.produtos.find(x => x.id === id) || await DB.get('produtos', id);
  if (!p) return;
  if ((p.estoque || 0) <= 0) { toast('Produto sem estoque', 'warning'); return; }
  const it = pdvState.carrinho.find(i => i.id === id);
  if (it) { if (it.qty >= p.estoque) { toast('Estoque insuficiente', 'warning'); return; } it.qty++; it.subtotal = it.preco * it.qty; }
  else { pdvState.carrinho.push({ id: p.id, nome: p.nome, preco: p.preco, qty: 1, subtotal: p.preco, imagem: p.imagem, codigoBarras: p.codigoBarras }); }
  toast('✅ ' + p.nome + ' (x' + pdvState.carrinho.length + ')', 'success');
  const el = $('pdvScreen1Total'); if (el) el.textContent = pdvState.carrinho.length + ' itens';
}
function pdvRenderCarrinhoFull() {
  const box = $('pdvCarrinhoFull'); if (!box) return;
  if (!pdvState.carrinho.length) { box.innerHTML = emptyState('fa-shopping-cart', 'Carrinho vazio'); const st = $('pdvSubtotalTela2'); if (st) st.textContent = fmt(0); return; }
  box.innerHTML = pdvState.carrinho.map(i => '<div class="pdv-cart-item-full" style="display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid var(--border);background:var(--bg-card);border-radius:10px;margin-bottom:8px;gap:10px;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:140px"><div style="font-weight:700;font-size:1rem">' + esc(i.nome) + '</div><div style="font-size:.85rem;color:var(--text-muted);margin-top:2px">' + fmt(i.preco) + ' × ' + i.qty + '</div></div>' +
    '<div style="display:flex;align-items:center;gap:10px">' +
    '<button onclick="pdvAltQty(' + i.id + ',-1)" style="width:38px;height:38px;border-radius:50%;border:none;background:var(--primary);color:#fff;cursor:pointer;font-weight:700;font-size:1.1rem">−</button>' +
    '<span style="min-width:44px;text-align:center;font-weight:700;font-size:1.1rem">' + i.qty + '</span>' +
    '<button onclick="pdvAltQty(' + i.id + ',1)" style="width:38px;height:38px;border-radius:50%;border:none;background:var(--primary);color:#fff;cursor:pointer;font-weight:700;font-size:1.1rem">+</button></div>' +
    '<div style="font-weight:800;font-size:1.1rem;min-width:110px;text-align:right">' + fmt(i.subtotal) + '</div>' +
    '<button onclick="pdvRemoverItem(' + i.id + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:1.2rem;padding:6px 10px"><i class="fas fa-trash"></i></button></div>').join('');
  const st = pdvState.carrinho.reduce((s, i) => s + i.subtotal, 0);
  const el = $('pdvSubtotalTela2'); if (el) el.textContent = fmt(st);
}
function pdvAltQty(id, d) { const it = pdvState.carrinho.find(i => i.id === id); if (!it) return; it.qty += d; it.subtotal = it.preco * it.qty; if (it.qty <= 0) pdvState.carrinho = pdvState.carrinho.filter(i => i.id !== id); pdvRenderCarrinhoFull(); }
function pdvRemoverItem(id) { pdvState.carrinho = pdvState.carrinho.filter(i => i.id !== id); pdvRenderCarrinhoFull(); toast('Removido', 'info'); }
function pdvSalvarCliente() { pdvState.cliente.nome = ($('pdvClienteNome').value.trim() || 'Cliente Anônimo'); pdvState.cliente.nif = $('pdvClienteNif').value.trim(); pdvState.cliente.telefone = $('pdvClienteTel').value.trim(); pdvIrParaTela(4); }
function pdvClienteAnonimo() { $('pdvClienteNome').value = 'Cliente Anônimo'; $('pdvClienteNif').value = ''; $('pdvClienteTel').value = ''; pdvState.cliente = { nome: 'Cliente Anônimo', nif: '', telefone: '' }; toast('Cliente anônimo', 'info'); }
function pdvSelecionarPagamento(t) { pdvState.pagamento = t; $$('.payment-method-card').forEach(el => el.classList.toggle('selected', el.dataset.payment === t)); const map = { dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', multicaixa: 'Multicaixa', misto: 'Misto', credito: 'Crédito' }; const el = $('pdvPagamentoResumo'); if (el) el.textContent = map[t] || t; }
function pdvAtualizarValores() {
  const dEl = $('pdvDescontoInput'), vEl = $('pdvValorRecebidoInput'), rEl = $('pdvRegimeInput'), iEl = $('pdvAplicarIVA');
  if (!dEl) return { subtotal: 0, descontoValor: 0, base: 0, iva: 0, total: 0, troco: 0 };
  const maxD = getPerms().descontoMax; let desc = num(dEl.value, 0); if (desc > maxD) { desc = maxD; dEl.value = maxD; }
  const vRec = num(vEl.value, 0), regime = rEl.value, aplicarIVA = iEl.checked;
  pdvState.desconto = desc; pdvState.valorRecebido = vRec; pdvState.regime = regime; pdvState.aplicarIVA = aplicarIVA;
  const subtotal = pdvState.carrinho.reduce((s, i) => s + i.subtotal, 0);
  const descVal = subtotal * (desc / 100), base = subtotal - descVal;
  let taxa = 0; if (aplicarIVA) taxa = regime === 'geral' ? 0.14 : (regime === 'simplificado' ? 0.07 : 0);
  const iva = base * taxa, total = base + iva, troco = vRec - total;
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('pdvCalcSubtotal', fmt(subtotal)); set('pdvCalcDesconto', '-' + fmt(descVal)); set('pdvCalcBase', fmt(base)); set('pdvCalcIVA', fmt(iva)); set('pdvCalcTotal', fmt(total)); set('pdvTotalFinalTela5', fmt(total));
  const tb = $('pdvTrocoBox'), tv = $('pdvTrocoValue');
  if (tb && tv) { if (vRec > 0) { tb.style.display = 'block'; tv.textContent = troco >= 0 ? fmt(troco) : 'Faltam ' + fmt(Math.abs(troco)); } else tb.style.display = 'none'; }
  return { subtotal, descontoValor: descVal, base, iva, total, troco };
}
function pdvRenderResumoFinal() {
  const c = pdvAtualizarValores();
  const map = { dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', multicaixa: 'Multicaixa', misto: 'Misto', credito: 'Crédito' };
  const el = $('pdvResumoFinal'); if (!el) return;
  el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
    '<div><strong style="color:var(--primary)">👤 Cliente</strong><div>' + esc(pdvState.cliente.nome) + '</div>' +
    (pdvState.cliente.nif ? '<div style="font-size:.8rem;color:var(--text-muted)">NIF: ' + esc(pdvState.cliente.nif) + '</div>' : '') + '</div>' +
    '<div><strong style="color:var(--primary)">💳 Pagamento</strong><div>' + (map[pdvState.pagamento] || '') + '</div><div style="font-size:.8rem;color:var(--text-muted)">Regime: ' + pdvState.regime + '</div></div></div>' +
    '<hr style="border:1px dashed var(--border);margin:12px 0">' +
    '<div style="font-size:.88rem">' +
    '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Itens:</span><span>' + pdvState.carrinho.length + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Subtotal:</span><span>' + fmt(c.subtotal) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Desconto (' + pdvState.desconto + '%):</span><span>-' + fmt(c.descontoValor) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Imposto:</span><span>' + fmt(c.iva) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:1.2rem;font-weight:800;border-top:2px solid var(--border);margin-top:6px"><span>TOTAL LÍQUIDO:</span><span style="color:var(--secondary)">' + fmt(c.total) + '</span></div>' +
    '<div style="padding:6px 0;font-size:.75rem;color:var(--text-muted);font-style:italic">' + numeroPorExtenso(c.total) + '</div>' +
    (pdvState.valorRecebido > 0 ? '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Recebido:</span><span>' + fmt(pdvState.valorRecebido) + '</span></div><div style="display:flex;justify-content:space-between;padding:3px 0;color:var(--success);font-weight:700"><span>Troco:</span><span>' + fmt(c.troco) + '</span></div>' : '') + '</div>';
}
function pdvCancelarVenda() { if (!confirm('Cancelar esta venda?')) return; pdvState.carrinho = []; pdvState.cliente = { nome: 'Cliente Anônimo', nif: '', telefone: '' }; pdvState.desconto = 0; pdvState.valorRecebido = 0; toast('Venda cancelada', 'info'); openModule('pdv'); }
async function pdvSalvarRascunho() { await saveData('vendas', Object.assign(copy(pdvState), { status: 'rascunho', data: now() })); toast('📝 Rascunho salvo', 'success'); }
async function pdvSalvarOrcamento() {
  const c=pdvAtualizarValores(),user=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
  const quote=Object.assign(copy(pdvState),{total:c.total,status:'rascunho',empresaCliente:pdvState.cliente.nome||'Consumidor Final',responsavel:user.nome||'Admin',data:now(),dataEnvio:null,dataValidade:null,historico:[{evento:'Proposta criada',data:now(),responsavel:user.nome||'Admin'}]});
  await saveData('orcamentos',quote);toast('Proposta comercial guardada como rascunho.','success');
}
async function pdvFinalizarVenda(modo) {
  modo = modo || 'finalizada';
  if (!pdvState.carrinho.length) { toast('Carrinho vazio', 'warning'); return; }
  const c = pdvAtualizarValores();
  const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const user = JSON.parse(localStorage.getItem('kanawa_user') || '{}');
  let numeroFatura;
  if (modo === 'finalizada') {
    try {
      if (!window.KanawaCloud || !KanawaCloud.ready || typeof KanawaCloud.nextInvoiceNumber !== 'function') {
        throw new Error('Ligue a empresa para obter a numeração sequencial oficial. Pode guardar a proposta enquanto estiver offline.');
      }
      numeroFatura = await KanawaCloud.nextInvoiceNumber();
    } catch (numberError) {
      toast(numberError.message || 'Não foi possível reservar o número sequencial da fatura.', 'error');
      return;
    }
  } else {
    numeroFatura = 'RASCUNHO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);
  }
  const venda = { numeroFatura, clienteNome: pdvState.cliente.nome, clienteNif: pdvState.cliente.nif, clienteTelefone: pdvState.cliente.telefone, itens: pdvState.carrinho.map(i => ({ id: i.id, nome: i.nome, preco: i.preco, qty: i.qty, subtotal: i.subtotal })), subtotal: c.subtotal, desconto: pdvState.desconto, descontoValor: c.descontoValor, iva: c.iva, total: c.total, valorRecebido: pdvState.valorRecebido, troco: c.troco, pagamento: pdvState.pagamento, regime: pdvState.regime, aplicarIVA: pdvState.aplicarIVA, observacoes: pdvState.observacoes, status: modo, data: now(), hash: gerarHash({ total: c.total, data: Date.now() }), operador: user.nome || 'Admin', empresa: emp, orcamentoOrigem: pdvState.orcamentoOrigem || null };
  venda.assinatura = gerarAssinatura(venda);
  try { venda.id = await saveData('vendas', venda); }
  catch (saleError) { toast('Venda não finalizada no servidor: ' + (saleError.message || 'verifique licença e stock'), 'error'); return; }
  if (pdvState.orcamentoOrigem) { const quote=await DB.get('orcamentos',pdvState.orcamentoOrigem); if(quote){quote.status='convertida';quote.vendaId=venda.id||null;quote.dataCompra=now();quote.historico=Array.isArray(quote.historico)?quote.historico:[];quote.historico.push({evento:'Convertida em venda '+numeroFatura,data:now(),responsavel:user.nome||'Admin'});await saveData('orcamentos',quote);} }
  for (const item of pdvState.carrinho) { const p = await DB.get('produtos', item.id); if (p) { p.estoque = Math.max(0, (p.estoque || 0) - item.qty); await saveData('produtos', p, { skipStockSync: true }); } }
  await saveData('movimentacoesEstoque', { tipo: 'saida', descricao: 'Venda ' + numeroFatura, itens: pdvState.carrinho.map(i => ({ id: i.id, nome: i.nome, qtd: i.qty })), data: now() });
  if (pdvState.pagamento === 'credito') await saveData('contasReceber', { cliente: pdvState.cliente.nome, valor: c.total, descricao: 'Venda ' + numeroFatura, vencimento: new Date(Date.now() + 30 * 86400000).toISOString(), status: 'pendente', data: now() });
  await criarNotificacao('Nova Venda', numeroFatura + ' - ' + fmt(c.total), 'success', 'vendas');
  toast('✅ Venda ' + numeroFatura + ': ' + fmt(c.total), 'success');
  abrirFatura(venda); abrirGavetaAutomatico(); pdvCache.ts = 0;
  pdvState.carrinho = []; pdvState.cliente = { nome: 'Cliente Anônimo', nif: '', telefone: '' }; pdvState.desconto = 0; pdvState.valorRecebido = 0; pdvState.orcamentoOrigem = null;
}
function filtrarPDV(termo) {
  const t = (termo || '').toLowerCase().trim(); const grid = $('pdvProductsGrid'); if (!grid) return;
  const filt = pdvCache.produtos.filter(p => (p.nome || '').toLowerCase().indexOf(t) !== -1 || (p.codigoBarras || '').indexOf(t) !== -1 || (p.codigo || '').toLowerCase().indexOf(t) !== -1);
  grid.innerHTML = renderGridProdutos(filt, pdvCache.favoritos);
}
function toggleFavorito(id, el) { const favs = pdvCache.favoritos; const i = favs.indexOf(id); if (i > -1) { favs.splice(i, 1); el.classList.remove('active'); } else { favs.push(id); el.classList.add('active'); } localStorage.setItem('kanawa_favoritos', JSON.stringify(favs)); }

/* ====== SCANNER ====== */
async function abrirScanner(cb) {
  scannerCallback = cb || null;
  const modal = $('scannerModal'); if (modal) modal.classList.add('active');
  const el = $('scannerReader');
  if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#fff"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem"></i><p style="margin-top:12px">Iniciando câmera...</p></div>';
  if (scannerActive) return;
  if (typeof Html5Qrcode === 'undefined') {
    if (el) el.innerHTML = '<div style="text-align:center;padding:30px;color:#fff"><p>Scanner indisponível. Digite o código:</p><input type="text" id="codigoManual" placeholder="Código de barras" style="padding:10px;border-radius:8px;border:none;margin-top:10px;width:80%;max-width:300px" onkeypress="if(event.key===\'Enter\'){processarCodigoLido(this.value);this.value=\'\'}"></div>';
    return;
  }
  try {
    scanner = new Html5Qrcode('scannerReader', { verbose: false });
    await scanner.start({ facingMode: 'environment' }, { fps: 15, qrbox: { width: 260, height: 260 } }, async (txt) => { await processarCodigoLido(txt); }, () => { });
    scannerActive = true; toast('📷 Câmera ativa', 'info');
  } catch (err) { if (el) el.innerHTML = '<div style="text-align:center;padding:30px;color:#fff"><i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:#f59e0b"></i><p style="margin-top:12px">Câmera indisponível</p></div>'; }
}
async function processarCodigoLido(codigo) {
  if (!codigo) return;
  try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 1200; g.gain.value = 0.1; o.start(); setTimeout(() => { o.stop(); c.close(); }, 100); } catch (e) { }
  if (navigator.vibrate) navigator.vibrate(100);
  const produtos = await carregarCachePDV();
  const prod = produtos.find(p => p.codigoBarras === codigo || p.codigo === codigo);
  if (prod) { if (scannerCallback) { scannerCallback(prod); fecharScanner(); return; } pdvSelecionarProduto(prod.id); setTimeout(fecharScanner, 1200); }
  else { toast('⚠️ Não cadastrado: ' + codigo, 'warning'); setTimeout(() => { fecharScanner(); cadastroRapidoProduto(codigo); }, 800); }
}
function fecharScanner() { const modal = $('scannerModal'); if (modal) modal.classList.remove('active'); if (scanner && scannerActive) { scanner.stop().then(() => { scannerActive = false; scanner = null; scannerCallback = null; }).catch(() => { scannerActive = false; scanner = null; }); } }
async function buscarPorCodigo(c) { if (c) await processarCodigoLido(c); }
async function cadastroRapidoProduto(codigo) {
  openModal('⚡ Cadastro Rápido',
    '<div class="form-group"><label>Código de Barras</label><input id="rcCodigo" value="' + esc(codigo) + '" readonly style="background:var(--bg-hover)"></div>' +
    '<div class="form-group"><label>Nome *</label><input id="rcNome" autofocus></div>' +
    '<div class="form-group"><label>Preço (Kz) *</label><input id="rcPreco" type="number" step="0.01"></div>' +
    '<div class="form-group"><label>Estoque Inicial</label><input id="rcEstoque" type="number" value="0"></div>' +
    '<div class="form-group"><label>Categoria</label><input id="rcCategoria" value="Geral"></div>' +
    '<button class="btn btn-success btn-block" onclick="salvarCadastroRapido()"><i class="fas fa-save"></i> Cadastrar e Adicionar</button>');
}
async function salvarCadastroRapido() {
  const nome = $('rcNome').value.trim(); const preco = num($('rcPreco').value, 0);
  if (!nome || !preco) { toast('Preencha nome e preço', 'warning'); return; }
  const novo = { codigo: 'P' + Date.now().toString().slice(-6), codigoBarras: $('rcCodigo').value, nome, preco, estoque: int($('rcEstoque').value, 0), categoria: $('rcCategoria').value || 'Geral', dataCadastro: now() };
  const id = await saveData('produtos', novo); novo.id = id;
  pdvCache.produtos.push(novo);
  toast('✅ ' + nome + ' cadastrado', 'success');
  closeModal(); pdvSelecionarProduto(id);
}
/* ====== PRODUTOS ====== */
async function renderProdutos() {
  const produtos = await getData('produtos');
  const rows = produtos.map(p => [
    '<div style="width:44px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="' + imgSrc(p) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div>',
    esc(p.codigo || '-') + '<br><small style="color:var(--text-muted);font-family:monospace">' + esc(p.codigoBarras || '') + '</small>',
    '<strong>' + esc(p.nome) + '</strong>', esc(p.categoria || '-'), fmt(p.preco),
    badge(p.estoque || 0, (p.estoque || 0) > 0 ? 'success' : 'danger'),
    '<button class="btn btn-sm btn-primary" onclick="abrirModalProduto(' + p.id + ')"><i class="fas fa-edit"></i></button> ' +
    '<button class="btn btn-sm btn-info" onclick="imprimirEtiquetaIndividual(' + p.id + ')"><i class="fas fa-tag"></i></button> ' +
    (podeFazer('excluir') ? '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'produtos\',' + p.id + ')"><i class="fas fa-trash"></i></button>' : '')
  ]);
  return header('Produtos', produtos.length + ' produtos', 'var(--primary)',
    '<button class="btn btn-sm" onclick="exportarProdutos()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-file-export"></i> Exportar</button>' +
    '<button class="btn btn-sm" onclick="imprimirEtiquetasLote()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-tags"></i> Etiquetas</button>' +
    '<button class="btn btn-success" onclick="abrirModalProduto()"><i class="fas fa-plus"></i> Novo</button>', 'fa-boxes') +
    '<div class="card">' + table(['Img', 'Código', 'Nome', 'Categoria', 'Preço', 'Estoque', 'Ações'], rows) + '</div>';
}
async function abrirModalProduto(id) {
  const cats = await getData('categorias');
  const p = id ? (await DB.get('produtos', id)) || {} : {};
  openModal(id ? 'Editar Produto' : 'Novo Produto',
    '<div class="form-grid">' +
    '<div class="form-group"><label>Código Interno</label><input id="pCodigo" value="' + esc(p.codigo || '') + '"></div>' +
    '<div class="form-group"><label>📷 Código de Barras</label><div style="display:flex;gap:6px"><input id="pCodigoBarras" value="' + esc(p.codigoBarras || '') + '" style="flex:1"><button class="btn btn-sm btn-info" onclick="abrirScanner(function(prod){document.getElementById(\'pCodigoBarras\').value=prod.codigoBarras})"><i class="fas fa-camera"></i></button></div></div>' +
    '<div class="form-group full"><label>Nome *</label><input id="pNome" value="' + esc(p.nome || '') + '"></div>' +
    '<div class="form-group"><label>Categoria</label><select id="pCategoria"><option value="">Selecione...</option>' + cats.map(c => '<option value="' + esc(c.nome) + '" ' + (p.categoria === c.nome ? 'selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '<option value="Geral" ' + (p.categoria === 'Geral' ? 'selected' : '') + '>Geral</option></select></div>' +
    '<div class="form-group"><label>Preço (Kz) *</label><input id="pPreco" type="number" step="0.01" value="' + (p.preco || 0) + '"></div>' +
    '<div class="form-group"><label>Estoque</label><input id="pEstoque" type="number" value="' + (p.estoque || 0) + '"></div>' +
    '<div class="form-group"><label>Estoque Mínimo</label><input id="pEstoqueMin" type="number" value="' + (p.estoqueMin || 10) + '"></div>' +
    '<div class="form-group"><label>Unidade</label><select id="pUnidade">' + ['UN', 'KG', 'L', 'M'].map(u => '<option value="' + u + '" ' + (p.unidade === u ? 'selected' : '') + '>' + u + '</option>').join('') + '</select></div>' +
    '<div class="form-group full"><label>🖼️ Imagem do Produto</label>' +
    '<div class="image-picker" onclick="document.getElementById(\'pImagemInput\').click()">' +
    '<div class="placeholder" id="pImagemPlaceholder" style="' + (p.imagem ? 'display:none' : '') + '"><i class="fas fa-image"></i><span style="font-size:.85rem">Clique para escolher do dispositivo</span></div>' +
    '<img id="pImagemPreview" src="' + (p.imagem || '') + '" style="' + (p.imagem ? '' : 'display:none') + '" onerror="this.style.display=\'none\'"></div>' +
    '<input type="file" id="pImagemInput" accept="image/*" style="display:none" onchange="escolherImagemProduto(this)">' +
    '<input type="hidden" id="pImagem" value="' + esc(p.imagem || '') + '">' +
    '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn btn-sm btn-secondary" type="button" onclick="document.getElementById(\'pImagemInput\').click()"><i class="fas fa-folder-open"></i> Escolher</button>' +
    '<button class="btn btn-sm btn-danger" type="button" onclick="removerImagemProduto()"><i class="fas fa-trash"></i> Remover</button></div></div>' +
    '<div class="form-group full"><label>Descrição</label><textarea id="pDesc" rows="2">' + esc(p.descricao || '') + '</textarea></div></div>' +
    '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" onclick="salvarProduto(' + (id || 'null') + ')"><i class="fas fa-save"></i> Salvar</button>', true);
}
function escolherImagemProduto(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Imagem muito grande (máx 3MB)', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = (e) => { const url = e.target.result; const inp = $('pImagem'); if (inp) inp.value = url; const prev = $('pImagemPreview'); const ph = $('pImagemPlaceholder'); if (prev) { prev.src = url; prev.style.display = 'block'; } if (ph) ph.style.display = 'none'; toast('✅ Imagem carregada', 'success'); };
  reader.readAsDataURL(file);
}
function removerImagemProduto() { const inp = $('pImagem'); if (inp) inp.value = ''; const prev = $('pImagemPreview'); const ph = $('pImagemPlaceholder'); if (prev) { prev.src = ''; prev.style.display = 'none'; } if (ph) ph.style.display = 'block'; }
async function salvarProduto(id) {
  const nome = $('pNome').value.trim();
  if (!nome) { toast('Informe o nome', 'warning'); return; }
  const data = { codigo: $('pCodigo').value, codigoBarras: $('pCodigoBarras').value, nome, categoria: $('pCategoria').value, preco: num($('pPreco').value, 0), estoque: int($('pEstoque').value, 0), estoqueMin: int($('pEstoqueMin').value, 10), unidade: $('pUnidade').value, imagem: $('pImagem').value, descricao: $('pDesc').value };
  if (id) data.id = id;
  await saveData('produtos', data);
  pdvCache.ts = 0;
  toast(id ? 'Atualizado' : 'Cadastrado', 'success');
  closeModal(); openModule('produtos');
}
async function excluirProduto(id) { if (!podeFazer('excluir')) { toast('Sem permissão', 'error'); return; } if (!confirm('Excluir produto?')) return; await deleteData('produtos', id); pdvCache.ts = 0; toast('Excluído', 'info'); openModule('produtos'); }
async function exportarProdutos() {
  if (typeof XLSX === 'undefined') { toast('Excel indisponível', 'warning'); return; }
  const data = await getData('produtos');
  const ws = XLSX.utils.json_to_sheet(data.map(p => ({ codigo: p.codigo, codigoBarras: p.codigoBarras, nome: p.nome, categoria: p.categoria, preco: p.preco, estoque: p.estoque, unidade: p.unidade })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Produtos'); XLSX.writeFile(wb, 'produtos_' + Date.now() + '.xlsx');
  toast('📤 Exportado', 'success');
}
function abrirModalImportar() {
  openModal('Importar Produtos',
    '<p style="color:var(--text-muted);margin-bottom:12px">Colunas: codigo, codigoBarras, nome, categoria, preco, estoque, unidade</p>' +
    '<div class="form-group"><input type="file" id="importFile" accept=".xlsx,.xls,.csv" style="padding:10px"></div>' +
    '<button class="btn btn-primary btn-block" onclick="importarProdutos()"><i class="fas fa-upload"></i> Importar</button>');
}
async function importarProdutos() {
  if (typeof XLSX === 'undefined') { toast('Excel indisponível', 'warning'); return; }
  const f = $('importFile').files[0]; if (!f) { toast('Selecione arquivo', 'warning'); return; }
  const r = new FileReader();
  r.onload = async (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let c = 0;
      for (const row of rows) { await saveData('produtos', { codigo: row.codigo || '', codigoBarras: row.codigoBarras || '', nome: row.nome || '', categoria: row.categoria || 'Geral', preco: num(row.preco, 0), estoque: int(row.estoque, 0), unidade: row.unidade || 'UN' }); c++; }
      pdvCache.ts = 0; toast('✅ ' + c + ' produtos importados', 'success'); closeModal(); openModule('produtos');
    } catch (err) { toast('Erro: ' + err.message, 'error'); }
  };
  r.readAsArrayBuffer(f);
}

/* ====== ETIQUETAS ====== */
async function imprimirEtiquetaIndividual(id) {
  const p = await DB.get('produtos', id); if (!p) return;
  const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  openModal('🏷️ Etiqueta',
    '<div id="etiquetaContainer" style="text-align:center;background:#fff;padding:20px;border-radius:10px">' +
    '<div class="etiqueta-print" style="margin:0 auto">' +
    '<div style="font-size:12px;font-weight:bold;color:#1a3a5c">' + esc(emp.firma || emp.nome || 'KANAWA SOFT') + '</div>' +
    '<div style="font-size:10px;margin:3px 0;color:#555">' + esc(p.categoria || 'Geral') + '</div>' +
    '<hr style="border-top:1px solid #000">' +
    '<div style="font-size:13px;font-weight:bold;margin:5px 0">' + esc(p.nome) + '</div>' +
    '<div style="font-size:11px;font-family:monospace;margin:5px 0">' + esc(p.codigo || '') + '</div>' +
    (p.codigoBarras ? '<canvas id="barcodeEtq" style="max-width:240px"></canvas>' : '') +
    '<div style="font-size:20px;font-weight:800;color:#217346;margin-top:6px">' + fmt(p.preco) + '</div>' +
    '<div style="font-size:9px;color:#777;margin-top:3px">' + new Date().toLocaleDateString('pt-AO') + '</div></div></div>' +
    '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">' +
    '<button class="btn btn-success" onclick="imprimirEtiquetaHTML()"><i class="fas fa-print"></i> Imprimir</button>' +
    '<button class="btn btn-info" onclick="baixarEtiquetaPDF()"><i class="fas fa-file-pdf"></i> PDF</button>' +
    '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>');
  if (p.codigoBarras && window.JsBarcode) setTimeout(() => { try { JsBarcode('#barcodeEtq', p.codigoBarras, { format: 'CODE128', width: 2, height: 50, displayValue: true, fontSize: 12 }); } catch (e) { } }, 100);
}
async function imprimirEtiquetasLote() {
  const produtos = await carregarCachePDV();
  if (!produtos.length) { toast('Sem produtos', 'warning'); return; }
  openModal('🏷️ Impressão em Lote',
    '<div class="form-group"><label><input type="checkbox" id="loteTodos" onchange="document.querySelectorAll(\'.lote-produto\').forEach(c=>c.checked=this.checked)" checked> Selecionar todos (' + produtos.length + ')</label></div>' +
    '<div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);padding:10px;border-radius:10px">' +
    produtos.map(p => '<label style="display:block;padding:6px;border-bottom:1px solid var(--border)"><input type="checkbox" class="lote-produto" value="' + p.id + '" checked> ' + esc(p.nome) + ' - ' + fmt(p.preco) + '</label>').join('') + '</div>' +
    '<div class="form-group" style="margin-top:12px"><label>Cópias por produto</label><input type="number" id="loteQtd" value="1" min="1" max="100"></div>' +
    '<button class="btn btn-primary btn-block" onclick="gerarLoteEtiquetas()"><i class="fas fa-print"></i> Gerar</button>', true);
}
async function gerarLoteEtiquetas() {
  const ids = Array.from($$('.lote-produto:checked')).map(c => parseInt(c.value));
  const qtd = int($('loteQtd').value, 1);
  const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  if (!ids.length) { toast('Selecione produtos', 'warning'); return; }
  let html = '';
  for (const id of ids) {
    const p = await DB.get('produtos', id); if (!p) continue;
    for (let i = 0; i < qtd; i++) {
      html += '<div class="etiqueta-print"><div style="font-size:12px;font-weight:bold;color:#1a3a5c">' + esc(emp.firma || emp.nome || 'KANAWA SOFT') + '</div>' +
        '<div style="font-size:10px;margin:3px 0;color:#555">' + esc(p.categoria || 'Geral') + '</div>' +
        '<hr style="border-top:1px solid #000"><div style="font-size:13px;font-weight:bold;margin:5px 0">' + esc(p.nome) + '</div>' +
        '<div style="font-size:11px;font-family:monospace;margin:5px 0">' + esc(p.codigo || '') + '</div>' +
        '<div style="font-size:11px;font-family:monospace;margin:5px 0">' + esc(p.codigoBarras || '') + '</div>' +
        '<div style="font-size:20px;font-weight:800;color:#217346;margin-top:6px">' + fmt(p.preco) + '</div></div>';
    }
  }
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>Etiquetas</title><style>body{font-family:Arial;margin:0;padding:10px}@media print{.etiqueta-print{page-break-inside:avoid}}</style></head><body>' + html + '</body></html>');
  w.document.close(); setTimeout(() => w.print(), 400);
  toast('✅ ' + (ids.length * qtd) + ' etiquetas geradas', 'success'); closeModal();
}
function imprimirEtiquetaHTML() { const el = $('etiquetaContainer'); if (!el) return; const w = window.open('', '_blank'); w.document.write('<html><head><title>Etiqueta</title></head><body style="font-family:Arial;text-align:center">' + el.innerHTML + '</body></html>'); w.document.close(); setTimeout(() => w.print(), 400); }
async function baixarEtiquetaPDF() {
  const el = $('etiquetaContainer'); if (!el) return;
  if (!window.jspdf) { toast('PDF indisponível', 'warning'); return; }
  const { jsPDF } = window.jspdf; const d = new jsPDF('p', 'mm', 'a4');
  d.html(el, { callback: x => { x.save('etiqueta_' + Date.now() + '.pdf'); toast('PDF gerado', 'success'); }, x: 10, y: 10, width: 190 });
}

/* ====== CATEGORIAS ====== */
async function renderCategorias() {
  const cats = await getData('categorias');
  const rows = cats.map(c => [c.id, '<strong>' + esc(c.nome) + '</strong>', esc(c.descricao || '-'),
    '<button class="btn btn-sm btn-primary" onclick="editarCategoria(' + c.id + ')"><i class="fas fa-edit"></i></button> ' +
    (podeFazer('excluir') ? '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'categorias\',' + c.id + ')"><i class="fas fa-trash"></i></button>' : '')]);
  return header('Categorias', cats.length + ' categorias', 'var(--info)', '<button class="btn btn-success" onclick="abrirModalCategoria()"><i class="fas fa-plus"></i> Nova</button>', 'fa-tags') + '<div class="card">' + table(['#', 'Nome', 'Descrição', 'Ações'], rows) + '</div>';
}
function abrirModalCategoria() { openModal('Nova Categoria', '<div class="form-group"><label>Nome *</label><input id="catNome"></div><div class="form-group"><label>Descrição</label><textarea id="catDesc" rows="2"></textarea></div><button class="btn btn-primary btn-block" onclick="salvarCategoria()">Salvar</button>'); }
async function salvarCategoria() { const n = $('catNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('categorias', { nome: n, descricao: $('catDesc').value }); toast('Criada', 'success'); closeModal(); openModule('categorias'); }
async function editarCategoria(id) { const c = await DB.get('categorias', id); if (!c) return; openModal('Editar Categoria', '<div class="form-group"><label>Nome</label><input id="catENome" value="' + esc(c.nome) + '"></div><div class="form-group"><label>Descrição</label><textarea id="catEDesc" rows="2">' + esc(c.descricao || '') + '</textarea></div><button class="btn btn-primary btn-block" onclick="salvarEditCategoria(' + id + ')">Salvar</button>'); }
async function salvarEditCategoria(id) { const c = await DB.get('categorias', id); c.nome = $('catENome').value; c.descricao = $('catEDesc').value; await saveData('categorias', c); toast('Atualizada', 'success'); closeModal(); openModule('categorias'); }

/* ====== CLIENTES ====== */
async function renderClientes() {
  const cli = await getData('clientes');
  const rows = cli.map(c => [c.id, '<strong>' + esc(c.nome) + '</strong>', esc(c.nif || '-'), esc(c.telefone || '-'), esc(c.email || '-'),
    (podeFazer('excluir') ? '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'clientes\',' + c.id + ')"><i class="fas fa-trash"></i></button>' : '')]);
  return header('Clientes', cli.length + ' clientes', 'var(--info)', '<button class="btn btn-success" onclick="abrirModalCliente()"><i class="fas fa-plus"></i> Novo</button>', 'fa-users') + '<div class="card">' + table(['#', 'Nome', 'NIF', 'Telefone', 'Email', 'Ações'], rows) + '</div>';
}
function abrirModalCliente() { openModal('Novo Cliente', '<div class="form-group"><label>Nome *</label><input id="cliNome"></div><div class="form-group"><label>NIF</label><input id="cliNif"></div><div class="form-group"><label>Telefone</label><input id="cliTel"></div><div class="form-group"><label>Email</label><input id="cliEmail" type="email"></div><button class="btn btn-primary btn-block" onclick="salvarClienteModal()">Salvar</button>'); }
async function salvarClienteModal() { const n = $('cliNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('clientes', { nome: n, nif: $('cliNif').value, telefone: $('cliTel').value, email: $('cliEmail').value, dataCadastro: now() }); toast('Cadastrado', 'success'); closeModal(); openModule('clientes'); }
function abrirModalPDVCliente() { openModal('Novo Cliente', '<div class="form-group"><label>Nome *</label><input id="novoCliNome" autofocus></div><div class="form-group"><label>NIF</label><input id="novoCliNif"></div><div class="form-group"><label>Telefone</label><input id="novoCliTel"></div><button class="btn btn-primary btn-block" onclick="salvarNovoClientePDV()">Salvar</button>'); }
async function salvarNovoClientePDV() {
  const n = $('novoCliNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; }
  const c = { nome: n, nif: $('novoCliNif').value, telefone: $('novoCliTel').value, dataCadastro: now() };
  await saveData('clientes', c);
  if ($('pdvClienteNome')) { $('pdvClienteNome').value = n; $('pdvClienteNif').value = c.nif; $('pdvClienteTel').value = c.telefone; }
  pdvState.cliente = { nome: n, nif: c.nif, telefone: c.telefone };
  toast('Cliente cadastrado', 'success'); closeModal();
}

/* ====== FORNECEDORES ====== */
async function renderFornecedores() {
  const f = await getData('fornecedores');
  const rows = f.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', esc(x.nif || '-'), esc(x.telefone || '-'), (podeFazer('excluir') ? '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'fornecedores\',' + x.id + ')"><i class="fas fa-trash"></i></button>' : '')]);
  return header('Fornecedores', f.length + ' fornecedores', 'var(--warning)', '<button class="btn btn-success" onclick="abrirModalFornecedor()"><i class="fas fa-plus"></i> Novo</button>', 'fa-truck') + '<div class="card">' + table(['#', 'Nome', 'NIF', 'Telefone', 'Ações'], rows) + '</div>';
}
function abrirModalFornecedor() { openModal('Novo Fornecedor', '<div class="form-group"><label>Nome *</label><input id="fNome"></div><div class="form-group"><label>NIF</label><input id="fNif"></div><div class="form-group"><label>Telefone</label><input id="fTel"></div><div class="form-group"><label>Email</label><input id="fEmail" type="email"></div><button class="btn btn-primary btn-block" onclick="salvarFornecedor()">Salvar</button>'); }
async function salvarFornecedor() { const n = $('fNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('fornecedores', { nome: n, nif: $('fNif').value, telefone: $('fTel').value, email: $('fEmail').value }); toast('Cadastrado', 'success'); closeModal(); openModule('fornecedores'); }

/* ====== TRANSPORTADORAS ====== */
async function renderTransportadoras() {
  const t = await getData('transportadoras');
  const rows = t.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', esc(x.telefone || '-'), fmt(x.custoBase), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'transportadoras\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Transportadoras', t.length + ' transportadoras', 'var(--info)', '<button class="btn btn-success" onclick="abrirModalTransportadora()"><i class="fas fa-plus"></i> Nova</button>', 'fa-shipping-fast') + '<div class="card">' + table(['#', 'Nome', 'Telefone', 'Custo Base', 'Ações'], rows) + '</div>';
}
function abrirModalTransportadora() { openModal('Nova Transportadora', '<div class="form-group"><label>Nome *</label><input id="tNome"></div><div class="form-group"><label>Telefone</label><input id="tTel"></div><div class="form-group"><label>Custo Base (Kz)</label><input id="tCusto" type="number" value="0"></div><button class="btn btn-primary btn-block" onclick="salvarTransportadora()">Salvar</button>'); }
async function salvarTransportadora() { const n = $('tNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('transportadoras', { nome: n, telefone: $('tTel').value, custoBase: num($('tCusto').value, 0) }); toast('Cadastrada', 'success'); closeModal(); openModule('transportadoras'); }

/* ====== ESTOQUE ====== */
async function renderEstoque() {
  const p = await getData('produtos'); const m = await getData('movimentacoesEstoque');
  const total = p.reduce((s, x) => s + (x.estoque || 0), 0);
  const baixo = p.filter(x => (x.estoque || 0) < (x.estoqueMin || 10));
  const prodRows = p.map(x => ['<strong>' + esc(x.nome) + '</strong>', '<strong>' + (x.estoque || 0) + '</strong>', x.estoqueMin || 10,
    badge((x.estoque || 0) >= (x.estoqueMin || 10) ? 'OK' : ((x.estoque || 0) > 0 ? 'Baixo' : 'Esgotado'), (x.estoque || 0) >= (x.estoqueMin || 10) ? 'success' : ((x.estoque || 0) > 0 ? 'warning' : 'danger')),
    '<button class="btn btn-sm btn-success" onclick="ajustarEstoque(' + x.id + ',1)"><i class="fas fa-plus"></i></button> <button class="btn btn-sm btn-danger" onclick="ajustarEstoque(' + x.id + ',-1)"><i class="fas fa-minus"></i></button>']);
  const movRows = m.slice(-30).reverse().map(x => [fmtDT(x.data), badge(x.tipo, x.tipo === 'entrada' ? 'success' : (x.tipo === 'saida' ? 'danger' : 'info')), esc(x.descricao)]);
  return header('Estoque', fmtN(total) + ' unidades em ' + p.length + ' produtos', 'var(--info)',
    '<button class="btn btn-sm btn-success" onclick="abrirMovEstoque(\'entrada\')"><i class="fas fa-arrow-down"></i> Entrada</button>' +
    '<button class="btn btn-sm btn-danger" onclick="abrirMovEstoque(\'saida\')"><i class="fas fa-arrow-up"></i> Saída</button>' +
    '<button class="btn btn-sm btn-warning" onclick="abrirMovEstoque(\'ajuste\')"><i class="fas fa-edit"></i> Ajuste</button>', 'fa-warehouse') +
    '<div class="metric-grid"><div class="metric-card"><div class="label">Total Itens</div><div class="value">' + fmtN(total) + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">OK</div><div class="value">' + (p.length - baixo.length) + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--danger)"><div class="label">Baixo</div><div class="value">' + baixo.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--info)"><div class="label">Movimentações</div><div class="value">' + m.length + '</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-boxes"></i> Produtos</h3></div>' + table(['Produto', 'Qtd', 'Mín', 'Status', 'Ações'], prodRows) + '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-history"></i> Movimentações</h3></div>' + table(['Data', 'Tipo', 'Descrição'], movRows) + '</div>';
}
async function ajustarEstoque(id, d) {
  const p = await DB.get('produtos', id); if (!p) return;
  p.estoque = Math.max(0, (p.estoque || 0) + d);
  await saveData('produtos', p);
  await saveData('movimentacoesEstoque', { tipo: d > 0 ? 'entrada' : 'saida', descricao: 'Ajuste: ' + (d > 0 ? '+' : '') + d + ' ' + p.nome, data: now() });
  pdvCache.ts = 0; openModule('estoque');
}
function abrirMovEstoque(tipo) {
  DB.getAll('produtos').then(ps => {
    openModal(tipo.charAt(0).toUpperCase() + tipo.slice(1) + ' de Estoque',
      '<div class="form-group"><label>Produto *</label><select id="movProd">' + ps.map(p => '<option value="' + p.id + '">' + esc(p.nome) + ' (Est: ' + (p.estoque || 0) + ')</option>').join('') + '</select></div>' +
      '<div class="form-group"><label>Quantidade *</label><input id="movQtd" type="number" value="1" min="1"></div>' +
      '<div class="form-group"><label>Motivo</label><input id="movObs"></div>' +
      '<button class="btn btn-primary btn-block" onclick="salvarMov(\'' + tipo + '\')">Registrar</button>');
  });
}
async function salvarMov(tipo) {
  const pid = int($('movProd').value); const qtd = int($('movQtd').value, 0); const obs = $('movObs').value;
  const p = await DB.get('produtos', pid); if (!p) return;
  if (tipo === 'entrada') p.estoque = (p.estoque || 0) + qtd;
  else if (tipo === 'saida') { if ((p.estoque || 0) < qtd) { toast('Estoque insuficiente', 'error'); return; } p.estoque -= qtd; }
  else if (tipo === 'ajuste') p.estoque = qtd;
  await saveData('produtos', p);
  await saveData('movimentacoesEstoque', { tipo, descricao: (obs || tipo) + ': ' + qtd + ' ' + p.nome, produtoId: pid, qtd, data: now() });
  pdvCache.ts = 0; toast('✅ ' + tipo + ' registrada', 'success'); closeModal(); openModule('estoque');
}

/* ====== COMPRAS ====== */
async function renderCompras() {
  const c = await getData('compras');
  const rows = c.slice().reverse().map(x => ['#' + x.id, esc(x.fornecedor || '-'), esc(x.produto || '-'), x.quantidade || 0, '<strong>' + fmt(x.valor) + '</strong>', fmtDT(x.data),
    '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'compras\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Compras', c.length + ' compras', 'var(--warning)', '<button class="btn btn-success" onclick="abrirModalCompra()"><i class="fas fa-plus"></i> Nova</button>', 'fa-shopping-bag') + '<div class="card">' + table(['#', 'Fornecedor', 'Produto', 'Qtd', 'Valor', 'Data', 'Ações'], rows) + '</div>';
}
function abrirModalCompra() {
  DB.getAll('fornecedores').then(fs => {
    openModal('Nova Compra',
      '<div class="form-grid"><div class="form-group full"><label>Fornecedor</label><select id="cForn"><option value="">Selecione...</option>' + fs.map(f => '<option value="' + esc(f.nome) + '">' + esc(f.nome) + '</option>').join('') + '</select></div>' +
      '<div class="form-group full"><label>Produto</label><input id="cProd"></div>' +
      '<div class="form-group"><label>Qtd</label><input id="cQtd" type="number" value="1"></div>' +
      '<div class="form-group"><label>Valor</label><input id="cValor" type="number" value="0"></div></div>' +
      '<button class="btn btn-primary btn-block" onclick="salvarCompra()">Salvar</button>');
  });
}
async function salvarCompra() {
  const f = $('cForn').value; const p = $('cProd').value.trim();
  if (!p) { toast('Informe produto', 'warning'); return; }
  const q = int($('cQtd').value, 1); const v = num($('cValor').value, 0);
  await saveData('compras', { fornecedor: f, produto: p, quantidade: q, valor: v, data: now(), status: 'pendente' });
  const prods = await getData('produtos'); const match = prods.find(x => x.nome.toLowerCase() === p.toLowerCase());
  if (match) { match.estoque = (match.estoque || 0) + q; await saveData('produtos', match); pdvCache.ts = 0; }
  toast('Compra registrada', 'success'); closeModal(); openModule('compras');
}

/* ====== CRM ====== */
async function renderCRM() {
  const l = await getData('leads');
  const rows = l.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', esc(x.telefone || '-'), esc(x.origem || '-'), badge(x.status || 'novo', 'info'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'leads\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('CRM', l.length + ' leads', 'var(--purple)', '<button class="btn btn-success" onclick="abrirModalLead()"><i class="fas fa-plus"></i> Novo Lead</button>', 'fa-handshake') + '<div class="card">' + table(['#', 'Nome', 'Telefone', 'Origem', 'Status', 'Ações'], rows) + '</div>';
}
function abrirModalLead() { openModal('Novo Lead', '<div class="form-group"><label>Nome *</label><input id="lNome"></div><div class="form-group"><label>Telefone</label><input id="lTel"></div><div class="form-group"><label>Email</label><input id="lEmail" type="email"></div><div class="form-group"><label>Origem</label><select id="lOrigem"><option>Site</option><option>WhatsApp</option><option>Facebook</option><option>Indicação</option></select></div><button class="btn btn-primary btn-block" onclick="salvarLead()">Salvar</button>'); }
async function salvarLead() { const n = $('lNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('leads', { nome: n, telefone: $('lTel').value, email: $('lEmail').value, origem: $('lOrigem').value, status: 'novo', data: now() }); toast('Lead cadastrado', 'success'); closeModal(); openModule('crm'); }

/* ====== CONTABILIDADE ====== */
async function renderContabilidade() {
  if (!window.KanawaCloud || !KanawaCloud.ready) {
    return header('Contabilidade','Área profissional do contabilista','var(--primary)','','fa-book')+
      '<div class="card"><p>A contabilidade central exige ligação segura à empresa. Não são emitidos lançamentos oficiais em modo offline.</p></div>';
  }
  let snap;
  try { snap=await KanawaCloud.getAccountingSnapshot(); }
  catch(error) {
    return header('Contabilidade','Plano de contas, diário e demonstrações','var(--primary)',
      '<button class="btn btn-light" onclick="openModule(\'contabilidade\')"><i class="fas fa-sync"></i> Tentar novamente</button>','fa-book')+
      '<div class="card"><h3>Não foi possível carregar a contabilidade</h3><p>'+esc(error.message||'Falha de ligação')+'</p><p class="text-muted">Nenhum lançamento foi criado ou alterado.</p></div>';
  }
  const accounts=Array.isArray(snap.accounts)?snap.accounts:[];
  const entries=Array.isArray(snap.entries)?snap.entries:[];
  const debit=entries.reduce((sum,e)=>sum+Number(e.debit_total||0),0);
  const credit=entries.reduce((sum,e)=>sum+Number(e.credit_total||0),0);
  const fromDate=contabilidadeFromDate||new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10);
  const toDate=contabilidadeToDate||new Date().toISOString().slice(0,10);
  let reports=null,reportError='';
  if(['balancete','resultados','balanco','razao'].includes(contabilidadeTab||'resumo')) {
    try { reports=await KanawaCloud.getAccountingReports(fromDate,toDate); }
    catch(error) { reportError=error.message||'Não foi possível calcular os relatórios.'; }
  }
  const tab=contabilidadeTab||'resumo';
  const tabs=[['resumo','Resumo'],['contas','Plano de contas'],['diario','Diário'],['balancete','Balancete'],['resultados','Resultados'],['balanco','Balanço'],['razao','Razão']];
  const tabBar='<div class="accounting-tabs">'+tabs.map(t=>'<button class="btn '+(tab===t[0]?'btn-primary':'btn-light')+'" onclick="mudarAbaContabilidade(\''+t[0]+'\')">'+t[1]+'</button>').join('')+'</div>';
  const period='<div class="accounting-period"><label>De <input id="contPeriodoInicio" type="date" value="'+fromDate+'"></label><label>Até <input id="contPeriodoFim" type="date" value="'+toDate+'"></label><button class="btn btn-sm btn-primary" onclick="alterarPeriodoContabil()">Aplicar período</button></div>';
  const accountRows=accounts.map(a=>[esc(a.account_code),esc(a.name),esc(a.account_type),esc(a.normal_balance||'debit'),a.is_off_balance?'Ordem/analítica':'Financeira',fmt(a.debit_total),fmt(a.credit_total),fmt(a.balance)]);
  const entryRows=entries.map(e=>['<strong>'+esc(e.entry_number)+'</strong>',fmtD(e.entry_date),esc(e.description),fmt(e.debit_total),fmt(e.credit_total),badge(e.status||'posted',e.status==='draft'?'warning':'success')]);
  let content='';
  if(tab==='resumo') {
    content='<div class="metric-grid">'+
      '<div class="metric-card"><div class="label">Contas activas</div><div class="value">'+accounts.length+'</div></div>'+
      '<div class="metric-card"><div class="label">Lançamentos</div><div class="value">'+entries.length+'</div></div>'+
      '<div class="metric-card"><div class="label">Débitos</div><div class="value">'+fmt(debit)+'</div></div>'+
      '<div class="metric-card"><div class="label">Créditos</div><div class="value">'+fmt(credit)+'</div></div></div>'+
      '<div class="card"><h3>Conferência contabilística</h3><p>O diário deve manter débitos iguais a créditos. Os relatórios abaixo consideram apenas lançamentos confirmados pelo servidor.</p>'+
      '<div class="quick-links"><button class="btn btn-light" onclick="mudarAbaContabilidade(\'balancete\')">Ver balancete</button><button class="btn btn-light" onclick="mudarAbaContabilidade(\'resultados\')">Demonstração de resultados</button><button class="btn btn-light" onclick="openModule(\'financeiro\')">Abrir financeiro</button><button class="btn btn-light" onclick="openModule(\'ativos\')">Activos fixos</button></div></div>'+
      '<div class="card"><h3>Últimos lançamentos</h3>'+(entryRows.length?table(['N.º','Data','Descrição','Débito','Crédito','Estado'],entryRows.slice(0,10)):emptyState('fa-book-open','Ainda não existem lançamentos. Importe o PGC e registe o primeiro movimento.'))+'</div>';
  } else if(tab==='contas') {
    content='<div class="card"><h3>Plano Geral de Contabilidade</h3><p>Plano de contas estruturado por classes, com hierarquia e saldo normal.</p>'+
      (accountRows.length?table(['Código','Conta','Tipo','Saldo normal','Classificação','Débito','Crédito','Saldo'],accountRows):
      '<div class="empty-state"><p>Não existem contas nesta empresa.</p><button class="btn btn-primary" onclick="importarPGCAngola()">Importar PGC Angola (Decreto 82/01)</button></div>')+'</div>';
  } else if(tab==='diario') {
    content='<div class="card"><h3>Diário contabilístico</h3>'+(entryRows.length?table(['N.º','Data','Descrição','Débito','Crédito','Estado'],entryRows):emptyState('fa-book-open','Ainda não existem lançamentos.'))+'</div>';
  } else if(tab==='balancete') {
    const rows=reports&&reports.trial_balance?reports.trial_balance.map(r=>[esc(r.account_code),esc(r.name),r.is_off_balance?'Ordem/analítica':'Financeira',fmt(r.opening_balance),fmt(r.period_debit),fmt(r.period_credit),fmt(r.closing_balance)]):[];
    content=period+(reportError?'<div class="card"><p>'+esc(reportError)+'</p></div>':'')+
      '<div class="card"><h3>Balancete de verificação</h3>'+(rows.length?table(['Conta','Descrição','Classificação','Saldo inicial','Débito período','Crédito período','Saldo final'],rows):emptyState('fa-balance-scale','Sem movimentos contabilísticos confirmados no período.'))+'</div>';
  } else if(tab==='resultados') {
    const r=reports&&reports.income_statement||{};
    content=period+(reportError?'<div class="card"><p>'+esc(reportError)+'</p></div>':'')+
      '<div class="metric-grid"><div class="metric-card"><div class="label">Proveitos</div><div class="value">'+fmt(r.income)+'</div></div>'+
      '<div class="metric-card"><div class="label">Custos e perdas</div><div class="value">'+fmt(r.expenses)+'</div></div>'+
      '<div class="metric-card"><div class="label">Resultado líquido</div><div class="value">'+fmt(r.net_result)+'</div></div></div>'+
      '<div class="card"><h3>Demonstração de resultados</h3><p>Valores calculados a partir das contas de rendimento e gasto com lançamentos confirmados.</p></div>';
  } else if(tab==='balanco') {
    const r=reports&&reports.balance_sheet||{};
    content=period+'<div class="metric-grid"><div class="metric-card"><div class="label">Activo</div><div class="value">'+fmt(r.assets)+'</div></div>'+
      '<div class="metric-card"><div class="label">Passivo</div><div class="value">'+fmt(r.liabilities)+'</div></div>'+
      '<div class="metric-card"><div class="label">Capital próprio</div><div class="value">'+fmt(r.equity)+'</div></div>'+
      '<div class="metric-card"><div class="label">Diferença</div><div class="value">'+fmt(r.difference)+'</div></div></div>'+
      '<div class="card"><h3>Balanço</h3><p>O balanço deve apresentar diferença igual a zero. Confirme a classificação das contas do PGC antes de fechar o período.</p></div>';
  } else {
    const rows=reports&&reports.ledger?reports.ledger.map(r=>[fmtD(r.entry_date),esc(r.entry_number),esc(r.account_code),esc(r.account_name),esc(r.description),fmt(r.debit),fmt(r.credit)]):[];
    content=period+'<div class="card"><h3>Razão geral</h3>'+(rows.length?table(['Data','Diário','Conta','Descrição da conta','Histórico','Débito','Crédito'],rows):emptyState('fa-book','Sem movimentos no período.'))+'</div>';
  }
  const actions='<button class="btn btn-light" onclick="abrirContaContabilistica()"><i class="fas fa-plus"></i> Nova conta</button>'+
    '<button class="btn btn-success" onclick="abrirLancamentoContabilistico()"><i class="fas fa-plus-circle"></i> Novo lançamento</button>'+
    '<button class="btn btn-outline" onclick="importarPGCAngola()"><i class="fas fa-file-import"></i> Importar PGC</button>';
  return header('Contabilidade','Área de trabalho do contabilista · Angola','var(--primary)',actions,'fa-book')+tabBar+content;
}
function abrirContaContabilistica() {
  openModal('Nova conta contabilística',
    '<div class="form-grid"><div class="form-group"><label>Código *</label><input id="caCodigo" maxlength="30"></div><div class="form-group"><label>Nome *</label><input id="caNome"></div>' +
    '<div class="form-group full"><label>Tipo *</label><select id="caTipo"><option value="asset">Activo</option><option value="liability">Passivo</option><option value="equity">Capital próprio</option><option value="income">Rendimento</option><option value="expense">Gasto</option></select></div></div>' +
    '<button class="btn btn-primary btn-block" onclick="guardarContaContabilistica()">Guardar conta</button>');
}
async function guardarContaContabilistica() {
  const code=$('caCodigo').value.trim(), name=$('caNome').value.trim(), type=$('caTipo').value;
  if(!code||!name){toast('Preencha código e nome da conta.','warning');return;}
  try { await KanawaCloud.saveChartAccount({code,name,type}); toast('Conta contabilística guardada.','success'); closeModal(); openModule('contabilidade'); }
  catch(error){toast(error.message||'Não foi possível guardar a conta.','error');}
}
async function abrirLancamentoContabilistico() {
  try {
    const snap=await KanawaCloud.getAccountingSnapshot();
    const accounts=(snap.accounts||[]).filter(a=>!a.is_group);
    if(accounts.length<2){toast('Importe ou crie pelo menos duas contas antes de lançar.','warning');return;}
    window._journalAccountOptions='<option value="">Seleccione uma conta...</option>'+accounts.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.account_code+' — '+a.name)+'</option>').join('');
    window._journalLineSequence=2;
    openModal('Novo lançamento contabilístico',
      '<div class="form-grid"><div class="form-group"><label>Data *</label><input id="jeData" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div class="form-group"><label>Descrição / histórico *</label><input id="jeDesc" maxlength="180" placeholder="Descrição do movimento"></div></div>'+
      '<div class="journal-lines-head"><strong>Linhas do lançamento</strong><span>Débito e crédito devem ficar equilibrados</span></div>'+
      '<div id="jeLines">'+renderJournalLineRow(0)+renderJournalLineRow(1)+'</div>'+
      '<button class="btn btn-light btn-sm" onclick="adicionarLinhaLancamento()"><i class="fas fa-plus"></i> Adicionar linha</button>'+
      '<div class="journal-totals"><span>Débito: <strong id="jeTotalDebit">0,00</strong></span><span>Crédito: <strong id="jeTotalCredit">0,00</strong></span><span>Diferença: <strong id="jeDifference">0,00</strong></span></div>'+
      '<p class="text-muted">O servidor valida a empresa, as permissões e o equilíbrio antes de confirmar o lançamento.</p>'+
      '<button class="btn btn-primary btn-block" onclick="guardarLancamentoContabilistico()">Validar e lançar</button>');
  } catch(error) { toast(error.message||'Não foi possível carregar o plano de contas.','error'); }
}
async function guardarLancamentoContabilistico() {
  const date=$('jeData').value,description=$('jeDesc').value.trim();
  const rows=Array.from($(' [data-journal-row]')).filter(row=>row.closest('#jeLines'));
  const lines=[];
  for(const row of rows){
    const account=row.querySelector('[data-account]').value;
    const debit=Number(row.querySelector('[data-debit]').value||0);
    const credit=Number(row.querySelector('[data-credit]').value||0);
    if(!account||debit<0||credit<0||((debit>0)===(credit>0))){toast('Cada linha deve ter uma conta e apenas débito ou crédito.','warning');return;}
    lines.push({account_id:account,debit:debit,credit:credit});
  }
  const totalDebit=lines.reduce((sum,line)=>sum+line.debit,0);
  const totalCredit=lines.reduce((sum,line)=>sum+line.credit,0);
  if(!date||!description||lines.length<2){toast('Preencha a data, o histórico e pelo menos duas linhas.','warning');return;}
  if(Math.round(totalDebit*100)!==Math.round(totalCredit*100)||totalDebit<=0){toast('O total de débito deve ser igual ao total de crédito.','warning');return;}
  try {
    const result=await KanawaCloud.postJournalEntry({date,description,lines});
    toast('Lançamento '+result.entry_number+' registado.','success');
    closeModal();contabilidadeTab='diario';openModule('contabilidade');
  } catch(error){toast(error.message||'Lançamento recusado pelo servidor.','error');}
}

/* ====== FINANCEIRO ====== */
async function renderFinanceiro() {
  const [rec, pag] = await Promise.all([getData('contasReceber'), getData('contasPagar')]);
  const tR = rec.reduce((s, c) => s + (c.valor || 0), 0);
  const tP = pag.reduce((s, c) => s + (c.valor || 0), 0);
  const recRows = rec.slice().reverse().map(c => [esc(c.cliente), '<strong>' + fmt(c.valor) + '</strong>', fmtD(c.vencimento), badge(c.status, c.status === 'pago' ? 'success' : 'warning'),
    (c.status !== 'pago' ? '<button class="btn btn-sm btn-success" onclick="marcarPago(' + c.id + ',\'receber\')"><i class="fas fa-check"></i></button> ' : '') +
    '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'contasReceber\',' + c.id + ')"><i class="fas fa-trash"></i></button>']);
  const pagRows = pag.slice().reverse().map(c => [esc(c.fornecedor), '<strong>' + fmt(c.valor) + '</strong>', fmtD(c.vencimento), badge(c.status, c.status === 'pago' ? 'success' : 'warning'),
    (c.status !== 'pago' ? '<button class="btn btn-sm btn-success" onclick="marcarPago(' + c.id + ',\'pagar\')"><i class="fas fa-check"></i></button> ' : '') +
    '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'contasPagar\',' + c.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Financeiro', 'Contas a receber e a pagar', 'var(--success)', '', 'fa-coins') +
    '<div class="metric-grid">' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">📥 A Receber</div><div class="value" style="color:var(--success)">' + fmt(tR) + '</div><div class="sub">' + rec.length + ' contas</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--danger)"><div class="label">📤 A Pagar</div><div class="value" style="color:var(--danger)">' + fmt(tP) + '</div><div class="sub">' + pag.length + ' contas</div></div>' +
    '<div class="metric-card"><div class="label">📊 Saldo</div><div class="value">' + fmt(tR - tP) + '</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-hand-holding-heart"></i> A Receber</h3><button class="btn btn-sm btn-success" onclick="abrirModalConta(\'receber\')"><i class="fas fa-plus"></i> Nova</button></div>' + table(['Cliente', 'Valor', 'Vencimento', 'Status', 'Ações'], recRows) + '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-file-invoice-dollar"></i> A Pagar</h3><button class="btn btn-sm btn-success" onclick="abrirModalConta(\'pagar\')"><i class="fas fa-plus"></i> Nova</button></div>' + table(['Fornecedor', 'Valor', 'Vencimento', 'Status', 'Ações'], pagRows) + '</div>';
}
function abrirModalConta(tipo) {
  const isR = tipo === 'receber';
  openModal(isR ? 'Nova Conta a Receber' : 'Nova Conta a Pagar',
    '<div class="form-group"><label>' + (isR ? 'Cliente' : 'Fornecedor') + ' *</label><input id="ctNome"></div>' +
    '<div class="form-group"><label>Descrição</label><input id="ctDesc"></div>' +
    '<div class="form-group"><label>Valor *</label><input id="ctValor" type="number" value="0"></div>' +
    '<div class="form-group"><label>Vencimento</label><input id="ctVenc" type="date" value="' + new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) + '"></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarConta(\'' + tipo + '\')">Salvar</button>');
}
async function salvarConta(tipo) {
  const n = $('ctNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; }
  const d = { valor: num($('ctValor').value, 0), descricao: $('ctDesc').value, vencimento: $('ctVenc').value, status: 'pendente', data: now() };
  if (tipo === 'receber') { d.cliente = n; await saveData('contasReceber', d); } else { d.fornecedor = n; await saveData('contasPagar', d); }
  toast('Conta registrada', 'success'); closeModal(); openModule('financeiro');
}
async function marcarPago(id, tipo) {
  const s = tipo === 'receber' ? 'contasReceber' : 'contasPagar';
  const c = await DB.get(s, id); c.status = 'pago'; c.dataPagamento = now(); await saveData(s, c);
  toast('Marcado pago', 'success'); openModule('financeiro');
}

/* ====== FISCAL ====== */
async function renderFiscal() {
  const vendas=await getData('vendas'),compras=await getData('compras');
  const tV=vendas.reduce((sum,v)=>sum+Number(v.total||0),0);
  const tC=compras.reduce((sum,c)=>sum+Number(c.valor||c.total||0),0);
  const hasSalesVat=vendas.some(v=>v.iva!==undefined&&v.iva!==null||v.ivaTotal!==undefined&&v.ivaTotal!==null||v.valorIVA!==undefined&&v.valorIVA!==null);
  const ivaV=hasSalesVat?vendas.reduce((sum,v)=>sum+Number(v.iva||v.ivaTotal||v.valorIVA||0),0):null;
  const hasPurchaseVat=compras.some(c=>c.iva!==undefined&&c.iva!==null||c.ivaTotal!==undefined&&c.ivaTotal!==null||c.valorIVA!==undefined&&c.valorIVA!==null);
  const ivaC=hasPurchaseVat?compras.reduce((sum,c)=>sum+Number(c.iva||c.ivaTotal||c.valorIVA||0),0):null;
  try {
    const rules=await KanawaCloud.getTaxRuleCatalog('IRT','A');
    if(rules.length)AGT_CONFIG.irt.faixas=rules.map(r=>({min:Number(r.lower_bound),max:r.upper_bound===null?Infinity:Number(r.upper_bound),taxa:Number(r.rate),parcela:Number(r.fixed_amount),excesso:Number(r.excess_threshold)}));
  } catch(error) { console.warn('Tabela fiscal local usada; catálogo fiscal não disponível.',error); }
  let taxReturns=[],agtStatus={};
  try { taxReturns=await KanawaCloud.listTaxReturns(); } catch(error) { console.warn(error); }
  try { agtStatus=await KanawaCloud.getAGTStatus(); } catch(error) { agtStatus={status:'not_configured',configured:false}; }
  const role=String(KanawaCloud.context&&KanawaCloud.context.membership&&KanawaCloud.context.membership.role||'').toLowerCase();
  const canConfigure=['owner','admin'].includes(role)||KanawaCloud.context&&KanawaCloud.context.isPlatformAdmin===true;
  const irtRows=AGT_CONFIG.irt.faixas.map(f=>[
    fmt(f.min)+' - '+(f.max===Infinity?'sem limite':fmt(f.max)),
    '<strong>'+(f.taxa*100).toLocaleString('pt-AO',{maximumFractionDigits:2})+'%</strong>',fmt(f.parcela),fmt(f.excesso)
  ]);
  const returnRows=taxReturns.map(r=>[esc(r.tax_type),fmtD(r.period_start)+' — '+fmtD(r.period_end),fmt(r.payable_amount),
    badge(r.status,r.status==='accepted'?'success':'warning'),
    '<button class="btn btn-sm btn-light" onclick="abrirDeclaracaoFiscal(&quot;'+esc(r.id)+'&quot;)">Abrir</button>']);
  const statusLabel=agtStatus.configured?'Credenciais cifradas guardadas':(agtStatus.status==='pending_certification'?'Pendente de certificação':'Não configurada');
  const vatSummary=ivaV===null?'IVA liquidado nas vendas ainda não está discriminado nos documentos.':
    ivaC===null?'IVA dedutível nas compras ainda não está discriminado; não é seguro calcular o saldo.':
    'IVA liquidado menos IVA dedutível: '+fmt(ivaV-ivaC);
  return header('Fiscal e AGT','Impostos, declarações e conformidade fiscal de Angola','var(--purple)',
      canConfigure?'<button class="btn btn-primary" onclick="abrirConfiguracaoAGT()"><i class="fas fa-key"></i> Configurar AGT</button>':'','fa-landmark')+
    '<div class="metric-grid">'+
    '<div class="metric-card"><div class="label">IVA liquidado — vendas</div><div class="value">'+(ivaV===null?'—':fmt(ivaV))+'</div></div>'+
    '<div class="metric-card"><div class="label">IVA dedutível — compras</div><div class="value">'+(ivaC===null?'—':fmt(ivaC))+'</div></div>'+
    '<div class="metric-card"><div class="label">Vendas registadas</div><div class="value">'+fmt(tV)+'</div></div>'+
    '<div class="metric-card"><div class="label">Compras registadas</div><div class="value">'+fmt(tC)+'</div></div></div>'+
    '<div class="card"><h3><i class="fas fa-calculator"></i> Apuramento de IVA</h3><p>'+esc(vatSummary)+'</p>'+
    '<p class="text-muted">O sistema não estima IVA de compras multiplicando o total por 14%. Só considera imposto discriminado nos documentos. Confirme regime, isenções, notas de crédito e dedutibilidade antes de submeter.</p>'+
    '<div class="quick-links"><button class="btn btn-warning" onclick="exportarIVADeclaracao()">Gerar prévia de IVA</button>'+
    '<button class="btn btn-primary" onclick="guardarRascunhoIVA()">Guardar rascunho IVA</button></div></div>'+
    '<div class="card"><h3><i class="fas fa-percent"></i> IRT — Grupo A · 2026</h3><p>Lei n.º 14/25 — OGE 2026. A matéria colectável deduz as contribuições obrigatórias para a Segurança Social e componentes não sujeitas/isentas nos termos do CIRT (Lei 18/14, alterada pela Lei 28/20).</p>'+
    table(['Rendimento mensal (Kz)','Taxa','Parcela fixa','Excesso de'],irtRows)+
    '<p class="text-muted">Tabela legal carregada do catálogo fiscal do servidor. A simulação não substitui a validação do contabilista nem a declaração oficial.</p>'+
    '<div class="quick-links"><button class="btn btn-info" onclick="exportarIRTDeclaracao()">Gerar prévia de IRT</button>'+
    '<button class="btn btn-primary" onclick="guardarRascunhoIRT()">Guardar rascunho IRT</button></div></div>'+
    '<div class="card"><h3><i class="fas fa-shield-alt"></i> Integração AGT — Facturação Electrónica</h3>'+
    '<p><strong>Estado:</strong> '+esc(statusLabel)+'</p><p><strong>Ambiente:</strong> '+esc(agtStatus.environment||'Não definido')+
    ' · <strong>API:</strong> Schema 2.0</p><p class="text-muted">A API oficial exige credenciais do produtor, assinatura JWS RSA e registo/certificação do software. A configuração de chaves fica no servidor; o navegador nunca recebe as chaves privadas.</p>'+
    (canConfigure?'<button class="btn btn-primary" onclick="abrirConfiguracaoAGT()">Abrir configuração segura</button>':'<p class="text-muted">Apenas o proprietário/administrador configura credenciais.</p>')+
    '<button class="btn btn-light" onclick="prepararSAFTAO()">Verificar preparação SAF-T AO</button></div>'+
    '<div class="card"><h3><i class="fas fa-file-alt"></i> Declarações guardadas</h3>'+
    (returnRows.length?table(['Tipo','Período','Valor a pagar','Estado','Acção'],returnRows):emptyState('fa-file-invoice','Ainda não existem rascunhos de declarações.'))+'</div>'+
    '<div class="card"><h3><i class="fas fa-book-open"></i> Legislação fiscal e conformidade</h3>'+
    '<div class="legal-links"><a href="https://www.agt.minfin.gov.ao/" target="_blank" rel="noopener">Portal oficial da AGT</a>'+
    '<a href="https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2" target="_blank" rel="noopener">Documentação API de Facturação Electrónica — Schema 2</a>'+
    '<a href="'+AGT_CONFIG.irt.sourceUrl+'" target="_blank" rel="noopener">Lei n.º 14/25 — OGE 2026 / tabela IRT</a>'+
    '<a href="https://www.portaldocontribuinte.minfin.gov.ao/legislacao" target="_blank" rel="noopener">Legislação fiscal — Portal do Contribuinte</a>'+
    '<a href="https://www.cnnca.minfin.gov.ao/" target="_blank" rel="noopener">Plano Geral de Contabilidade</a></div>'+
    '<p class="text-muted">A API de Facturação Electrónica não é uma API geral de submissão de declarações fiscais. As declarações permanecem como rascunhos até existir procedimento oficial próprio.</p></div>'+
    '<div class="card"><h3><i class="fas fa-download"></i> Exportações e relatórios</h3>'+
    '<div class="quick-links"><button class="btn btn-light" onclick="prepararSAFTAO()">Preparar SAF-T AO</button>'+
    '<button class="btn btn-light" onclick="exportarInventario()">Inventário</button>'+
    '<button class="btn btn-light" onclick="openModule(\'contabilidade\')">Relatórios contabilísticos</button></div></div>';
}
async function exportarSAFTCompleto() { return prepararSAFTAO(); }
async function exportarIRTDeclaracao() {
  const funcs=await getData('funcionarios');
  const emp=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
  const month=new Date().toISOString().slice(0,7);
  let csv='RASCUNHO DE CONFERÊNCIA IRT — GRUPO A 2026\nEmpresa: '+(emp.nome||'')+'\nNIF: '+(emp.nif||'')+'\nPeríodo: '+month+'\nLei: '+AGT_CONFIG.irt.legalReference+'\nNão é uma declaração submetida à AGT.\n\n';
  csv+='Nome,Cargo,Bruto,INSS trabalhador,Matéria colectável,IRT,Líquido\n';
  funcs.forEach(f=>{
    const r=calcularRemuneracaoAO(f);
    const quote=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
    csv+=[quote(f.nome),quote(f.cargo||''),r.gross,r.employeeInss,r.irtBase,r.irt,r.net].join(',')+'\n';
  });
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='RASCUNHO_IRT_GRUPO_A_'+month+'.csv';a.click();URL.revokeObjectURL(url);
  toast('Prévia de IRT gerada para conferência.','success');
}
async function exportarIVADeclaracao() {
  const vendas=await getData('vendas'),compras=await getData('compras');
  const emp=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
  const hasSalesVat=vendas.some(v=>v.iva!==undefined&&v.iva!==null||v.ivaTotal!==undefined&&v.ivaTotal!==null||v.valorIVA!==undefined&&v.valorIVA!==null);
  const ivaV=hasSalesVat?vendas.reduce((sum,v)=>sum+Number(v.iva||v.ivaTotal||v.valorIVA||0),0):null;
  const hasPurchaseVat=compras.some(c=>c.iva!==undefined&&c.iva!==null||c.ivaTotal!==undefined&&c.ivaTotal!==null||c.valorIVA!==undefined&&c.valorIVA!==null);
  const ivaC=hasPurchaseVat?compras.reduce((sum,c)=>sum+Number(c.iva||c.ivaTotal||c.valorIVA||0),0):null;
  const baseV=vendas.reduce((sum,v)=>sum+Number(v.subtotal||v.total||0)-Number(v.descontoValor||0),0);
  const period=new Date().toISOString().slice(0,7);
  let txt='RASCUNHO DE APURAMENTO IVA — ANGOLA\nEmpresa: '+(emp.nome||'')+'\nNIF: '+(emp.nif||'')+'\nPeríodo: '+period+'\n\n';
  txt+='Base de vendas: '+fmt(baseV)+'\nIVA liquidado: '+(ivaV===null?'NÃO APURADO — documentos sem IVA discriminado':fmt(ivaV))+'\n';
  txt+='IVA dedutível: '+(ivaC===null?'NÃO APURADO — falta IVA discriminado nas compras':fmt(ivaC))+'\n';
  txt+='Saldo preliminar: '+(ivaV===null||ivaC===null?'NÃO CALCULADO':fmt(ivaV-ivaC))+'\n\n';
  txt+='Este documento é uma prévia de conferência, não é formulário oficial nem comprovativo de submissão à AGT. Confirme regime, isenções, notas de crédito e dedutibilidade.';
  const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='RASCUNHO_IVA_'+period+'.txt';a.click();URL.revokeObjectURL(url);
  toast('Prévia de IVA gerada para conferência.','success');
}
async function exportarInventario() {
  if (typeof XLSX === 'undefined') { toast('Excel indisponível', 'warning'); return; }
  const p = await getData('produtos'); const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const ws = XLSX.utils.json_to_sheet(p.map(x => ({ Codigo: x.codigo, CodigoBarras: x.codigoBarras, Nome: x.nome, Categoria: x.categoria, Estoque: x.estoque || 0, Preco: x.preco, Total: (x.estoque || 0) * x.preco })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Inventário');
  XLSX.writeFile(wb, 'Inventario_' + (emp.nif || 'emp') + '_' + Date.now() + '.xlsx');
  toast('📄 Inventário exportado', 'success');
}

/* ====== RH ====== */
async function renderRH() {
  const f = await getData('funcionarios');
  const active=f.filter(x=>x.status!=='inactivo');
  const rows = f.map(x => {
    const p=calcularRemuneracaoAO(x);
    return [x.id, '<strong>' + esc(x.nome) + '</strong>', esc(x.cargo || '-'), fmtD(x.dataContratacao), fmt(x.salario||0), fmt(x.bonus||0),
      '<span style="color:var(--danger)">-' + fmt(p.irt+p.employeeInss) + '</span>',
      '<span style="color:var(--success);font-weight:700">' + fmt(p.net) + '</span>',
      '<button class="btn btn-sm btn-danger" onclick="excluirItem(&quot;funcionarios&quot;,' + x.id + ')"><i class="fas fa-trash"></i></button>'];
  });
  return header('RH — Recursos Humanos', f.length + ' funcionários', 'var(--info)', '<button class="btn btn-success" onclick="abrirModalFuncionario()"><i class="fas fa-plus"></i> Novo</button>', 'fa-user-tie') +
    '<div class="metric-grid"><div class="metric-card"><div class="label">Activos</div><div class="value">'+active.length+'</div></div><div class="metric-card"><div class="label">Salário base mensal</div><div class="value">'+fmt(active.reduce((s,x)=>s+Number(x.salario||0),0))+'</div></div><div class="metric-card"><div class="label">Bónus mensais</div><div class="value">'+fmt(active.reduce((s,x)=>s+Number(x.bonus||0),0))+'</div></div></div>' +
    '<div class="card">' + table(['#','Nome','Cargo','Admissão','Salário base','Bónus','IRT + INSS','Líquido estimado','Ações'], rows) + '</div>' +
    '<div class="card"><p style="font-size:.78rem;color:var(--text-muted)">Para calcular e registar a folha completa, incluindo contribuições do empregador e histórico mensal, utilize o módulo Folha Salarial.</p></div>';
}
function abrirModalFuncionario() {
  openModal('Novo Funcionário', '<div class="form-grid">' +
    '<div class="form-group full"><label>Nome completo *</label><input id="fnNome"></div>' +
    '<div class="form-group"><label>BI / Passaporte</label><input id="fnBI"></div><div class="form-group"><label>NIF</label><input id="fnNIF"></div>' +
    '<div class="form-group"><label>Cargo</label><input id="fnCargo"></div><div class="form-group"><label>Departamento</label><input id="fnDepartamento"></div>' +
    '<div class="form-group"><label>Data de admissão</label><input id="fnDataInicio" type="date"></div><div class="form-group"><label>Tipo de contrato</label><select id="fnContrato"><option>Indeterminado</option><option>Determinado</option><option>Temporário</option><option>Prestação de serviços</option></select></div>' +
    '<div class="form-group"><label>Salário base (Kz)</label><input id="fnSalario" type="number" min="0" value="0"></div><div class="form-group"><label>Bónus mensal (Kz)</label><input id="fnBonus" type="number" min="0" value="0"></div>' +
    '<div class="form-group"><label>Subsídio transporte</label><input id="fnTransporte" type="number" min="0" value="0"></div><div class="form-group"><label>Subsídio alimentação</label><input id="fnAlimentacao" type="number" min="0" value="0"></div>' +
    '<div class="form-group"><label>Email</label><input id="fnEmail" type="email"></div><div class="form-group"><label>Telefone</label><input id="fnTelefone"></div></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarFuncionario()">Guardar funcionário</button>');
}
async function salvarFuncionario() {
  const n = $('fnNome').value.trim(); if (!n) { toast('Informe o nome do funcionário', 'warning'); return; }
  const employeeData = {
    nome:n, bi:$('fnBI').value.trim(), nif:$('fnNIF').value.trim(), cargo:$('fnCargo').value.trim(),
    departamento:$('fnDepartamento').value.trim(), dataContratacao:$('fnDataInicio').value || now(),
    tipoContrato:$('fnContrato').value, salario:num($('fnSalario').value,0), bonus:num($('fnBonus').value,0),
    subsidioTransporte:num($('fnTransporte').value,0), subsidioAlimentacao:num($('fnAlimentacao').value,0),
    email:$('fnEmail').value.trim(), telefone:$('fnTelefone').value.trim(), status:'activo'
  };
  const localId=await saveData('funcionarios',employeeData);
  if(window.KanawaCloud&&KanawaCloud.ready){
    try{
      const remote=await KanawaCloud.upsertEmployee({employeeNumber:'EMP-'+localId,fullName:n,email:employeeData.email,phone:employeeData.telefone,taxId:employeeData.nif,department:employeeData.departamento,jobTitle:employeeData.cargo,hireDate:employeeData.dataContratacao,salary:employeeData.salario,status:'active'});
      employeeData.id=localId;employeeData.cloud_id=remote.id;await DB.put('funcionarios',employeeData);
      await KanawaCloud.saveEmployeeCompensation({employeeId:remote.id,effectiveFrom:employeeData.dataContratacao,baseSalary:employeeData.salario,transportAllowance:employeeData.subsidioTransporte,mealAllowance:employeeData.subsidioAlimentacao,bonus:employeeData.bonus});
    }catch(syncError){console.warn('Sincronização RH pendente:',syncError);toast('Funcionário guardado. A sincronização dos dados laborais será repetida.','warning');}
  }
  toast('Funcionário registado', 'success'); closeModal(); openModule('rh');
}

/* ====== PROJETOS ====== */
async function renderProjetos() {
  const p = await getData('projetos');
  const rows = p.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', badge(x.status || 'ativo', 'info'), '<div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden;width:100px;display:inline-block;vertical-align:middle"><div style="background:var(--success);height:100%;width:' + (x.progresso || 0) + '%"></div></div> ' + (x.progresso || 0) + '%', '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'projetos\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Projetos', p.length + ' projetos', 'var(--primary)', '<button class="btn btn-success" onclick="abrirModalProjeto()"><i class="fas fa-plus"></i> Novo</button>', 'fa-project-diagram') + '<div class="card">' + table(['#', 'Nome', 'Status', 'Progresso', 'Ações'], rows) + '</div>';
}
function abrirModalProjeto() { openModal('Novo Projeto', '<div class="form-group"><label>Nome *</label><input id="pjNome"></div><div class="form-group"><label>Descrição</label><textarea id="pjDesc" rows="2"></textarea></div><div class="form-group"><label>Progresso (%)</label><input id="pjProg" type="number" value="0" min="0" max="100"></div><button class="btn btn-primary btn-block" onclick="salvarProjeto()">Salvar</button>'); }
async function salvarProjeto() { const n = $('pjNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('projetos', { nome: n, descricao: $('pjDesc').value, progresso: int($('pjProg').value, 0), status: 'ativo', dataInicio: now() }); toast('Criado', 'success'); closeModal(); openModule('projetos'); }

/* ====== TAREFAS ====== */
async function renderTarefas() {
  const t = await getData('tarefas');
  const rows = t.map(x => [x.id, '<strong>' + esc(x.titulo) + '</strong>', esc(x.prioridade || 'média'), badge(x.status || 'pendente', x.status === 'concluida' ? 'success' : 'warning'), fmtD(x.prazo),
    '<button class="btn btn-sm btn-success" onclick="concluirTarefa(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'tarefas\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Tarefas', t.length + ' tarefas', 'var(--purple)', '<button class="btn btn-success" onclick="abrirModalTarefa()"><i class="fas fa-plus"></i> Nova</button>', 'fa-tasks') + '<div class="card">' + table(['#', 'Título', 'Prioridade', 'Status', 'Prazo', 'Ações'], rows) + '</div>';
}
function abrirModalTarefa() { openModal('Nova Tarefa', '<div class="form-group"><label>Título *</label><input id="tkTitulo"></div><div class="form-group"><label>Prioridade</label><select id="tkPrior"><option>baixa</option><option selected>média</option><option>alta</option></select></div><div class="form-group"><label>Prazo</label><input id="tkPrazo" type="date" value="' + new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) + '"></div><button class="btn btn-primary btn-block" onclick="salvarTarefa()">Salvar</button>'); }
async function salvarTarefa() { const n = $('tkTitulo').value.trim(); if (!n) { toast('Informe título', 'warning'); return; } await saveData('tarefas', { titulo: n, prioridade: $('tkPrior').value, prazo: $('tkPrazo').value, status: 'pendente', data: now() }); toast('Criada', 'success'); closeModal(); openModule('tarefas'); }
async function concluirTarefa(id) { const t = await DB.get('tarefas', id); if (t) { t.status = 'concluida'; t.dataConclusao = now(); await saveData('tarefas', t); toast('Concluída', 'success'); openModule('tarefas'); } }

/* ====== ATIVOS ====== */
async function renderAtivos() {
  const a = await getData('ativos');
  const rows = a.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', esc(x.patrimonio || '-'), fmt(x.valor), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'ativos\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Ativos', a.length + ' ativos', 'var(--primary)', '<button class="btn btn-success" onclick="abrirModalAtivo()"><i class="fas fa-plus"></i> Novo</button>', 'fa-building') + '<div class="card">' + table(['#', 'Nome', 'Patrimônio', 'Valor', 'Ações'], rows) + '</div>';
}
function abrirModalAtivo() { openModal('Novo Ativo', '<div class="form-group"><label>Nome *</label><input id="atNome"></div><div class="form-group"><label>Patrimônio</label><input id="atPatr"></div><div class="form-group"><label>Valor</label><input id="atValor" type="number" value="0"></div><button class="btn btn-primary btn-block" onclick="salvarAtivo()">Salvar</button>'); }
async function salvarAtivo() { const n = $('atNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('ativos', { nome: n, patrimonio: $('atPatr').value, valor: num($('atValor').value, 0), dataAquisicao: now() }); toast('Cadastrado', 'success'); closeModal(); openModule('ativos'); }

/* ====== FROTA ====== */
async function renderFrota() {
  const f = await getData('frotas');
  const rows = f.map(x => [x.id, '<strong>' + esc(x.placa) + '</strong>', esc(x.modelo), x.ano || '-', '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'frotas\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Frota', f.length + ' veículos', 'var(--primary)', '<button class="btn btn-success" onclick="abrirModalVeiculo()"><i class="fas fa-plus"></i> Novo</button>', 'fa-truck-moving') + '<div class="card">' + table(['#', 'Placa', 'Modelo', 'Ano', 'Ações'], rows) + '</div>';
}
function abrirModalVeiculo() { openModal('Novo Veículo', '<div class="form-group"><label>Placa *</label><input id="vPlaca"></div><div class="form-group"><label>Modelo *</label><input id="vModelo"></div><div class="form-group"><label>Ano</label><input id="vAno" type="number" value="' + new Date().getFullYear() + '"></div><button class="btn btn-primary btn-block" onclick="salvarVeiculo()">Salvar</button>'); }
async function salvarVeiculo() { const p = $('vPlaca').value.trim(); const m = $('vModelo').value.trim(); if (!p || !m) { toast('Preencha placa e modelo', 'warning'); return; } await saveData('frotas', { placa: p, modelo: m, ano: int($('vAno').value), status: 'ativo' }); toast('Cadastrado', 'success'); closeModal(); openModule('frota'); }

/* ====== OS ====== */
async function renderOS() {
  const o = await getData('ordensServico');
  const rows = o.map(x => ['#' + x.id, esc(x.cliente), esc(x.descricao || '-'), badge(x.status || 'aberta', 'warning'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'ordensServico\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Ordens de Serviço', o.length + ' OS', 'var(--danger)', '<button class="btn btn-success" onclick="abrirModalOS()"><i class="fas fa-plus"></i> Nova</button>', 'fa-clipboard-list') + '<div class="card">' + table(['#', 'Cliente', 'Descrição', 'Status', 'Ações'], rows) + '</div>';
}
function abrirModalOS() { openModal('Nova OS', '<div class="form-group"><label>Cliente *</label><input id="osCliente"></div><div class="form-group"><label>Descrição</label><textarea id="osDesc" rows="2"></textarea></div><button class="btn btn-primary btn-block" onclick="salvarOS()">Salvar</button>'); }
async function salvarOS() { const c = $('osCliente').value.trim(); if (!c) { toast('Informe cliente', 'warning'); return; } await saveData('ordensServico', { cliente: c, descricao: $('osDesc').value, status: 'aberta', data: now() }); toast('Criada', 'success'); closeModal(); openModule('os'); }

/* ====== CONTRATOS ====== */
async function renderContratos() {
  const c = await getData('contratos');
  const rows = c.map(x => [x.id, esc(x.cliente), fmt(x.valor), fmtD(x.inicio), fmtD(x.fim), badge(x.status || 'ativo', x.status === 'ativo' ? 'success' : 'warning'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'contratos\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Contratos', c.length + ' contratos', 'var(--primary)', '<button class="btn btn-success" onclick="abrirModalContrato()"><i class="fas fa-plus"></i> Novo</button>', 'fa-file-contract') + '<div class="card">' + table(['#', 'Cliente', 'Valor', 'Início', 'Fim', 'Status', 'Ações'], rows) + '</div>';
}
function abrirModalContrato() {
  openModal('Novo Contrato',
    '<div class="form-group"><label>Cliente *</label><input id="ctContNome"></div>' +
    '<div class="form-group"><label>Valor *</label><input id="ctContValor" type="number" value="0"></div>' +
    '<div class="form-group"><label>Início</label><input id="ctContIni" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
    '<div class="form-group"><label>Fim</label><input id="ctContFim" type="date" value="' + new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) + '"></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarContrato()">Salvar</button>');
}
async function salvarContrato() { const c = $('ctContNome').value.trim(); if (!c) { toast('Informe cliente', 'warning'); return; } await saveData('contratos', { cliente: c, valor: num($('ctContValor').value, 0), inicio: $('ctContIni').value, fim: $('ctContFim').value, status: 'ativo' }); toast('Criado', 'success'); closeModal(); openModule('contratos'); }

/* ====== DOCUMENTOS ====== */
async function renderDocumentos() {
  const d = await getData('documentos');
  const rows = d.map(x => [x.id, esc(x.nome), esc(x.tipo || '-'), fmtD(x.data), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'documentos\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Documentos', d.length + ' documentos', 'var(--primary)', '<button class="btn btn-success" onclick="abrirModalDocumento()"><i class="fas fa-plus"></i> Novo</button>', 'fa-folder-open') + '<div class="card">' + table(['#', 'Nome', 'Tipo', 'Data', 'Ações'], rows) + '</div>';
}
function abrirModalDocumento() { openModal('Novo Documento', '<div class="form-group"><label>Nome *</label><input id="docNome"></div><div class="form-group"><label>Tipo</label><select id="docTipo"><option>Fatura</option><option>Contrato</option><option>Recibo</option><option>Outro</option></select></div><button class="btn btn-primary btn-block" onclick="salvarDocumento()">Salvar</button>'); }
async function salvarDocumento() { const n = $('docNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('documentos', { nome: n, tipo: $('docTipo').value, data: now() }); toast('Salvo', 'success'); closeModal(); openModule('documentos'); }

/* ====== TICKETS ====== */
async function renderTickets() {
  const t = await getData('tickets');
  const rows = t.map(x => ['#' + x.id, esc(x.titulo), esc(x.cliente || '-'), badge(x.prioridade || 'normal', 'info'), badge(x.status || 'aberto', x.status === 'resolvido' ? 'success' : 'warning'),
    '<button class="btn btn-sm btn-success" onclick="resolverTicket(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'tickets\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Tickets de Suporte', t.length + ' tickets', 'var(--danger)', '<button class="btn btn-success" onclick="abrirModalTicket()"><i class="fas fa-plus"></i> Novo</button>', 'fa-ticket-alt') + '<div class="card">' + table(['#', 'Título', 'Cliente', 'Prioridade', 'Status', 'Ações'], rows) + '</div>';
}
function abrirModalTicket() {
  openModal('Novo Ticket',
    '<div class="form-group"><label>Título *</label><input id="tkTTitulo"></div>' +
    '<div class="form-group"><label>Cliente</label><input id="tkTCliente"></div>' +
    '<div class="form-group"><label>Descrição</label><textarea id="tkTDesc" rows="3"></textarea></div>' +
    '<div class="form-group"><label>Prioridade</label><select id="tkTPrior"><option>baixa</option><option selected>normal</option><option>alta</option><option>urgente</option></select></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarTicket()">Abrir Ticket</button>');
}
async function salvarTicket() { const n = $('tkTTitulo').value.trim(); if (!n) { toast('Informe título', 'warning'); return; } await saveData('tickets', { titulo: n, cliente: $('tkTCliente').value, descricao: $('tkTDesc').value, prioridade: $('tkTPrior').value, status: 'aberto', data: now() }); toast('Ticket criado', 'success'); closeModal(); openModule('tickets'); }
async function resolverTicket(id) { const t = await DB.get('tickets', id); if (t) { t.status = 'resolvido'; t.dataResolucao = now(); await saveData('tickets', t); toast('Resolvido', 'success'); openModule('tickets'); } }

/* ====== VENDAS ====== */
async function renderVendas() {
  const v = await getData('vendas');
  const d = await getData('devolucoes');
  const rows = v.slice().reverse().map(x => ['<strong>' + esc(x.numeroFatura || '#' + x.id) + '</strong>', esc(x.clienteNome || '-'), '<strong>' + fmt(x.total) + '</strong>', esc(x.pagamento || '-'), badge(x.status || '-', 'success'), fmtDT(x.data),
    '<button class="btn btn-sm btn-info" onclick="verFatura(' + x.id + ')"><i class="fas fa-eye"></i></button>' + (podeFazer('excluir') ? ' <button class="btn btn-sm btn-danger" onclick="excluirItem(\'vendas\',' + x.id + ')"><i class="fas fa-trash"></i></button>' : '')]);
  const devRows = d.slice().reverse().map(x => [esc(x.vendaNumero || '-'), esc(x.cliente || '-'), esc(x.motivo || '-'), fmt(x.total), fmtDT(x.data)]);
  return header('Vendas', v.length + ' vendas | ' + d.length + ' devoluções', 'var(--primary)', '<button class="btn btn-success" onclick="openModule(\'pdv\')"><i class="fas fa-plus"></i> Nova</button>', 'fa-receipt') +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Vendas</h3></div>' + table(['Nº', 'Cliente', 'Total', 'Pagamento', 'Status', 'Data', 'Ações'], rows) + '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-undo-alt"></i> Devoluções</h3></div>' + table(['Venda', 'Cliente', 'Motivo', 'Total', 'Data'], devRows) + '</div>';
}
async function verFatura(id) { const v = await DB.get('vendas', id); if (v) abrirFatura(v); }

/* ====== ORÇAMENTOS ====== */
async function renderOrcamentos() {
  const o=await getData('orcamentos')||[];
  const counts={rascunho:o.filter(x=>x.status==='rascunho'||x.status==='pendente').length,enviada:o.filter(x=>x.status==='enviada').length,aceite:o.filter(x=>x.status==='aceite').length,convertida:o.filter(x=>x.status==='convertida').length,perdida:o.filter(x=>x.status==='perdida').length};
  const rows=o.slice().reverse().map(x=>[
    '#'+x.id,esc(x.empresaCliente||(x.cliente&&x.cliente.nome)||'-'),esc(x.responsavel||'-'),(x.carrinho||[]).length,
    '<strong>'+fmt(x.total)+'</strong>',fmtD(x.dataEnvio||x.data),badge(x.status||'rascunho',x.status==='convertida'?'success':x.status==='perdida'?'danger':x.status==='aceite'?'info':'warning'),
    '<button class="btn btn-sm btn-info" title="Marcar enviada" onclick="atualizarEstadoOrcamento('+x.id+',\'enviada\')"><i class="fas fa-paper-plane"></i></button> '+
    '<button class="btn btn-sm btn-success" title="Aceite pelo cliente" onclick="atualizarEstadoOrcamento('+x.id+',\'aceite\')"><i class="fas fa-check"></i></button> '+
    '<button class="btn btn-sm btn-warning" title="Proposta perdida" onclick="atualizarEstadoOrcamento('+x.id+',\'perdida\')"><i class="fas fa-times"></i></button> '+
    '<button class="btn btn-sm btn-primary" title="Converter em venda" onclick="converterOrcamento('+x.id+')"><i class="fas fa-arrow-right"></i></button>'
  ]);
  return header('Propostas e Negócios',o.length+' propostas comerciais','var(--info)','', 'fa-file-invoice')+
    '<div class="metric-grid">'+
    '<div class="metric-card"><div class="label">Rascunhos</div><div class="value">'+counts.rascunho+'</div></div>'+
    '<div class="metric-card"><div class="label">Enviadas</div><div class="value">'+counts.enviada+'</div></div>'+
    '<div class="metric-card"><div class="label">Aceites</div><div class="value">'+counts.aceite+'</div></div>'+
    '<div class="metric-card"><div class="label">Convertidas em compra</div><div class="value">'+counts.convertida+'</div></div></div>'+
    '<div class="card"><p style="color:var(--text-muted);font-size:.84rem;margin-bottom:12px">Acompanhe para que empresa foi enviada cada proposta, quem é o responsável, o estado da negociação e a venda que resultou da proposta.</p>'+
    table(['Referência','Empresa cliente','Responsável','Itens','Valor','Data','Estado','Acções'],rows)+'</div>';
}
async function atualizarEstadoOrcamento(id,status) {
  const q=await DB.get('orcamentos',id);if(!q)return;
  const user=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
  q.status=status;
  if(status==='enviada')q.dataEnvio=now();
  if(status==='aceite')q.dataAceite=now();
  if(status==='perdida')q.dataPerda=now();
  q.historico=Array.isArray(q.historico)?q.historico:[];
  q.historico.push({evento:'Estado alterado para '+status,data:now(),responsavel:user.nome||'Admin'});
  await saveData('orcamentos',q);toast('Estado da proposta actualizado.','success');openModule('orcamentos');
}
async function converterOrcamento(id) {
  const o = await DB.get('orcamentos', id); if (!o) return;
  pdvState.carrinho = o.carrinho || []; pdvState.cliente = o.cliente || { nome: 'Cliente Anônimo', nif: '', telefone: '' }; pdvState.desconto = o.desconto || 0; pdvState.orcamentoOrigem=o.id;
  toast('Orçamento carregado no PDV', 'success'); openModule('pdv');
}

/* ====== E-COMMERCE ====== */
async function renderEcommerce() {
  const p = await getData('produtos'); const promo = await getData('promocoes');
  const cards = p.map(x => {
    const pub = x.publicado !== false;
    return '<div class="pdv-prod-card"><div class="img"><img src="' + imgSrc(x) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div>' +
      '<div class="info"><div class="name">' + esc(x.nome) + '</div><div class="price">' + fmt(x.preco) + '</div><div class="stock">' + esc(x.categoria || '') + '</div>' +
      '<div style="margin-top:8px;display:flex;gap:4px;justify-content:center">' +
      '<button class="btn btn-sm btn-primary" onclick="abrirModalProduto(' + x.id + ')"><i class="fas fa-edit"></i></button>' +
      '<button class="btn btn-sm ' + (pub ? 'btn-success' : 'btn-secondary') + '" onclick="togglePublicado(' + x.id + ')"><i class="fas fa-' + (pub ? 'eye' : 'eye-slash') + '"></i></button></div></div></div>';
  }).join('');
  return header('E-commerce', 'Loja virtual e catálogo', 'var(--success)', '<button class="btn btn-success" onclick="abrirModalPromocao()"><i class="fas fa-percent"></i> Nova Promoção</button>', 'fa-store') +
    '<div class="metric-grid"><div class="metric-card"><div class="label">Publicados</div><div class="value">' + p.filter(x => x.publicado !== false).length + '</div><div class="sub">de ' + p.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--warning)"><div class="label">Promoções</div><div class="value">' + promo.length + '</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-box"></i> Catálogo</h3></div><div class="pdv-products-grid">' + cards + '</div></div>';
}
async function togglePublicado(id) { const p = await DB.get('produtos', id); p.publicado = p.publicado === false ? true : false; await saveData('produtos', p); openModule('ecommerce'); }
function abrirModalPromocao() { openModal('Nova Promoção', '<div class="form-group"><label>Nome *</label><input id="prNome"></div><div class="form-group"><label>Desconto (%)</label><input id="prDesc" type="number" value="10"></div><button class="btn btn-primary btn-block" onclick="salvarPromocao()">Salvar</button>'); }
async function salvarPromocao() { const n = $('prNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('promocoes', { nome: n, desconto: num($('prDesc').value, 0), data: now() }); toast('Criada', 'success'); closeModal(); openModule('ecommerce'); }

/* ====== RELATÓRIOS ====== */
async function renderRelatorios() {
  const [vendas, produtos, clientes] = await Promise.all([getData('vendas'), getData('produtos'), getData('clientes')]);
  const tV = vendas.reduce((s, v) => s + (v.total || 0), 0);
  return header('Relatórios', 'Análise e exportação', 'var(--primary)', '', 'fa-chart-bar') +
    '<div class="metric-grid">' +
    '<div class="metric-card"><div class="label">Total Vendas</div><div class="value">' + vendas.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">Faturamento</div><div class="value">' + fmt(tV) + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--info)"><div class="label">Ticket Médio</div><div class="value">' + (vendas.length ? fmt(tV / vendas.length) : fmt(0)) + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--warning)"><div class="label">Produtos</div><div class="value">' + produtos.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--purple)"><div class="label">Clientes</div><div class="value">' + clientes.length + '</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-download"></i> Exportar</h3></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn btn-success" onclick="exportarBackupCompleto()"><i class="fas fa-database"></i> Backup JSON</button>' +
    '<button class="btn btn-info" onclick="exportarVendasCSV()"><i class="fas fa-file-csv"></i> Vendas CSV</button>' +
    '<button class="btn btn-primary" onclick="exportarProdutos()"><i class="fas fa-file-excel"></i> Produtos Excel</button></div></div>';
}
async function exportarBackupCompleto() {
  const data = {};
  for (const s of DB.stores) { try { data[s] = await DB.getAll(s); } catch (e) { data[s] = []; } }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'kanawa_backup_' + Date.now() + '.json'; a.click();
  URL.revokeObjectURL(url); toast('Backup exportado', 'success');
}
async function exportarVendasCSV() {
  const vendas = await getData('vendas');
  let csv = 'Nº,Cliente,Total,Pagamento,Status,Data\n';
  vendas.forEach(v => { csv += '"' + (v.numeroFatura || v.id) + '","' + (v.clienteNome || '') + '",' + v.total + ',' + (v.pagamento || '') + ',' + (v.status || '') + ',' + v.data + '\n'; });
  const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'vendas_' + Date.now() + '.csv'; a.click();
  URL.revokeObjectURL(url); toast('CSV exportado', 'success');
}

/* ====== UTILIZADORES E PERMISSÕES CLOUD ====== */
async function renderUsuarios() {
  if (!podeAcessar('usuarios')) return '<div class="card"><h3>Sem permissão</h3></div>';
  if (!window.KanawaCloud || !KanawaCloud.ready) return '<div class="card"><h3>Ligação cloud necessária</h3><p>Os utilizadores e permissões são geridos na base central.</p></div>';
  try {
    const members = await KanawaCloud.listTeamMembers();
    const invitations = await KanawaCloud.listTeamInvitations();
    const currentUserId = KanawaCloud.context.user.id;
    const labels = { owner:'Proprietário',admin:'Administrador',manager:'Gerente',gerente:'Gerente',operator:'Operador',operador:'Operador',cashier:'Caixa',caixa:'Caixa',accountant:'Contabilista',contabilista:'Contabilista' };
    const rows = members.map(member => {
      const id = esc(member.user_id);
      const role = String(member.role || 'operator').toLowerCase();
      const protectedMember = ['owner','admin'].includes(role) || member.user_id === currentUserId;
      const active = member.status === 'active';
      const options = ['manager','operator','cashier','accountant'].map(value =>
        '<option value="'+value+'" '+(role===value?'selected':'')+'>'+esc(labels[value])+'</option>'
      ).join('');
      const actions = protectedMember ? '<span class="text-muted">Protegido</span>' :
        '<div class="team-actions"><select id="teamRole_'+id+'" class="form-control">'+options+'</select>'+
        '<button class="btn btn-sm btn-primary" onclick="alterarAcessoMembro(\''+id+'\',\''+(active?'active':'suspended')+'\')">Guardar perfil</button>'+
        '<button class="btn btn-sm btn-outline" onclick="abrirPermissoesMembro(\''+id+'\')">Permissões</button>'+
        '<button class="btn btn-sm '+(active?'btn-warning':'btn-success')+'" onclick="alterarAcessoMembro(\''+id+'\',\''+(active?'suspended':'active')+'\')">'+(active?'Suspender':'Reactivar')+'</button></div>';
      return ['<strong>'+esc(member.full_name||'Utilizador')+'</strong>',esc(member.email||'—'),badge(labels[role]||role,'primary'),
        badge(active?'Activo':'Suspenso',active?'success':'danger'),actions];
    });
    const pending = invitations.filter(inv => !inv.accepted_at && new Date(inv.expires_at).getTime() > Date.now());
    const inviteRows = pending.map(inv => [esc(inv.full_name),esc(inv.email),badge(labels[inv.role]||inv.role,'primary'),fmtDT(inv.expires_at)]);
    return header('Utilizadores e permissões',members.length+' membros · '+pending.length+' convites pendentes',
      'var(--danger)','<button class="btn btn-primary" onclick="abrirModalUsuario()"><i class="fas fa-user-plus"></i> Convidar colaborador</button>','fa-user-shield')+
      '<div class="card"><h3>Membros da empresa</h3>'+table(['Nome','Email','Perfil','Estado','Ações'],rows)+'</div>'+
      '<div class="card"><h3>Convites pendentes</h3>'+(inviteRows.length?table(['Nome','Email','Perfil','Expira em'],inviteRows):emptyState('fa-envelope-open','Não existem convites pendentes.'))+
      '<p class="text-muted">O colaborador deve usar o código no formulário “Tenho um convite” e confirmar o mesmo email.</p></div>';
  } catch (error) {
    return '<div class="card"><h3>Não foi possível carregar a equipa</h3><p>'+esc(error.message||'Erro de ligação')+'</p></div>';
  }
}
function abrirModalUsuario() {
  if (!TEAM_INVITATIONS_ENABLED) { toast('Convites temporariamente bloqueados por segurança.', 'warning'); return; }
  if (!podeAcessar('usuarios')) { toast('Somente o administrador pode gerir utilizadores.', 'error'); return; }
  openModal('Convidar colaborador',
    '<div class="form-group"><label>Nome completo *</label><input id="uNome" autocomplete="name"></div>'+
    '<div class="form-group"><label>Email do colaborador *</label><input id="uEmail" type="email" autocomplete="email"></div>'+
    '<div class="form-group"><label>Perfil inicial</label><select id="uPerfil"><option value="manager">Gerente</option><option value="operator" selected>Operador</option><option value="cashier">Caixa</option><option value="accountant">Contabilista</option></select></div>'+
    '<p class="text-muted">Será gerado um código único válido por 72 horas. O colaborador cria a própria senha e confirma o email. O convite associa-o a esta empresa, sem criar uma empresa nova.</p>'+
    '<button class="btn btn-primary btn-block" onclick="salvarUsuario()">Gerar convite</button>');
}
function defaultTeamPermissions() { return {}; }
async function salvarUsuario() {
  if (!TEAM_INVITATIONS_ENABLED) { toast('Não é seguro gerar convites antes da correcção do backend.', 'warning'); return; }
  if (!podeAcessar('usuarios')) { toast('Somente o administrador pode criar utilizadores.', 'error'); return; }
  const name = $('uNome').value.trim();
  const email = $('uEmail').value.trim();
  const role = $('uPerfil').value;
  if (!name || !email) { toast('Preencha nome e email', 'warning'); return; }
  try {
    const invitation = await KanawaCloud.createTeamInvitation({ fullName: name, email: email, role: role, permissions: defaultTeamPermissions(role) });
    openModal('Convite criado', '<p>Envie este código ao colaborador. Ele deve abrir “Tenho um convite”, usar o mesmo email e criar a própria senha.</p>' +
      '<div class="form-group"><label>Código de convite</label><input id="teamInvitationCode" readonly value="' + esc(invitation.invitation_code) + '"></div>' +
      '<button class="btn btn-primary btn-block" onclick="copiarCodigoConvite()">Copiar código</button>');
    toast('Convite criado. Expira em 72 horas.', 'success');
  } catch (error) {
    toast('Não foi possível criar o convite: ' + (error.message || 'erro'), 'error');
  }
}
async function copiarCodigoConvite() {
  const input = $('teamInvitationCode');
  if (!input) return;
  try { await navigator.clipboard.writeText(input.value); toast('Código copiado.', 'success'); }
  catch (error) { input.focus(); input.select(); toast('Selecione e copie o código manualmente.', 'info'); }
}
async function alterarAcessoMembro(userId, status) {
  const member = (await KanawaCloud.listTeamMembers()).find(x => x.user_id === userId);
  if (!member) { toast('Membro não encontrado.','error'); return; }
  const roleInput = $('teamRole_'+userId);
  const role = roleInput ? roleInput.value : member.role;
  try {
    await KanawaCloud.updateTeamMemberAccess({
      userId:userId, role:role, status:String(status||member.status).trim(),
      permissions:member.permissions || defaultTeamPermissions(role)
    });
    toast('Acesso actualizado.','success');
    openModule('usuarios');
  } catch (error) { toast('Não foi possível actualizar o acesso: '+(error.message||'erro'),'error'); }
}
async function toggleInviteSignup() {
  const panel = $('inviteSignupPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

/* ====== AUDITORIA ====== */
async function renderAuditoria() {
  if (!podeAcessar('auditoria')) return '<div class="card"><h3>Sem permissão</h3></div>';
  const a = await getData('auditoria');
  const rows = a.slice(-100).reverse().map(x => [fmtDT(x.data), esc(x.usuario || '-'), badge(x.acao, 'info'), esc(x.modulo), '<small>' + esc((JSON.stringify(x.detalhes) || '').slice(0, 60)) + '...</small>']);
  return header('Auditoria', a.length + ' registros', 'var(--purple)', '', 'fa-history') + '<div class="card">' + table(['Data', 'Usuário', 'Ação', 'Módulo', 'Detalhes'], rows) + '</div>';
}
async function registrarAuditoria(acao, modulo, detalhes) { const u = JSON.parse(localStorage.getItem('kanawa_user') || '{}'); await saveData('auditoria', { acao, modulo, detalhes, usuario: u.nome || 'Admin', data: now() }); }

/* ====== MÓDULOS ====== */
async function renderModulos() {
  const context = window.KanawaCloud && KanawaCloud.context || {};
  const role = String(context.membership && context.membership.role || '').toLowerCase();
  if (!(context.isPlatformAdmin || role==='owner' || role==='admin')) {
    return header('Módulos','Gestão reservada ao administrador','var(--purple)','','fa-toggle-on')+
      '<div class="card"><h3>Sem permissão</h3><p>Apenas o proprietário ou administrador pode activar e desactivar módulos da empresa.</p></div>';
  }
  let settings = [];
  try { settings = await KanawaCloud.listCompanyModules(); } catch (error) {
    return header('Módulos','Activação por empresa','var(--purple)','','fa-toggle-on')+
      '<div class="card"><h3>Não foi possível carregar os módulos</h3><p>'+esc(error.message||'Erro de ligação')+'</p></div>';
  }
  const state = Object.assign({},context.companyModules||{});
  settings.forEach(row => { state[row.module_id] = row.enabled; });
  const groups = MENU_GROUPS.map(group => {
    const rows = group.items.map(item => {
      const enabled = state[item.id] !== false;
      return '<div class="module-toggle-row"><div class="module-toggle-info"><i class="fas '+item.icon+'"></i><span><strong>'+esc(item.label)+'</strong><small>'+esc(item.id)+'</small></span></div>'+
        '<button class="btn btn-sm '+(enabled?'btn-success':'btn-secondary')+'" onclick="alterarEstadoModulo(\''+esc(item.id)+'\','+(!enabled)+')">'+
        (enabled?'Activado':'Desactivado')+'</button></div>';
    }).join('');
    return '<div class="card module-group-card"><h3><i class="fas '+group.icon+'"></i> '+esc(group.label)+'</h3>'+rows+'</div>';
  }).join('');
  return header('Módulos da empresa',MENU.length+' módulos configuráveis','var(--purple)','','fa-toggle-on')+
    '<div class="card"><p>Desactivar um módulo bloqueia o acesso dos colaboradores. O administrador mantém acesso a esta página para o poder reactivar.</p></div>'+
    '<div class="module-groups-grid">'+groups+'</div>';
}
/* ====== CONFIGURAÇÕES ====== */
async function renderConfig() {
  if (!podeAcessar('config')) return '<div class="card"><h3>Sem permissão</h3></div>';
  await carregarConfigEmpresa();
  await carregarConfigFatura();
  const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const regras = JSON.parse(localStorage.getItem('kanawa_regras') || '{}');
  const logoPreview = (emp.logo && emp.logo.indexOf('data:') === 0) ? emp.logo : 'logo.png';
  const counts = {};
  for (const s of DB.stores) { try { counts[s] = await DB.count(s); } catch (e) { counts[s] = 0; } }
  const countRows = Object.entries(counts).map(([k, v]) => ['<code>' + k + '</code>', badge(v, 'info'), '<button class="btn btn-sm btn-danger" onclick="limparColecao(\'' + k + '\')"><i class="fas fa-trash"></i></button>']);
  return header('Configurações', 'Definições completas do sistema', 'var(--primary)', '', 'fa-cog') +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-building"></i> Dados da Empresa</h3></div>' +
    '<div class="form-grid">' +
    '<div class="form-group full"><label>Nome da Firma / Razão Social *</label><input id="cfgFirma" value="' + esc(emp.firma || emp.nome || '') + '" placeholder="Ex: KANAWA SOFT, LDA"></div>' +
    '<div class="form-group full"><label>Nome Comercial (opcional)</label><input id="cfgNome" value="' + esc(emp.nome || '') + '" placeholder="Ex: Kanawa Soft"></div>' +
    '<div class="form-group"><label>NIF *</label><input id="cfgNif" value="' + esc(emp.nif || '') + '"></div>' +
    '<div class="form-group"><label>Nº Alvará</label><input id="cfgAlvara" value="' + esc(emp.alvara || '') + '"></div>' +
    '<div class="form-group"><label>Regime Fiscal</label><select id="cfgRegime"><option value="geral" ' + (emp.regime === 'geral' ? 'selected' : '') + '>Geral (IVA 14%)</option><option value="simplificado" ' + (emp.regime === 'simplificado' ? 'selected' : '') + '>Simplificado (7%)</option><option value="isento" ' + (emp.regime === 'isento' ? 'selected' : '') + '>Isento</option></select></div>' +
    '<div class="form-group"><label>Sector principal da empresa</label><select id="cfgSector">' +
    '<option value="comercio" '+(emp.sector==='comercio'?'selected':'')+'>Comércio geral / retalho</option>' +
    '<option value="farmacia" '+(emp.sector==='farmacia'?'selected':'')+'>Farmácia / saúde</option>' +
    '<option value="restauracao" '+(emp.sector==='restauracao'?'selected':'')+'>Cantina / restauração</option>' +
    '<option value="servicos_tecnicos" '+(emp.sector==='servicos_tecnicos'?'selected':'')+'>Serviços técnicos / manutenção</option>' +
    '<option value="industria" '+(emp.sector==='industria'?'selected':'')+'>Indústria / produção</option>' +
    '<option value="construcao" '+(emp.sector==='construcao'?'selected':'')+'>Construção / obras</option>' +
    '<option value="logistica" '+(emp.sector==='logistica'?'selected':'')+'>Logística / transporte</option>' +
    '<option value="educacao" '+(emp.sector==='educacao'?'selected':'')+'>Educação / formação</option>' +
    '<option value="hotelaria" '+(emp.sector==='hotelaria'?'selected':'')+'>Hotelaria / alojamento</option>' +
    '<option value="agricultura" '+(emp.sector==='agricultura'?'selected':'')+'>Agricultura / agropecuária</option>' +
    '<option value="outro" '+(emp.sector==='outro'?'selected':'')+'>Outra actividade</option></select></div>' +
    '<div class="form-group"><label>Telefone</label><input id="cfgTel" value="' + esc(emp.telefone || '') + '"></div>' +
    '<div class="form-group"><label>Email</label><input id="cfgEmail" value="' + esc(emp.email || '') + '"></div>' +
    '<div class="form-group full"><label>Endereço Completo</label><input id="cfgEnd" value="' + esc(emp.endereco || '') + '"></div>' +
    '<div class="form-group"><label>Website</label><input id="cfgSite" value="' + esc(emp.website || '') + '"></div>' +
    '<div class="form-group"><label>Banco</label><input id="cfgBanco" value="' + esc(emp.banco || '') + '"></div>' +
    '<div class="form-group full"><label>IBAN</label><input id="cfgIban" value="' + esc(emp.iban || '') + '"></div>' +
    '<div class="form-group full"><label>🖼️ Logo da Empresa (usado na fatura)</label>' +
    '<div class="image-picker" onclick="document.getElementById(\'cfgLogoInput\').click()" style="height:160px">' +
    '<div class="placeholder" id="cfgLogoPlaceholder" style="' + (emp.logo && emp.logo.indexOf('data:') === 0 ? 'display:none' : '') + '"><i class="fas fa-image"></i><span style="font-size:.85rem">Clique para escolher a imagem</span></div>' +
    '<img id="cfgLogoPreview" src="' + logoPreview + '" style="' + (emp.logo && emp.logo.indexOf('data:') === 0 ? '' : 'display:none') + '" onerror="this.style.display=\'none\'"></div>' +
    '<input type="file" id="cfgLogoInput" accept="image/*" style="display:none" onchange="escolherLogoEmpresa(this)">' +
    '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn btn-sm btn-secondary" type="button" onclick="document.getElementById(\'cfgLogoInput\').click()"><i class="fas fa-folder-open"></i> Escolher imagem</button>' +
    '<button class="btn btn-sm btn-danger" type="button" onclick="removerLogoEmpresa()"><i class="fas fa-undo"></i> Restaurar logo.png</button></div></div></div>' +
    '<button class="btn btn-success btn-lg" style="margin-top:16px" onclick="salvarConfigEmpresa()"><i class="fas fa-save"></i> Salvar Empresa</button></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-mobile-alt"></i> Acesso por SMS</h3></div>' +
    '<p style="color:var(--text-muted);margin-bottom:12px">Associe e confirme o telefone da empresa na sua conta de acesso. Depois da confirmação, poderá entrar com código SMS.</p>' +
    '<div class="form-group"><label>Telefone internacional</label><input id="cfgSmsPhone" type="tel" value="' + esc(emp.telefone || '') + '" placeholder="+244923000000"></div>' +
    '<button class="btn btn-primary" type="button" onclick="solicitarVerificacaoSMS()"><i class="fas fa-paper-plane"></i> Enviar código SMS</button>' +
    '<div class="form-group" style="margin-top:14px"><label>Código recebido por SMS</label><input id="cfgSmsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div>' +
    '<button class="btn btn-success" type="button" onclick="confirmarTelefoneSMS()"><i class="fas fa-check"></i> Confirmar telefone</button></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-sliders-h"></i> Regras do Sistema</h3></div>' +
    '<div class="form-grid">' +
    '<div class="form-group"><label><input type="checkbox" id="cfgAplicarIVA" ' + (regras.aplicarIVA !== false ? 'checked' : '') + '> Aplicar IVA automaticamente</label></div>' +
    '<div class="form-group"><label><input type="checkbox" id="cfgAplicarIRT" ' + (regras.aplicarIRT ? 'checked' : '') + '> Calcular IRT</label></div>' +
    '<div class="form-group"><label><input type="checkbox" id="cfgControlarEstoque" ' + (regras.controlarEstoque !== false ? 'checked' : '') + '> Controlar estoque</label></div>' +
    '<div class="form-group"><label><input type="checkbox" id="cfgEmitirFatura" ' + (regras.emitirFatura !== false ? 'checked' : '') + '> Emitir fatura</label></div>' +
    '<div class="form-group"><label><input type="checkbox" id="cfgCredito" ' + (regras.credito !== false ? 'checked' : '') + '> Permitir crédito</label></div>' +
    '<div class="form-group"><label><input type="checkbox" id="cfgGavetaAuto" ' + (localStorage.getItem('kanawa_gaveta_auto') !== 'false' ? 'checked' : '') + '> Abrir gaveta automaticamente</label></div>' +
    '<div class="form-group"><label>Estoque Mínimo Padrão</label><input type="number" id="cfgEstMin" value="' + (regras.estoqueMin || 10) + '"></div>' +
    '<div class="form-group"><label>Desconto Máximo (%)</label><input type="number" id="cfgDescMax" value="' + (regras.descontoMax || 50) + '"></div></div>' +
    '<button class="btn btn-success btn-lg" style="margin-top:16px" onclick="salvarRegras()"><i class="fas fa-save"></i> Salvar Regras</button></div>' +
    renderInvoiceSettingsCard() +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-server"></i> Ligação e armazenamento</h3></div>' +
    '<p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px">Os dados são guardados no serviço central da plataforma e sincronizados com o armazenamento local para permitir trabalho temporário sem internet.</p>' +
    '<div class="form-grid">' +
    '<div class="form-group full"><label>Serviço de dados</label><input value="Ligação gerida pela plataforma Kanawa Soft" disabled></div>' +
    '<div class="form-group"><label>Status</label><div style="padding:10px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + (API_ONLINE ? '#4ade80' : '#f87171') + ';margin-right:6px"></span>' + (API_ONLINE ? 'Conectado' : 'Desconectado') + '</div></div></div>' +
    '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">' +
    '<span style="font-size:.8rem;color:var(--text-muted);padding:10px">Ligação configurada pela D.PEDRO SOLUÇÕES</span>' +
    '<button class="btn btn-primary" onclick="testarAPI()"><i class="fas fa-check"></i> Testar</button>' +
    '<button class="btn btn-info" onclick="syncNow(true)"><i class="fas fa-sync"></i> Sincronizar Agora</button></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-database"></i> Armazenamento local e central</h3></div>' + table(['Coleção', 'Registros', 'Ações'], countRows) + '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-tools"></i> Ferramentas</h3></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn btn-warning" onclick="recarregarDemo()"><i class="fas fa-seedling"></i> Dados Demo</button>' +
    '<button class="btn btn-info" onclick="exportarBackupCompleto()"><i class="fas fa-download"></i> Backup</button>' +
    '<button class="btn btn-danger" onclick="resetTotal()"><i class="fas fa-bomb"></i> Reset Total</button></div></div>';
}
async function solicitarVerificacaoSMS() {
  const phone = $('cfgSmsPhone').value.trim();
  try {
    if (!window.KanawaCloud || !KanawaCloud.ready) throw new Error('Entre primeiro na sua conta Kanawa Soft por email.');
    await KanawaCloud.requestPhoneChange(phone);
    $('cfgSmsPhone').readOnly = true;
    toast('Código enviado por SMS. Introduza-o para confirmar o telefone.', 'success');
  } catch (error) {
    toast(error.message || 'Não foi possível enviar o código SMS.', 'danger');
  }
}
async function confirmarTelefoneSMS() {
  const phone = $('cfgSmsPhone').value.trim();
  const code = $('cfgSmsCode').value.trim();
  try {
    if (!window.KanawaCloud || !KanawaCloud.ready) throw new Error('Entre primeiro na sua conta Kanawa Soft por email.');
    const ctx = await KanawaCloud.verifyPhoneChange(phone, code);
    try { await KanawaCloud.updateCompany({ telefone: phone }); }
    catch (companyError) { console.warn('Telefone Auth confirmado; atualização do cadastro da empresa requer perfil de administrador.', companyError); }
    const emp = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
    emp.telefone = phone;
    localStorage.setItem('kanawa_empresa', JSON.stringify(emp));
    $('cfgTel').value = phone;
    $('cfgSmsPhone').readOnly = false;
    $('cfgSmsCode').value = '';
    toast('Telefone confirmado. O acesso por SMS está associado à sua conta.', 'success');
  } catch (error) {
    toast(error.message || 'Não foi possível confirmar o telefone.', 'danger');
  }
}
function renderInvoiceSettingsCard() {
  const c = window.KanawaInvoiceTemplates ? KanawaInvoiceTemplates.getSettings() : {};
  return '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-file-invoice"></i> Modelos de faturação e aparência</h3></div>' +
    '<p style="color:var(--text-muted);font-size:.84rem;margin-bottom:14px">Escolha o modelo, as cores e os elementos comerciais. Os valores da fatura são sempre carregados da venda e do cadastro da empresa.</p>' +
    '<div class="form-grid">' +
    '<div class="form-group"><label>Modelo de fatura</label><select id="cfgInvoiceTemplate"><option value="classic" '+(c.template==='classic'?'selected':'')+'>Clássico profissional</option><option value="modern" '+(c.template==='modern'?'selected':'')+'>Moderno empresarial</option><option value="minimal" '+(c.template==='minimal'?'selected':'')+'>Minimalista</option></select></div>' +
    '<div class="form-group"><label>Cor principal da interface/documento</label><input id="cfgUiPrimary" type="color" value="'+(c.primary||'#1a3a5c')+'"></div>' +
    '<div class="form-group"><label>Cor secundária</label><input id="cfgUiAccent" type="color" value="'+(c.accent||'#217346')+'"></div>' +
    '<div class="form-group"><label><input id="cfgInvoiceQr" type="checkbox" '+(c.showQr===true?'checked':'')+'> Incluir QR de referência do documento (não é QR de validação AGT)</label></div>' +
    '<div class="form-group"><label><input id="cfgInvoiceBank" type="checkbox" '+(c.showBank!==false?'checked':'')+'> Mostrar banco e IBAN na fatura</label></div>' +
    '<div class="form-group full"><label>Termos e condições comerciais da empresa</label><textarea id="cfgInvoiceTerms" rows="4" placeholder="Ex.: Condições de pagamento, garantia, devoluções e contactos">'+String(c.customTerms||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</textarea></div>' +
    '</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-success" onclick="salvarConfigFatura()"><i class="fas fa-save"></i> Guardar modelo e cores</button><button class="btn btn-secondary" onclick="previewConfigFatura()"><i class="fas fa-eye"></i> Pré-visualizar</button></div>' +
    '<p style="font-size:.75rem;color:var(--text-muted);margin-top:10px">A secção de validação fiscal só será apresentada quando existir integração fiscal confirmada pelo servidor. Nenhuma menção de certificação ou QR AGT será impressa antes disso.</p></div>';
}
function aplicarTemaPersonalizado() {
  try {
    const c=JSON.parse(localStorage.getItem('kanawa_fatura_config')||'{}');
    if(/^#[0-9a-f]{6}$/i.test(c.primary||'')) {
      document.documentElement.style.setProperty('--primary',c.primary);
      document.documentElement.style.setProperty('--primary-dark',c.primary);
      document.documentElement.style.setProperty('--primary-light',c.primary);
    }
    if(/^#[0-9a-f]{6}$/i.test(c.accent||'')) {
      document.documentElement.style.setProperty('--secondary',c.accent);
      document.documentElement.style.setProperty('--secondary-light',c.accent);
    }
  } catch (_) {}
}
async function carregarConfigFatura() {
  try {
    const rows=await getData('configuracoesFatura');
    const saved=(rows||[]).find(x=>x.id==='invoice-config');
    if(saved) {
      const config={template:saved.template,primary:saved.primary,accent:saved.accent,showQr:saved.showQr===true,showBank:saved.showBank!==false,customTerms:saved.customTerms||''};
      localStorage.setItem('kanawa_fatura_config',JSON.stringify(config));
      aplicarTemaPersonalizado();
    }
  } catch(error) { console.warn('Configuração de fatura ainda não sincronizada:',error); }
}
async function salvarConfigFatura() {
  const c={template:$('cfgInvoiceTemplate').value,primary:$('cfgUiPrimary').value,accent:$('cfgUiAccent').value,showQr:$('cfgInvoiceQr').checked,showBank:$('cfgInvoiceBank').checked,customTerms:$('cfgInvoiceTerms').value};
  localStorage.setItem('kanawa_fatura_config',JSON.stringify(c));
  aplicarTemaPersonalizado();
  try { await saveData('configuracoesFatura',Object.assign({id:'invoice-config'},c)); toast('Modelo de faturação e cores guardados na empresa.','success'); }
  catch(error) { toast('Guardado neste dispositivo; sincronização pendente.','warning'); }
}
function previewConfigFatura() {
  const c={template:$('cfgInvoiceTemplate').value,primary:$('cfgUiPrimary').value,accent:$('cfgUiAccent').value,showQr:$('cfgInvoiceQr').checked,showBank:$('cfgInvoiceBank').checked,customTerms:$('cfgInvoiceTerms').value};
  const emp=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
  const demo={numeroFatura:'PRÉ-VISUALIZAÇÃO',data:new Date().toISOString(),clienteNome:'Cliente de demonstração',clienteNif:'',clienteTelefone:'',operador:'Administrador',pagamento:'Transferência',status:'Exemplo',itens:[{nome:'Produto de exemplo',qty:2,preco:5000,subtotal:10000}],subtotal:10000,descontoValor:0,iva:1400,total:11400,valorRecebido:11400,troco:0};
  const markup=window.KanawaInvoiceTemplates.render(demo,emp,emp.logo||'logo.png',c);
  openModal('Pré-visualização do modelo de fatura','<div style="max-height:70vh;overflow:auto">'+markup+'</div><div style="margin-top:12px;text-align:right"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>',true);
  if(c.showQr) setTimeout(()=>gerarQRCodeFatura(JSON.stringify({document:'PRÉ-VISUALIZAÇÃO',currency:'AOA'})),150);
}
async function carregarConfigEmpresa() {
  try {
    const rows=await getData('empresaConfig');
    const saved=(rows||[]).find(x=>x.id==='company-config');
    if(saved) {
      const local=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
      const merged=Object.assign({},local,saved);
      if(local.logo && String(local.logo).indexOf('data:')===0) merged.logo=local.logo;
      localStorage.setItem('kanawa_empresa',JSON.stringify(merged));
    }
  } catch(error) { console.warn('Cadastro da empresa ainda não sincronizado:',error); }
}
async function salvarConfigEmpresa() {
  const empAtual = JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const logoAtual = empAtual.logo || 'logo.png';
  const logoNovo = localStorage.getItem('kanawa_logo_temp') || logoAtual;
  const e = { firma: $('cfgFirma').value, nome: $('cfgNome').value, nif: $('cfgNif').value, alvara: $('cfgAlvara').value, regime: $('cfgRegime').value, telefone: $('cfgTel').value, email: $('cfgEmail').value, endereco: $('cfgEnd').value, website: $('cfgSite').value, sector: $('cfgSector').value, banco: $('cfgBanco').value, iban: $('cfgIban').value, logo: logoNovo };
  localStorage.setItem('kanawa_empresa', JSON.stringify(e));
  localStorage.removeItem('kanawa_logo_temp');
  const centralReady=!!(window.KanawaCloud&&KanawaCloud.ready);
  try {
    const companyRecord=Object.assign({},e,{id:'company-config'});
    if(companyRecord.logo&&String(companyRecord.logo).indexOf('data:')===0) delete companyRecord.logo;
    await saveData('empresaConfig',companyRecord);
  } catch(error) {
    console.warn('Dados comerciais guardados localmente; sincronização pendente:',error);
  }
  aplicarLogo();
  aplicarTemaPersonalizado();
  if ($('topbarEmpresa')) $('topbarEmpresa').textContent = e.firma || e.nome || 'Kanawa Soft';
  toast(centralReady?'Empresa actualizada e sincronizada.':'Empresa guardada; sincronização pendente.','success');
}
function escolherLogoEmpresa(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Imagem muito grande (máx 2MB)', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const url = e.target.result;
    const prev = $('cfgLogoPreview'); const ph = $('cfgLogoPlaceholder');
    if (prev) { prev.src = url; prev.style.display = 'block'; }
    if (ph) ph.style.display = 'none';
    localStorage.setItem('kanawa_logo_temp', url);
    toast('✅ Logo carregada — clique em Salvar', 'success');
  };
  reader.readAsDataURL(file);
}
function removerLogoEmpresa() {
  localStorage.removeItem('kanawa_logo_temp');
  const prev = $('cfgLogoPreview'); const ph = $('cfgLogoPlaceholder');
  if (prev) { prev.src = 'logo.png'; prev.style.display = 'none'; }
  if (ph) ph.style.display = 'block';
  toast('Logo restaurada para logo.png', 'info');
}
function salvarRegras() {
  const r = { aplicarIVA: $('cfgAplicarIVA').checked, aplicarIRT: $('cfgAplicarIRT').checked, controlarEstoque: $('cfgControlarEstoque').checked, emitirFatura: $('cfgEmitirFatura').checked, credito: $('cfgCredito').checked, estoqueMin: int($('cfgEstMin').value, 10), descontoMax: int($('cfgDescMax').value, 50) };
  localStorage.setItem('kanawa_regras', JSON.stringify(r));
  localStorage.setItem('kanawa_gaveta_auto', $('cfgGavetaAuto').checked ? 'true' : 'false');
  toast('✅ Regras salvas', 'success');
}
function salvarConfigAPI() { toast('A ligação central é gerida automaticamente pelo Kanawa Soft Cloud.', 'info'); }
async function testarAPI() { const ok = await API.checkHealth(); toast(ok ? '✅ Servidor Online' : '❌ Servidor Offline', ok ? 'success' : 'warning'); }
async function limparColecao(s) { if (!confirm('Limpar ' + s + '?')) return; await DB.clear(s); toast('Limpo', 'info'); openModule('config'); }
async function resetTotal() {
  if (!confirm('⚠️ APAGAR TODOS OS DADOS?')) return;
  if (!confirm('Confirme novamente')) return;
  for (const s of DB.stores) { try { await DB.clear(s); } catch (e) { } }
  localStorage.clear();
  location.reload();
}

/* ====== SETUP / AUTH ====== */
function setupNextStep(s) {
  if (setupStep === 1) { const n = $('setupNome').value.trim(); const nif = $('setupNif').value.trim(); if (!n || !nif) { toast('Preencha nome e NIF', 'warning'); return; } }
  if (setupStep === 2) { const n = $('setupAdminNome').value.trim(); const e = $('setupAdminEmail').value.trim(); const p = $('setupAdminSenha').value; if (!n || !e || p.length < 6) { toast('Preencha todos os campos', 'warning'); return; } }
  if (s === 3) { $('setupResumo').innerHTML = '<div><strong>🏢 Empresa:</strong> ' + esc($('setupNome').value) + '</div><div><strong>📋 NIF:</strong> ' + esc($('setupNif').value) + '</div><div><strong>👤 Admin:</strong> ' + esc($('setupAdminNome').value) + '</div>'; }
  const prev = $('setupStep' + setupStep), next = $('setupStep' + s);
  if (prev) prev.style.display = 'none';
  if (next) next.style.display = 'block';
  $$('.setup-step').forEach(el => { const x = parseInt(el.dataset.step); el.classList.toggle('active', x === s); el.classList.toggle('done', x < s); });
  setupStep = s;
}
async function finalizarSetup() {
  const companyName = $('setupNome').value.trim();
  const taxId = $('setupNif').value.trim();
  const fullName = $('setupAdminNome').value.trim();
  const email = $('setupAdminEmail').value.trim();
  const password = $('setupAdminSenha').value;
  if (!companyName || !taxId || !fullName || !email || password.length < 8) {
    toast('Preencha os dados e utilize uma senha com pelo menos 8 caracteres.', 'warning');
    return;
  }

  const company = {
    id: 1, firma: companyName, nome: companyName, nif: taxId,
    regime: $('setupRegime').value, telefone: $('setupTelefone').value,
    email: $('setupEmail').value, endereco: $('setupEndereco').value,
    logo: 'logo.png', dataCriacao: now()
  };
  const localUser = { id: 1, nome: fullName, email: email, perfil: 'admin', role: 'admin', ativo: true, dataCriacao: now() };

  try {
    const result = await KanawaCloud.signUp({
      email: email,
      password: password,
      fullName: fullName,
      phone: $('setupTelefone').value,
      companyName: companyName,
      taxId: taxId,
      taxRegime: $('setupRegime').value,
      selectedPlan: localStorage.getItem('kanawa_selected_plan') || 'trial',
      legalProfile: {
        legal_form:$('setupLegalForm').value, incorporation_date:$('setupIncorporationDate').value,
        commercial_registry_number:$('setupRegistryNumber').value, commercial_registry_date:$('setupRegistryDate').value,
        commercial_entry_number:$('setupEntryNumber').value, registry_office:$('setupRegistryOffice').value,
        commercial_certificate_expires_at:$('setupRegistryExpiry').value,
        owner_identity_number:$('setupOwnerBI').value, owner_nif:$('setupOwnerNIF').value, owner_nationality:$('setupOwnerNationality').value,
        publication_number:$('setupPublicationNumber').value, publication_date:$('setupPublicationDate').value,
        publication_url:$('setupPublicationUrl').value, capital_amount:$('setupCapital').value,
        activity_code:$('setupActivityCode').value, activity_description:$('setupActivityDescription').value,
        alvara_number:$('setupAlvaraNumber').value, alvara_type:$('setupAlvaraType').value,
        alvara_issue_date:$('setupAlvaraIssue').value, alvara_expiry_date:$('setupAlvaraExpiry').value,
        inss_employer_number:$('setupInssNumber').value, registered_address:$('setupEndereco').value,
        province:$('setupProvince').value, municipality:$('setupMunicipality').value, parish:$('setupParish').value
      }
    });

    const existingLocalCompany = await DB.get('empresas', 1);
    const oldNif = String(existingLocalCompany && (existingLocalCompany.nif || existingLocalCompany.tax_id) || '').replace(/\D/g, '');
    const newNif = String(company.nif || '').replace(/\D/g, '');
    const oldName = String(existingLocalCompany && (existingLocalCompany.nome || existingLocalCompany.firma || existingLocalCompany.legal_name) || '').trim().toLowerCase();
    const newName = String(company.nome || company.firma || '').trim().toLowerCase();
    const sameLocalCompany = existingLocalCompany && ((oldNif && newNif && oldNif === newNif) || (!oldNif && !newNif && oldName && oldName === newName));
    if (existingLocalCompany && !sameLocalCompany) {
      for (const store of DB_STORES) if (!KanawaCloud.isLocalOnly(store)) await DB.clear(store);
    }
    localStorage.setItem('kanawa_legacy_company', JSON.stringify(sameLocalCompany ? existingLocalCompany : company));
    await DB.put('empresas', company);
    await DB.put('usuarios', localUser);
    // 1.0 começa sem registos de demonstração; a empresa inicia com os seus próprios dados.

    if (result.session && KanawaCloud.ready) {
      await activateCloudSession(KanawaCloud.context, true);
      mostrarAplicacaoAutenticada(KanawaCloud.context);
      toast('Conta criada e empresa ligada à base de dados central.', 'success');
    } else {
      localStorage.setItem('kanawa_pending_email', email);
      if ($('setupWizard')) $('setupWizard').classList.remove('active');
      if ($('authScreen')) $('authScreen').classList.add('active');
      if ($('loginEmail')) $('loginEmail').value = email;
      toast('Conta criada. Confirme o email recebido e depois entre no Kanawa Soft.', 'success');
    }
  } catch (e) {
    console.error('Erro ao criar conta Kanawa:', e);
    toast('Não foi possível criar a conta: ' + (e.message || 'erro de ligação'), 'error');
  }
}

async function logout() {
  if (!confirm('Sair da conta Kanawa Soft?')) return;
  try { await KanawaCloud.signOut(); } catch (e) { console.warn('Logout:', e); }
  localStorage.removeItem('kanawa_user');
  if ($('app')) $('app').classList.remove('active');
  if ($('authScreen')) $('authScreen').classList.add('active');
}

/* ====== NOTIFICAÇÕES ====== */
async function criarNotificacao(titulo, mensagem, tipo, modulo) {
  const n = { titulo, mensagem, tipo: tipo || 'info', modulo: modulo || null, data: now(), lida: false };
  await saveData('notificacoes', n);
  updateNotifBadge();
  toast(titulo, tipo || 'info');
}
function updateNotifBadge() {
  DB.getAll('notificacoes').then(n => {
    const c = n.filter(x => !x.lida).length;
    const b = $('notifBadge');
    if (b) { b.style.display = c > 0 ? 'inline' : 'none'; b.textContent = c; }
  }).catch(() => { });
}
async function renderNotificacoes() {
  const notifs = await getData('notificacoes');
  const naoLidas = notifs.filter(n => !n.lida).length;
  const rows = notifs.slice().reverse().map(n =>
    '<div style="padding:14px;background:var(--bg);border-radius:10px;margin-bottom:10px;border-left:4px solid var(--' + (n.tipo || 'info') + ');' + (n.lida ? 'opacity:.6' : '') + '">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
    '<div style="flex:1"><div style="font-weight:700">' + esc(n.titulo) + '</div>' +
    '<div style="font-size:.85rem;color:var(--text-muted);margin-top:4px">' + esc(n.mensagem) + '</div>' +
    '<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px">' + fmtDT(n.data) + '</div></div>' +
    (!n.lida ? '<button class="btn btn-sm btn-success" onclick="marcarNotificacaoLida(' + n.id + ')"><i class="fas fa-check"></i></button>' : '') + '</div></div>'
  ).join('');
  return header('Notificações', notifs.length + ' total • ' + naoLidas + ' não lidas', 'var(--primary)',
    '<button class="btn btn-sm" onclick="marcarTodasLidas()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-check-double"></i> Marcar lidas</button>', 'fa-bell') +
    '<div class="card">' + (rows || emptyState('fa-bell-slash', 'Sem notificações')) + '</div>';
}
async function marcarNotificacaoLida(id) { const n = await DB.get('notificacoes', id); if (n) { n.lida = true; await saveData('notificacoes', n); updateNotifBadge(); openModule('notificacoes'); } }
async function marcarTodasLidas() { const all = await DB.getAll('notificacoes'); for (const n of all) { n.lida = true; await DB.put('notificacoes', n); } updateNotifBadge(); openModule('notificacoes'); }

/* ====== EXCLUIR ITEM GENÉRICO ====== */
async function excluirItem(store, id, modulo) {
  if (!confirm('Excluir registro?')) return;
  await deleteData(store, id);
  toast('Excluído', 'info');
  pdvCache.ts = 0;
  openModule(modulo || currentModule);
}

/* ====== MÓDULOS ADICIONAIS INTEGRADOS DO HTML ====== */

/* PRODUÇÃO */
async function renderProducao() {
  const producao = await getData('producao') || [];
  return header('Produção', producao.length + ' itens de produção', 'var(--purple)',
    '<button class="btn btn-success" onclick="abrirModalProducao()"><i class="fas fa-plus"></i> Novo Item</button>', 'fa-industry') +
    '<div class="card">' + table(['Código', 'Nome', 'Tipo', 'Status', 'Ações'],
      producao.map(p => [esc(p.codigo || '-'), '<strong>' + esc(p.nome) + '</strong>', badge(p.tipo || 'acabado', 'info'), badge(p.status === 'ativo' ? 'Ativo' : 'Inativo', p.status === 'ativo' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-primary" onclick="editarProducao(' + p.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'producao\',' + p.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirModalProducao() {
  openModal('Novo Item de Produção',
    '<div class="form-group"><label>Nome *</label><input id="prodNome"></div>' +
    '<div class="form-group"><label>Código</label><input id="prodCodigo" value="PROD-' + Date.now().toString().slice(-6) + '"></div>' +
    '<div class="form-group"><label>Tipo</label><select id="prodTipo"><option value="acabado">Acabado</option><option value="semi_acabado">Semi-acabado</option><option value="materia_prima">Matéria-prima</option></select></div>' +
    '<div class="form-group"><label>Descrição</label><textarea id="prodDesc" rows="2"></textarea></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarProducao()">Salvar</button>');
}
async function salvarProducao() {
  const nome = $('prodNome').value.trim(); if (!nome) { toast('Informe o nome', 'warning'); return; }
  await saveData('producao', { nome, codigo: $('prodCodigo').value, tipo: $('prodTipo').value, descricao: $('prodDesc').value, status: 'ativo', data: now() });
  toast('Item de produção criado', 'success'); closeModal(); openModule('producao');
}
async function editarProducao(id) { const i = await DB.get('producao', id); if (!i) return; const n = prompt('Novo nome:', i.nome); if (n) { i.nome = n; await saveData('producao', i); toast('Atualizado', 'success'); openModule('producao'); } }

/* ORDENS DE PRODUÇÃO */
async function renderOrdensProducao() {
  const ordens = await getData('ordensProducao') || [];
  return header('Ordens de Produção', ordens.length + ' ordens', 'var(--warning)',
    '<button class="btn btn-success" onclick="abrirModalOrdemProducao()"><i class="fas fa-plus"></i> Nova Ordem</button>', 'fa-clipboard-list') +
    '<div class="card">' + table(['Produto', 'Quantidade', 'Data', 'Status', 'Ações'],
      ordens.map(o => ['<strong>' + esc(o.produto || '-') + '</strong>', formatN(o.quantidade || 0), fmtD(o.data), badge(o.status === 'concluida' ? 'Concluída' : o.status === 'em_andamento' ? 'Em Andamento' : 'Pendente', o.status === 'concluida' ? 'success' : o.status === 'em_andamento' ? 'warning' : 'danger'),
      '<button class="btn btn-sm btn-primary" onclick="editarOrdemProducao(' + o.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'ordensProducao\',' + o.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirModalOrdemProducao() {
  openModal('Nova Ordem de Produção',
    '<div class="form-group"><label>Produto *</label><input id="opProduto"></div>' +
    '<div class="form-group"><label>Quantidade *</label><input id="opQtd" type="number" value="1" min="1"></div>' +
    '<div class="form-group"><label>Status</label><select id="opStatus"><option value="pendente">Pendente</option><option value="em_andamento">Em Andamento</option><option value="concluida">Concluída</option></select></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarOrdemProducao()">Salvar</button>');
}
async function salvarOrdemProducao() { const p = $('opProduto').value.trim(); if (!p) { toast('Informe o produto', 'warning'); return; } await saveData('ordensProducao', { produto: p, quantidade: int($('opQtd').value, 1), status: $('opStatus').value, data: now() }); toast('Ordem criada', 'success'); closeModal(); openModule('ordens-producao'); }
async function editarOrdemProducao(id) { const o = await DB.get('ordensProducao', id); if (!o) return; const s = prompt('Status (pendente, em_andamento, concluida):', o.status); if (s) { o.status = s; await saveData('ordensProducao', o); toast('Atualizada', 'success'); openModule('ordens-producao'); } }

/* MRP */
async function renderMRP() {
  const mrp = await getData('mrp') || [];
  return header('MRP - Planejamento', mrp.length + ' planos', 'var(--info)',
    '<button class="btn btn-success" onclick="calcularMRP()"><i class="fas fa-calculator"></i> Calcular MRP</button>', 'fa-cogs') +
    '<div class="card">' + table(['Produto', 'Demanda', 'Estoque', 'Necessidade', 'Status'],
      mrp.map(m => [esc(m.produto || '-'), formatN(m.demanda || 0), formatN(m.estoque || 0), '<strong>' + formatN(m.necessidade || 0) + '</strong>', badge(m.necessidade <= 0 ? 'OK' : 'Comprar', m.necessidade <= 0 ? 'success' : 'warning')])) + '</div>';
}
async function calcularMRP() {
  const produtos = await getData('produtos'); const estoque = await getData('estoque');
  if (produtos.length === 0) { toast('Nenhum produto cadastrado', 'warning'); return; }
  await DB.clear('mrp');
  for (const p of produtos) {
    const e = estoque.find(x => x.produtoId === p.id);
    const demanda = Math.floor(Math.random() * 100) + 10;
    const qtdEstoque = e ? (e.quantidade || 0) : 0;
    await saveData('mrp', { produtoId: p.id, produto: p.nome, demanda, estoque: qtdEstoque, necessidade: Math.max(0, demanda - qtdEstoque) });
  }
  toast('MRP calculado', 'success'); openModule('mrp');
}

/* BOM */
async function renderBOM() {
  const boms = await getData('boms') || [];
  return header('Lista de Materiais (BOM)', boms.length + ' BOMs', 'var(--primary)',
    '<button class="btn btn-success" onclick="abrirModalBOM()"><i class="fas fa-plus"></i> Nova BOM</button>', 'fa-sitemap') +
    '<div class="card">' + table(['Produto', 'Material', 'Quantidade', 'Ações'],
      boms.map(b => ['<strong>' + esc(b.produto || '-') + '</strong>', esc(b.material || '-'), formatN(b.quantidade || 0),
      '<button class="btn btn-sm btn-primary" onclick="editarBOM(' + b.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'boms\',' + b.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirModalBOM() {
  openModal('Nova BOM',
    '<div class="form-group"><label>Produto *</label><input id="bomProduto"></div>' +
    '<div class="form-group"><label>Material *</label><input id="bomMaterial"></div>' +
    '<div class="form-group"><label>Quantidade *</label><input id="bomQtd" type="number" value="1" min="1"></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarBOM()">Salvar</button>');
}
async function salvarBOM() { const p = $('bomProduto').value.trim(); const m = $('bomMaterial').value.trim(); if (!p || !m) { toast('Preencha produto e material', 'warning'); return; } await saveData('boms', { produto: p, material: m, quantidade: int($('bomQtd').value, 1), data: now() }); toast('BOM criada', 'success'); closeModal(); openModule('bom'); }
async function editarBOM(id) { const b = await DB.get('boms', id); if (!b) return; const q = prompt('Nova quantidade:', b.quantidade); if (q) { b.quantidade = parseInt(q); await saveData('boms', b); toast('Atualizada', 'success'); openModule('bom'); } }

/* CUSTOS DE PRODUÇÃO */
async function renderCustosProducao() {
  const custos = await getData('custosProducao') || [];
  const total = custos.reduce((s, c) => s + (c.material || 0) + (c.maoObra || 0) + (c.indireto || 0), 0);
  return header('Custos de Produção', fmt(total) + ' em custos', 'var(--success)',
    '<button class="btn btn-success" onclick="abrirModalCustoProducao()"><i class="fas fa-plus"></i> Novo Custo</button>', 'fa-calculator') +
    '<div class="card">' + table(['Produto', 'Material', 'Mão de Obra', 'Indiretos', 'Total', 'Ações'],
      custos.map(c => { const t = (c.material || 0) + (c.maoObra || 0) + (c.indireto || 0); return ['<strong>' + esc(c.produto || '-') + '</strong>', fmt(c.material || 0), fmt(c.maoObra || 0), fmt(c.indireto || 0), '<strong>' + fmt(t) + '</strong>',
        '<button class="btn btn-sm btn-primary" onclick="editarCustoProducao(' + c.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'custosProducao\',' + c.id + ')"><i class="fas fa-trash"></i></button>']; })) + '</div>';
}
function abrirModalCustoProducao() {
  openModal('Novo Custo de Produção',
    '<div class="form-group"><label>Produto *</label><input id="custoProduto"></div>' +
    '<div class="form-group"><label>Custo de Material (Kz)</label><input id="custoMaterial" type="number" value="0"></div>' +
    '<div class="form-group"><label>Mão de Obra (Kz)</label><input id="custoMaoObra" type="number" value="0"></div>' +
    '<div class="form-group"><label>Custos Indiretos (Kz)</label><input id="custoIndireto" type="number" value="0"></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarCustoProducao()">Salvar</button>');
}
async function salvarCustoProducao() { const p = $('custoProduto').value.trim(); if (!p) { toast('Informe o produto', 'warning'); return; } await saveData('custosProducao', { produto: p, material: num($('custoMaterial').value, 0), maoObra: num($('custoMaoObra').value, 0), indireto: num($('custoIndireto').value, 0), data: now() }); toast('Custo registrado', 'success'); closeModal(); openModule('custos-producao'); }
async function editarCustoProducao(id) { const c = await DB.get('custosProducao', id); if (!c) return; const v = prompt('Novo custo de material:', c.material); if (v !== null) { c.material = parseFloat(v) || 0; await saveData('custosProducao', c); toast('Atualizado', 'success'); openModule('custos-producao'); } }

/* CONTROLE DE QUALIDADE */
async function renderControleQualidade() {
  const q = await getData('controleQualidade') || [];
  const aprovados = q.filter(x => x.resultado === 'aprovado').length;
  const reprovados = q.filter(x => x.resultado === 'reprovado').length;
  return header('Controle de Qualidade', q.length + ' inspeções', 'var(--info)',
    '<button class="btn btn-success" onclick="abrirModalQualidade()"><i class="fas fa-plus"></i> Nova Inspeção</button>', 'fa-check-double') +
    '<div class="metric-grid">' +
    '<div class="metric-card"><div class="label">Total</div><div class="value">' + q.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">Aprovados</div><div class="value">' + aprovados + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--danger)"><div class="label">Reprovados</div><div class="value">' + reprovados + '</div></div></div>' +
    '<div class="card">' + table(['Produto', 'Lote', 'Resultado', 'Data', 'Ações'],
      q.map(x => [esc(x.produto || '-'), esc(x.lote || '-'), badge(x.resultado === 'aprovado' ? 'Aprovado' : x.resultado === 'reprovado' ? 'Reprovado' : 'Pendente', x.resultado === 'aprovado' ? 'success' : x.resultado === 'reprovado' ? 'danger' : 'warning'), fmtD(x.data),
      '<button class="btn btn-sm btn-primary" onclick="editarQualidade(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'controleQualidade\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirModalQualidade() {
  openModal('Nova Inspeção de Qualidade',
    '<div class="form-group"><label>Produto *</label><input id="qualProduto"></div>' +
    '<div class="form-group"><label>Lote</label><input id="qualLote"></div>' +
    '<div class="form-group"><label>Resultado</label><select id="qualResultado"><option value="aprovado">Aprovado</option><option value="reprovado">Reprovado</option><option value="pendente">Pendente</option></select></div>' +
    '<div class="form-group"><label>Observações</label><textarea id="qualObs" rows="2"></textarea></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarQualidade()">Salvar</button>');
}
async function salvarQualidade() { const p = $('qualProduto').value.trim(); if (!p) { toast('Informe o produto', 'warning'); return; } await saveData('controleQualidade', { produto: p, lote: $('qualLote').value, resultado: $('qualResultado').value, obs: $('qualObs').value, data: now() }); toast('Inspeção registrada', 'success'); closeModal(); openModule('controle-qualidade'); }
async function editarQualidade(id) { const i = await DB.get('controleQualidade', id); if (!i) return; const r = prompt('Resultado (aprovado, reprovado, pendente):', i.resultado); if (r) { i.resultado = r; await saveData('controleQualidade', i); toast('Atualizado', 'success'); openModule('controle-qualidade'); } }

/* PLANOS DE PRODUÇÃO */
async function renderPlanosProducao() {
  const planos = await getData('planosProducao') || [];
  return header('Planos de Produção', planos.length + ' planos', 'var(--primary)',
    '<button class="btn btn-success" onclick="abrirModalPlanoProducao()"><i class="fas fa-plus"></i> Novo Plano</button>', 'fa-calendar-alt') +
    '<div class="card">' + table(['Produto', 'Quantidade', 'Período', 'Status', 'Ações'],
      planos.map(p => ['<strong>' + esc(p.produto || '-') + '</strong>', formatN(p.quantidade || 0), esc(p.periodo || '-'), badge(p.status === 'ativo' ? 'Ativo' : p.status === 'concluido' ? 'Concluído' : 'Pendente', p.status === 'ativo' ? 'success' : p.status === 'concluido' ? 'info' : 'warning'),
      '<button class="btn btn-sm btn-primary" onclick="editarPlanoProducao(' + p.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'planosProducao\',' + p.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirModalPlanoProducao() {
  openModal('Novo Plano de Produção',
    '<div class="form-group"><label>Produto *</label><input id="planoProduto"></div>' +
    '<div class="form-group"><label>Quantidade *</label><input id="planoQtd" type="number" value="1" min="1"></div>' +
    '<div class="form-group"><label>Período</label><input id="planoPeriodo" value="' + new Date().toISOString().slice(0, 7) + '"></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarPlanoProducao()">Salvar</button>');
}
async function salvarPlanoProducao() { const p = $('planoProduto').value.trim(); if (!p) { toast('Informe o produto', 'warning'); return; } await saveData('planosProducao', { produto: p, quantidade: int($('planoQtd').value, 1), periodo: $('planoPeriodo').value, status: 'pendente', data: now() }); toast('Plano criado', 'success'); closeModal(); openModule('planos-producao'); }
async function editarPlanoProducao(id) { const p = await DB.get('planosProducao', id); if (!p) return; const s = prompt('Status (pendente, ativo, concluido):', p.status); if (s) { p.status = s; await saveData('planosProducao', p); toast('Atualizado', 'success'); openModule('planos-producao'); } }

/* LOGÍSTICA */
async function renderLogisticaRoteirizacao() {
  const rotas = await getData('roteirizacao') || [];
  return header('Roteirização', rotas.length + ' rotas', 'var(--primary)',
    '<button class="btn btn-success" onclick="abrirModalRota()"><i class="fas fa-plus"></i> Nova Rota</button>' +
    '<button class="btn btn-info" onclick="otimizarRotas()"><i class="fas fa-robot"></i> Otimizar</button>', 'fa-route') +
    '<div class="card">' + table(['Origem', 'Destino', 'Distância', 'Veículo', 'Ações'],
      rotas.map(r => [esc(r.origem || '-'), esc(r.destino || '-'), esc(r.distancia || '-'), esc(r.veiculo || '-'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'roteirizacao\',' + r.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirModalRota() {
  openModal('Nova Rota',
    '<div class="form-group"><label>Origem *</label><input id="rotaOrigem"></div>' +
    '<div class="form-group"><label>Destino *</label><input id="rotaDestino"></div>' +
    '<div class="form-group"><label>Distância</label><input id="rotaDistancia" placeholder="Ex: 15 km"></div>' +
    '<div class="form-group"><label>Veículo</label><input id="rotaVeiculo"></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarRota()">Salvar</button>');
}
async function salvarRota() { const o = $('rotaOrigem').value.trim(); const d = $('rotaDestino').value.trim(); if (!o || !d) { toast('Preencha origem e destino', 'warning'); return; } await saveData('roteirizacao', { origem: o, destino: d, distancia: $('rotaDistancia').value, veiculo: $('rotaVeiculo').value, data: now() }); toast('Rota criada', 'success'); closeModal(); openModule('logistica-roteirizacao'); }
function otimizarRotas() { toast('Rotas otimizadas', 'success'); }

async function renderLogisticaEtiquetas() {
  const etiquetas = await getData('etiquetas') || [];
  return header('Etiquetas', etiquetas.length + ' etiquetas', 'var(--success)',
    '<button class="btn btn-success" onclick="gerarEtiqueta()"><i class="fas fa-plus"></i> Gerar Etiqueta</button>' +
    '<button class="btn btn-primary" onclick="imprimirEtiquetasLote()"><i class="fas fa-print"></i> Imprimir</button>', 'fa-tag') +
    '<div class="card">' + table(['Código', 'Produto', 'Data', 'Ações'],
      etiquetas.map(e => ['<strong>' + esc(e.codigo || '-') + '</strong>', esc(e.produto || '-'), fmtD(e.data),
      '<button class="btn btn-sm btn-primary" onclick="visualizarEtiqueta(' + e.id + ')"><i class="fas fa-eye"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'etiquetas\',' + e.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function gerarEtiqueta() {
  const produto = prompt('Nome do produto:'); if (!produto) return;
  await saveData('etiquetas', { codigo: 'ETQ' + Math.random().toString(36).substr(2, 6).toUpperCase(), produto, data: now() });
  toast('Etiqueta gerada', 'success'); openModule('logistica-etiquetas');
}
function visualizarEtiqueta(id) { toast('Visualizando etiqueta', 'info'); }

function renderLogisticaPicking() {
  return header('Picking', 'Separação de pedidos', 'var(--warning)', '', 'fa-boxes') +
    '<div class="card">' +
    '<div class="form-group"><label>Pedido</label><select id="pickingPedido"><option value="">Selecione um pedido...</option></select></div>' +
    '<div class="form-group"><label>Itens para separar</label><div style="padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);min-height:60px;color:var(--text-muted)">Selecione um pedido</div></div>' +
    '<button class="btn btn-success" onclick="iniciarPicking()"><i class="fas fa-play"></i> Iniciar Picking</button></div>';
}
function iniciarPicking() { toast('Picking iniciado', 'success'); }

async function renderLogisticaArmazens() {
  const armazens = await getData('armazens') || [];
  return header('Armazéns', armazens.length + ' armazéns', 'var(--info)',
    '<button class="btn btn-success" onclick="novoArmazem()"><i class="fas fa-plus"></i> Novo Armazém</button>', 'fa-warehouse') +
    '<div class="card"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">' +
    (armazens.length > 0 ? armazens.map(a => '<div style="background:var(--bg);padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border);text-align:center"><div style="font-size:2rem">🏠</div><h5 style="font-size:.8rem">' + esc(a.nome) + '</h5><p style="font-size:.6rem;color:var(--text-muted)">Capacidade: ' + (a.capacidade || 'N/A') + '</p></div>').join('') : '<div style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum armazém cadastrado</div>') +
    '</div></div>';
}
async function novoArmazem() { const n = prompt('Nome do armazém:'); if (!n) return; await saveData('armazens', { nome: n, data: now() }); toast('Armazém criado', 'success'); openModule('logistica-armazens'); }

function renderLogisticaCrossdocking() {
  return header('Cross-docking', 'Transferência direta', 'var(--primary)', '', 'fa-exchange-alt') +
    '<div class="card"><div class="form-grid">' +
    '<div class="form-group"><label>Produto</label><input id="crossProduto"></div>' +
    '<div class="form-group"><label>Origem</label><input id="crossOrigem" value="Recebimento"></div>' +
    '<div class="form-group"><label>Destino</label><input id="crossDestino" value="Expedição"></div>' +
    '<div class="form-group"><label>Quantidade</label><input id="crossQtd" type="number" value="1" min="1"></div></div>' +
    '<button class="btn btn-success" onclick="realizarCrossdocking()"><i class="fas fa-exchange-alt"></i> Transferir</button></div>';
}
function realizarCrossdocking() { toast('Cross-docking realizado', 'success'); }

async function renderLogisticaRastreio() {
  const rastreios = await getData('rastreios') || [];
  return header('Rastreio', rastreios.length + ' encomendas', 'var(--success)',
    '<button class="btn btn-primary" onclick="buscarRastreio()"><i class="fas fa-search"></i> Buscar</button>', 'fa-map-marked-alt') +
    '<div class="card">' + table(['Código', 'Produto', 'Status', 'Última Atualização'],
      rastreios.map(r => ['<strong>' + esc(r.codigo) + '</strong>', esc(r.produto || '-'), badge(r.status || 'pendente', r.status === 'entregue' ? 'success' : 'warning'), fmtDT(r.ultimaAtualizacao || r.data)])) + '</div>';
}
async function buscarRastreio() {
  const codigo = prompt('Código de rastreio:'); if (!codigo) return;
  await saveData('rastreios', { codigo, produto: 'Produto', status: 'em_transito', ultimaAtualizacao: now() });
  toast('Rastreio adicionado', 'success'); openModule('logistica-rastreio');
}

/* E-COMMERCE AVANÇADO */
async function renderEcommerceVitrine() {
  const produtos = await getData('ecommerceProdutos');
  const prods = produtos.length > 0 ? produtos : await getData('produtos');
  const ativos = prods.filter(p => p.ativo !== false);
  return header('Vitrine Online', ativos.length + ' produtos', 'var(--success)',
    '<button class="btn btn-info" onclick="sincronizarProdutosEcommerce()"><i class="fas fa-sync"></i> Sincronizar</button>', 'fa-store') +
    '<div class="product-grid">' +
    (ativos.length > 0 ? ativos.slice(0, 12).map(p => '<div class="pdv-prod-card" onclick="adicionarAoCarrinhoEcommerce(' + p.id + ')"><div class="img"><img src="' + imgSrc(p) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div><div class="info"><div class="name">' + esc(p.nome) + '</div><div class="price">' + fmt(p.preco) + '</div><div class="stock">' + badge(p.estoque > 0 ? 'Em estoque' : 'Esgotado', p.estoque > 0 ? 'success' : 'danger') + '</div></div></div>').join('') : emptyState('fa-store', 'Nenhum produto na vitrine')) +
    '</div>';
}
async function adicionarAoCarrinhoEcommerce(id) {
  const produto = await DB.get('produtos', id) || await DB.get('ecommerceProdutos', id);
  if (!produto) { toast('Produto não encontrado', 'error'); return; }
  const carrinho = JSON.parse(localStorage.getItem('kanawa_ecommerce_carrinho') || '[]');
  const ex = carrinho.find(i => i.id === id);
  if (ex) ex.quantidade += 1; else carrinho.push({ id: produto.id, nome: produto.nome, preco: produto.preco, quantidade: 1 });
  localStorage.setItem('kanawa_ecommerce_carrinho', JSON.stringify(carrinho));
  toast(produto.nome + ' adicionado ao carrinho', 'success');
}
async function sincronizarProdutosEcommerce() {
  const produtos = await getData('produtos'); await DB.clear('ecommerceProdutos');
  for (const p of produtos) await saveData('ecommerceProdutos', Object.assign({}, p, { ativo: true }));
  toast(produtos.length + ' produtos sincronizados', 'success'); openModule('ecommerce-vitrine');
}
function renderEcommerceCarrinho() {
  const carrinho = JSON.parse(localStorage.getItem('kanawa_ecommerce_carrinho') || '[]');
  const total = carrinho.reduce((s, i) => s + (i.preco * i.quantidade), 0);
  return header('Carrinho', carrinho.length + ' itens', 'var(--warning)',
    '<button class="btn btn-danger" onclick="limparCarrinhoEcommerce()"><i class="fas fa-trash"></i> Limpar</button>', 'fa-shopping-bag') +
    '<div class="card">' +
    (carrinho.length > 0 ? carrinho.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><div><strong>' + esc(i.nome) + '</strong><br><small>' + i.quantidade + ' x ' + fmt(i.preco) + '</small></div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:700">' + fmt(i.preco * i.quantidade) + '</span><button class="btn btn-sm btn-danger" onclick="removerDoCarrinhoEcommerce(' + i.id + ')"><i class="fas fa-trash"></i></button></div></div>').join('') : emptyState('fa-shopping-cart', 'Carrinho vazio')) +
    (carrinho.length > 0 ? '<div style="margin-top:12px;padding-top:12px;border-top:2px solid var(--border);display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;font-size:1.1rem">Total: ' + fmt(total) + '</span><button class="btn btn-success" onclick="finalizarPedidoEcommerce()"><i class="fas fa-check"></i> Finalizar Pedido</button></div>' : '') + '</div>';
}
function removerDoCarrinhoEcommerce(id) { const carrinho = JSON.parse(localStorage.getItem('kanawa_ecommerce_carrinho') || '[]'); localStorage.setItem('kanawa_ecommerce_carrinho', JSON.stringify(carrinho.filter(i => i.id !== id))); toast('Item removido', 'info'); openModule('ecommerce-carrinho'); }
function limparCarrinhoEcommerce() { localStorage.removeItem('kanawa_ecommerce_carrinho'); toast('Carrinho limpo', 'info'); openModule('ecommerce-carrinho'); }
async function finalizarPedidoEcommerce() {
  const carrinho = JSON.parse(localStorage.getItem('kanawa_ecommerce_carrinho') || '[]');
  if (carrinho.length === 0) { toast('Carrinho vazio', 'warning'); return; }
  const total = carrinho.reduce((s, i) => s + (i.preco * i.quantidade), 0);
  const pedido = { cliente: prompt('Nome do cliente:', 'Cliente Anônimo') || 'Cliente Anônimo', itens: carrinho, total, status: 'pendente', data: now() };
  await saveData('ecommercePedidos', pedido);
  localStorage.removeItem('kanawa_ecommerce_carrinho');
  toast('Pedido finalizado: ' + fmt(total), 'success'); openModule('ecommerce-pedidos');
}
async function renderEcommercePedidos() {
  const pedidos = await getData('ecommercePedidos') || [];
  return header('Pedidos E-commerce', pedidos.length + ' pedidos', 'var(--primary)',
    '<button class="btn btn-info" onclick="exportarPedidosEcommerce()"><i class="fas fa-file-export"></i> Exportar</button>', 'fa-truck') +
    '<div class="card">' + table(['#', 'Cliente', 'Itens', 'Total', 'Status', 'Data', 'Ações'],
      pedidos.map(p => ['#' + p.id, esc(p.cliente || '-'), (p.itens || []).length + ' itens', fmt(p.total || 0), badge(p.status === 'entregue' ? 'Entregue' : p.status === 'enviado' ? 'Enviado' : 'Pendente', p.status === 'entregue' ? 'success' : p.status === 'enviado' ? 'info' : 'warning'), fmtD(p.data),
      '<button class="btn btn-sm btn-primary" onclick="detalharPedidoEcommerce(' + p.id + ')"><i class="fas fa-eye"></i></button> <button class="btn btn-sm btn-success" onclick="atualizarStatusPedidoEcommerce(' + p.id + ')"><i class="fas fa-sync"></i></button>'])) + '</div>';
}
async function detalharPedidoEcommerce(id) { const p = await DB.get('ecommercePedidos', id); if (!p) return; alert('Pedido #' + id + '\nCliente: ' + p.cliente + '\nTotal: ' + fmt(p.total) + '\nStatus: ' + p.status); }
async function atualizarStatusPedidoEcommerce(id) { const p = await DB.get('ecommercePedidos', id); if (!p) return; const s = prompt('Status (pendente, enviado, entregue, cancelado):', p.status); if (s) { p.status = s; await saveData('ecommercePedidos', p); toast('Status atualizado', 'success'); openModule('ecommerce-pedidos'); } }
function exportarPedidosEcommerce() { toast('Exportando pedidos...', 'info'); }
function renderEcommercePagamento() {
  return header('Gateway de Pagamento', 'Configure os métodos de pagamento', 'var(--success)', '', 'fa-credit-card') +
    '<div class="card"><div class="payment-methods">' +
    '<div class="payment-method selected"><i class="fas fa-credit-card"></i> Cartão</div>' +
    '<div class="payment-method"><i class="fas fa-money-bill-wave"></i> Dinheiro</div>' +
    '<div class="payment-method"><i class="fas fa-mobile-alt"></i> Mobile Money</div>' +
    '<div class="payment-method"><i class="fas fa-university"></i> Transferência</div></div>' +
    '<div class="form-grid" style="margin-top:12px"><div class="form-group"><label>Banco</label><select><option>BPC</option><option>BIC</option><option>Banco Atlas</option></select></div><div class="form-group"><label>Chave API</label><input type="password" placeholder="Chave de API"></div></div>' +
    '<div class="form-actions"><button class="btn btn-success" onclick="configurarPagamento()"><i class="fas fa-save"></i> Salvar</button><button class="btn btn-primary" onclick="testarPagamento()"><i class="fas fa-check"></i> Testar</button></div></div>';
}
function configurarPagamento() { toast('Gateway configurado', 'success'); }
function testarPagamento() { toast('Teste concluído', 'success'); }
function renderEcommerceRastreio() {
  return header('Rastreio de Encomendas', 'Acompanhe seus pedidos', 'var(--info)',
    '<button class="btn btn-primary" onclick="rastrearEncomenda()"><i class="fas fa-search"></i> Rastrear</button>', 'fa-map-marker-alt') +
    '<div class="card"><div class="form-group"><label>Código de Rastreio</label><div style="display:flex;gap:8px"><input type="text" id="rastreioCodigo" placeholder="Ex: BR123456789" style="flex:1"><button class="btn btn-primary" onclick="rastrearEncomenda()"><i class="fas fa-search"></i></button></div></div></div>' +
    '<div id="rastreioResultado" style="display:none" class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Resultado</h3></div><div id="rastreioConteudo"></div></div>';
}
function rastrearEncomenda() {
  const codigo = $('rastreioCodigo') ? $('rastreioCodigo').value : '';
  if (!codigo) { toast('Informe o código', 'warning'); return; }
  const r = $('rastreioResultado'), c = $('rastreioConteudo');
  if (r && c) { r.style.display = 'block'; c.innerHTML = '<div class="alert alert-info">📦 Rastreio: ' + esc(codigo) + '</div><div style="font-size:.8rem">Status: Em trânsito<br>Última atualização: ' + fmtDT(now()) + '</div>'; }
}

/* RH AVANÇADO */
async function renderRHRecrutamento() {
  const vagas = await getData('vagas') || []; const candidatos = await getData('candidatos') || [];
  return header('Recrutamento', vagas.length + ' vagas | ' + candidatos.length + ' candidatos', 'var(--primary)',
    '<button class="btn btn-success" onclick="novaVaga()"><i class="fas fa-plus"></i> Nova Vaga</button>' +
    '<button class="btn btn-info" onclick="novoCandidato()"><i class="fas fa-user-plus"></i> Novo Candidato</button>', 'fa-user-plus') +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-briefcase"></i> Vagas</h3></div>' +
    (vagas.length > 0 ? vagas.map(v => '<div style="padding:6px 0;border-bottom:1px solid var(--border)"><strong>' + esc(v.titulo) + '</strong> - ' + esc(v.departamento || '-') + ' ' + badge(v.status || 'aberta', 'success') + '</div>').join('') : 'Nenhuma vaga') + '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-users"></i> Candidatos</h3></div>' +
    (candidatos.length > 0 ? candidatos.map(c => '<div style="padding:6px 0;border-bottom:1px solid var(--border)"><strong>' + esc(c.nome) + '</strong> - ' + esc(c.vaga || '-') + ' ' + badge(c.status || 'novo', 'info') + '</div>').join('') : 'Nenhum candidato') + '</div></div>';
}
async function novaVaga() { const t = prompt('Título da vaga:'); if (!t) return; await saveData('vagas', { titulo: t, departamento: prompt('Departamento:', 'Geral') || 'Geral', status: 'aberta', data: now() }); toast('Vaga criada', 'success'); openModule('rh-recrutamento'); }
async function novoCandidato() { const n = prompt('Nome do candidato:'); if (!n) return; await saveData('candidatos', { nome: n, vaga: prompt('Vaga:') || 'Não especificada', status: 'novo', data: now() }); toast('Candidato registrado', 'success'); openModule('rh-recrutamento'); }
async function renderRHDesempenho() {
  const d = await getData('desempenhoRH') || [];
  return header('Gestão de Desempenho', d.length + ' avaliações', 'var(--info)',
    '<button class="btn btn-success" onclick="novaAvaliacaoDesempenho()"><i class="fas fa-plus"></i> Nova Avaliação</button>', 'fa-chart-bar') +
    '<div class="card">' + table(['Funcionário', 'Nota', 'Comentário', 'Data', 'Ações'],
      d.map(x => [esc(x.funcionario || '-'), '<strong>' + (x.nota || 0) + '/10</strong>', esc((x.comentario || '-').substring(0, 50)), fmtD(x.data), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'desempenhoRH\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaAvaliacaoDesempenho() { const f = prompt('Nome do funcionário:'); if (!f) return; await saveData('desempenhoRH', { funcionario: f, nota: parseFloat(prompt('Nota (0-10):', '5')) || 5, comentario: prompt('Comentário:') || '', data: now() }); toast('Avaliação registrada', 'success'); openModule('rh-desempenho'); }
async function renderRHBeneficios() {
  const b = await getData('beneficios') || [];
  return header('Benefícios', b.length + ' benefícios', 'var(--success)',
    '<button class="btn btn-success" onclick="novoBeneficio()"><i class="fas fa-plus"></i> Novo Benefício</button>', 'fa-gift') +
    '<div class="card">' + table(['Nome', 'Funcionário', 'Valor', 'Status', 'Ações'],
      b.map(x => ['<strong>' + esc(x.nome) + '</strong>', esc(x.funcionario || '-'), fmt(x.valor || 0), badge(x.ativo !== false ? 'Ativo' : 'Inativo', x.ativo !== false ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-primary" onclick="editarBeneficio(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'beneficios\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoBeneficio() { const n = prompt('Nome do benefício:'); if (!n) return; await saveData('beneficios', { nome: n, funcionario: prompt('Funcionário:', 'Geral') || 'Geral', valor: parseFloat(prompt('Valor (Kz):', '0')) || 0, ativo: true, data: now() }); toast('Benefício criado', 'success'); openModule('rh-beneficios'); }
async function editarBeneficio(id) { const b = await DB.get('beneficios', id); if (!b) return; const v = prompt('Novo valor:', b.valor); if (v !== null) { b.valor = parseFloat(v) || 0; await saveData('beneficios', b); toast('Atualizado', 'success'); openModule('rh-beneficios'); } }
async function renderRHOnboarding() {
  const o = await getData('onboarding') || [];
  return header('Onboarding', o.length + ' processos', 'var(--primary)',
    '<button class="btn btn-success" onclick="novoOnboarding()"><i class="fas fa-plus"></i> Novo Processo</button>', 'fa-user-graduate') +
    '<div class="card">' + table(['Funcionário', 'Etapa', 'Progresso', 'Status', 'Ações'],
      o.map(x => [esc(x.funcionario || '-'), esc(x.etapa || 'Início'), '<div style="background:var(--border);height:6px;border-radius:3px;width:100px;overflow:hidden;display:inline-block;vertical-align:middle"><div style="background:var(--success);height:100%;width:' + (x.progresso || 0) + '%"></div></div> ' + (x.progresso || 0) + '%', badge(x.status === 'concluido' ? 'Concluído' : 'Em Andamento', x.status === 'concluido' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-primary" onclick="editarOnboarding(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'onboarding\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoOnboarding() { const f = prompt('Nome do funcionário:'); if (!f) return; await saveData('onboarding', { funcionario: f, etapa: 'Integração', progresso: 10, status: 'em_andamento', data: now() }); toast('Processo iniciado', 'success'); openModule('rh-onboarding'); }
async function editarOnboarding(id) { const i = await DB.get('onboarding', id); if (!i) return; const p = prompt('Progresso (0-100):', i.progresso); if (p !== null) { i.progresso = parseInt(p) || 0; if (i.progresso >= 100) i.status = 'concluido'; await saveData('onboarding', i); toast('Atualizado', 'success'); openModule('rh-onboarding'); } }
async function renderRHPonto() {
  const p = await getData('pontoDigital') || [];
  return header('Controle de Ponto', p.length + ' registros', 'var(--warning)',
    '<button class="btn btn-success" onclick="registrarPonto()"><i class="fas fa-clock"></i> Registrar Ponto</button>' +
    '<button class="btn btn-info" onclick="relatorioPonto()"><i class="fas fa-file-alt"></i> Relatório</button>', 'fa-clock') +
    '<div class="card">' + table(['Funcionário', 'Data', 'Entrada', 'Saída', 'Horas', 'Ações'],
      p.slice(-10).reverse().map(x => { const e = x.entrada ? new Date('1970-01-01T' + x.entrada) : null; const s = x.saida ? new Date('1970-01-01T' + x.saida) : null; const h = e && s ? ((s - e) / (1000 * 60 * 60)).toFixed(1) : '-'; return [esc(x.funcionario || '-'), fmtD(x.data), esc(x.entrada || '-'), esc(x.saida || '-'), h, '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'pontoDigital\',' + x.id + ')"><i class="fas fa-trash"></i></button>']; })) + '</div>';
}
async function registrarPonto() {
  const f = prompt('Nome do funcionário:'); if (!f) return;
  const a = new Date();
  await saveData('pontoDigital', { funcionario: f, data: a.toISOString().split('T')[0], entrada: a.toTimeString().slice(0, 5), saida: '', dataRegistro: now() });
  toast('Ponto registrado', 'success'); openModule('rh-ponto');
}
function relatorioPonto() { toast('Relatório gerado', 'success'); }
async function renderRHRescisao() {
  const r = await getData('rescisoes') || [];
  return header('Cálculo de Rescisão', r.length + ' cálculos', 'var(--danger)',
    '<button class="btn btn-success" onclick="novaRescisao()"><i class="fas fa-plus"></i> Novo Cálculo</button>', 'fa-file-signature') +
    '<div class="card">' + table(['Funcionário', 'Data Saída', 'Valor', 'Motivo', 'Ações'],
      r.map(x => [esc(x.funcionario || '-'), fmtD(x.dataSaida), fmt(x.valor || 0), esc(x.motivo || '-'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'rescisoes\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaRescisao() { const f = prompt('Nome do funcionário:'); if (!f) return; await saveData('rescisoes', { funcionario: f, dataSaida: prompt('Data de saída (YYYY-MM-DD):') || new Date().toISOString().split('T')[0], valor: parseFloat(prompt('Valor da rescisão:', '0')) || 0, motivo: prompt('Motivo:', 'Demissão') || 'Demissão', data: now() }); toast('Cálculo registrado', 'success'); openModule('rh-rescisao'); }
async function renderRHPlanoCarreira() {
  const p = await getData('planosCarreira') || [];
  return header('Plano de Carreira', p.length + ' planos', 'var(--success)',
    '<button class="btn btn-success" onclick="novoPlanoCarreira()"><i class="fas fa-plus"></i> Novo Plano</button>', 'fa-arrow-up') +
    '<div class="card">' + table(['Funcionário', 'Posição Atual', 'Próximo Passo', 'Previsão', 'Ações'],
      p.map(x => [esc(x.funcionario || '-'), esc(x.posicaoAtual || '-'), esc(x.proximoPasso || '-'), esc(x.previsao || '-'),
      '<button class="btn btn-sm btn-primary" onclick="editarPlanoCarreira(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'planosCarreira\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoPlanoCarreira() { const f = prompt('Nome do funcionário:'); if (!f) return; await saveData('planosCarreira', { funcionario: f, posicaoAtual: prompt('Posição atual:', 'Assistente') || 'Assistente', proximoPasso: prompt('Próximo passo:', 'Analista') || 'Analista', previsao: prompt('Previsão:', '6 meses') || '6 meses', data: now() }); toast('Plano criado', 'success'); openModule('rh-plano-carreira'); }
async function editarPlanoCarreira(id) { const p = await DB.get('planosCarreira', id); if (!p) return; const n = prompt('Novo próximo passo:', p.proximoPasso); if (n) { p.proximoPasso = n; await saveData('planosCarreira', p); toast('Atualizado', 'success'); openModule('rh-plano-carreira'); } }

/* PROJETOS AVANÇADO */
async function renderProjetosTarefas() {
  const t = await getData('tarefas') || [];
  return header('Tarefas', t.length + ' tarefas', 'var(--warning)',
    '<button class="btn btn-success" onclick="novaTarefa()"><i class="fas fa-plus"></i> Nova Tarefa</button>', 'fa-tasks') +
    '<div class="card">' + table(['Título', 'Projeto', 'Status', 'Responsável', 'Ações'],
      t.map(x => ['<strong>' + esc(x.titulo) + '</strong>', esc(x.projeto || '-'), badge(x.status === 'concluida' ? 'Concluída' : x.status === 'em_andamento' ? 'Em Andamento' : 'Pendente', x.status === 'concluida' ? 'success' : x.status === 'em_andamento' ? 'warning' : 'info'), esc(x.responsavel || '-'),
      '<button class="btn btn-sm btn-success" onclick="concluirTarefa(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'tarefas\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaTarefa() { const t = prompt('Título da tarefa:'); if (!t) return; await saveData('tarefas', { titulo: t, projeto: prompt('Projeto:', 'Geral') || 'Geral', status: 'pendente', responsavel: prompt('Responsável:', 'Não definido') || 'Não definido', data: now() }); toast('Tarefa criada', 'success'); openModule('projetos-tarefas'); }
async function renderKanban() {
  const t = await getData('tarefas') || [];
  const stages = ['pendente', 'em_andamento', 'concluida'];
  const labels = { pendente: '📋 Pendente', em_andamento: '🔄 Em Andamento', concluida: '✅ Concluída' };
  return header('Kanban', t.length + ' tarefas', 'var(--primary)', '', 'fa-columns') +
    '<div class="kanban-columns">' + stages.map(s => { const ts = t.filter(x => x.status === s); return '<div class="kanban-column"><h5>' + (labels[s] || s) + ' (' + ts.length + ')</h5>' + (ts.length > 0 ? ts.map(x => '<div class="kanban-card" onclick="detalharTarefa(' + x.id + ')"><div style="font-weight:600;font-size:.75rem">' + esc(x.titulo) + '</div><div style="font-size:.6rem;color:var(--text-muted)">' + esc(x.responsavel || '-') + '</div></div>').join('') : '<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:.6rem">Vazio</div>') + '</div>'; }).join('') + '</div>';
}
async function detalharTarefa(id) { const t = await DB.get('tarefas', id); if (t) toast(t.titulo + ' - ' + (t.responsavel || 'Sem responsável'), 'info'); }
async function renderProjetosGantt() {
  const g = await getData('ganttProjetos') || [];
  return header('Gantt Chart', g.length + ' atividades', 'var(--info)',
    '<button class="btn btn-success" onclick="novaAtividadeGantt()"><i class="fas fa-plus"></i> Nova Atividade</button>', 'fa-chart-bar') +
    '<div class="card">' + table(['Atividade', 'Projeto', 'Início', 'Fim', 'Progresso', 'Ações'],
      g.map(x => ['<strong>' + esc(x.atividade) + '</strong>', esc(x.projeto || '-'), fmtD(x.inicio), fmtD(x.fim), '<div style="background:var(--border);height:6px;border-radius:3px;width:100px;overflow:hidden;display:inline-block;vertical-align:middle"><div style="background:var(--success);height:100%;width:' + (x.progresso || 0) + '%"></div></div> ' + (x.progresso || 0) + '%',
      '<button class="btn btn-sm btn-primary" onclick="editarGantt(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'ganttProjetos\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaAtividadeGantt() { const a = prompt('Nome da atividade:'); if (!a) return; await saveData('ganttProjetos', { atividade: a, projeto: prompt('Projeto:', 'Geral') || 'Geral', inicio: prompt('Data início (YYYY-MM-DD):') || new Date().toISOString().split('T')[0], fim: prompt('Data fim (YYYY-MM-DD):') || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], progresso: parseInt(prompt('Progresso (0-100):', '0')) || 0, data: now() }); toast('Atividade criada', 'success'); openModule('projetos-gantt'); }
async function editarGantt(id) { const g = await DB.get('ganttProjetos', id); if (!g) return; const p = prompt('Novo progresso (0-100):', g.progresso); if (p !== null) { g.progresso = parseInt(p) || 0; await saveData('ganttProjetos', g); toast('Atualizado', 'success'); openModule('projetos-gantt'); } }
function renderProjetosRecursos() {
  return header('Gestão de Recursos', 'Alocação de recursos', 'var(--success)', '', 'fa-users-cog') +
    '<div class="card"><div class="form-grid">' +
    '<div class="form-group"><label>Projeto</label><select id="recursoProjeto"><option value="">Selecione...</option></select></div>' +
    '<div class="form-group"><label>Recurso</label><select id="recursoNome"><option value="">Selecione...</option></select></div>' +
    '<div class="form-group"><label>Horas</label><input type="number" id="recursoHoras" value="0" min="0"></div></div>' +
    '<button class="btn btn-success" onclick="alocarRecurso()"><i class="fas fa-save"></i> Alocar</button></div>';
}
function alocarRecurso() { toast('Recurso alocado', 'success'); }
async function renderProjetosTimesheet() {
  const t = await getData('timesheets') || [];
  return header('Timesheet', t.length + ' registros', 'var(--warning)',
    '<button class="btn btn-success" onclick="novoTimesheet()"><i class="fas fa-plus"></i> Novo Registro</button>', 'fa-clock') +
    '<div class="card">' + table(['Recurso', 'Projeto', 'Horas', 'Data', 'Ações'],
      t.map(x => [esc(x.recurso || '-'), esc(x.projeto || '-'), (x.horas || 0) + 'h', fmtD(x.data), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'timesheets\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoTimesheet() { const r = prompt('Nome do recurso:'); if (!r) return; await saveData('timesheets', { recurso: r, projeto: prompt('Projeto:', 'Geral') || 'Geral', horas: parseFloat(prompt('Horas:', '0')) || 0, data: new Date().toISOString().split('T')[0], dataRegistro: now() }); toast('Timesheet registrado', 'success'); openModule('projetos-timesheet'); }
function renderProjetosCustos() {
  return header('Custo Real vs Planejado', 'Análise de custos', 'var(--danger)', '', 'fa-calculator') +
    '<div class="card"><div class="form-grid">' +
    '<div class="form-group"><label>Projeto</label><select id="custoProjeto"><option value="">Selecione...</option></select></div>' +
    '<div class="form-group"><label>Custo Planejado</label><input type="number" id="custoPlanejado" value="0"></div>' +
    '<div class="form-group"><label>Custo Real</label><input type="number" id="custoReal" value="0"></div></div>' +
    '<button class="btn btn-success" onclick="salvarCustoProjeto()"><i class="fas fa-save"></i> Salvar</button> <button class="btn btn-info" onclick="analisarCustos()"><i class="fas fa-chart-line"></i> Analisar</button></div>';
}
function salvarCustoProjeto() { toast('Custo salvo', 'success'); }
function analisarCustos() { toast('Análise concluída', 'success'); }
function renderProjetosRiscos() {
  return header('Matriz de Riscos', 'Identificação e gestão', 'var(--warning)', '', 'fa-exclamation-triangle') +
    '<div class="card"><div class="form-grid">' +
    '<div class="form-group"><label>Risco</label><input id="riscoDesc" placeholder="Descrição do risco"></div>' +
    '<div class="form-group"><label>Probabilidade</label><select id="riscoProb"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></div>' +
    '<div class="form-group"><label>Impacto</label><select id="riscoImpacto"><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option></select></div>' +
    '<div class="form-group"><label>Estratégia</label><input id="riscoEstrategia" placeholder="Estratégia de mitigação"></div></div>' +
    '<button class="btn btn-success" onclick="salvarRisco()"><i class="fas fa-save"></i> Salvar</button></div>';
}
function salvarRisco() { toast('Risco salvo', 'success'); }

/* ATIVOS AVANÇADO */
async function renderAtivosDepreciacao() {
  const ativos = await getData('ativos') || [];
  return header('Depreciação de Ativos', 'Cálculo de depreciação', 'var(--info)', '', 'fa-chart-line') +
    '<div class="card">' + table(['Ativo', 'Valor Original', 'Depreciação', 'Valor Atual'],
      ativos.map(a => { const anos = Math.floor((new Date() - new Date(a.dataAquisicao)) / (1000 * 60 * 60 * 24 * 365)); const dt = (a.valor || 0) * ((a.depreciacao || 0) / 100) * Math.min(anos, 10); const va = Math.max(0, (a.valor || 0) - dt); return ['<strong>' + esc(a.nome) + '</strong>', fmt(a.valor || 0), (a.depreciacao || 0) + '% ao ano', fmt(va)]; })) + '</div>';
}
async function renderAtivosManutencao() {
  const m=await getData('manutencoes')||[];
  const rows=m.slice().sort((a,b)=>String(b.dataAgendada||b.data||'').localeCompare(String(a.dataAgendada||a.data||''))).map(x=>[
    esc(x.ativo||x.equipamento||'-'),
    esc(x.empresaCliente||x.cliente||'-'),
    esc(x.tecnicoNome||x.tecnico||'-'),
    esc(x.tipoManutencao||'Correctiva'),
    fmtD(x.dataAgendada||x.data),
    fmtD(x.proximaManutencao),
    badge(x.status==='concluida'?'Concluída':(x.status||'Pendente'),x.status==='concluida'?'success':(x.status==='em_curso'?'info':'warning')),
    fmt(x.custo||0),
    '<button class="btn btn-sm btn-primary" onclick="verDetalheManutencao('+x.id+')"><i class="fas fa-eye"></i></button> <button class="btn btn-sm btn-success" onclick="concluirManutencaoAtivo('+x.id+')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'manutencoes\','+x.id+')"><i class="fas fa-trash"></i></button>'
  ]);
  return header('Manutenção e Intervenções',m.length+' registos de manutenção','var(--warning)',
    '<button class="btn btn-success" onclick="novaManutencaoAtivo()"><i class="fas fa-plus"></i> Agendar manutenção</button>','fa-tools')+
    '<div class="card"><p style="color:var(--text-muted);font-size:.84rem;margin-bottom:12px">Registe a empresa atendida, equipamento, técnico responsável, data, relatório, custo e próxima intervenção. O histórico permanece associado ao ativo e ao cliente.</p>'+
    table(['Ativo / Equipamento','Empresa cliente','Técnico','Tipo','Data agendada','Próxima','Estado','Custo','Ações'],rows)+'</div>';
}
async function novaManutencaoAtivo() {
  const [clients,staff]=await Promise.all([getData('clientes'),getData('funcionarios')]);
  const clientOptions=clients.map(c=>'<option value="'+esc(c.nome)+'">'+esc(c.nome)+'</option>').join('');
  const techOptions=staff.map(t=>'<option value="'+esc(t.nome)+'">'+esc(t.nome)+'</option>').join('');
  openModal('Agendar manutenção / intervenção',
    '<div class="form-grid">'+
    '<div class="form-group"><label>Empresa cliente *</label><input id="maintCompany" list="maintClients" placeholder="Nome da empresa atendida"><datalist id="maintClients">'+clients.map(c=>'<option value="'+esc(c.nome)+'">').join('')+'</datalist></div>'+
    '<div class="form-group"><label>Ativo / Equipamento *</label><input id="maintAsset" placeholder="Ex.: CCTV, servidor, viatura, máquina"></div>'+
    '<div class="form-group"><label>Tipo de manutenção</label><select id="maintType"><option>Preventiva</option><option>Correctiva</option><option>Inspecção</option><option>Instalação</option><option>Assistência técnica</option></select></div>'+
    '<div class="form-group"><label>Técnico responsável</label><select id="maintTech"><option value="">Atribuir mais tarde</option>'+techOptions+'</select></div>'+
    '<div class="form-group"><label>Data agendada</label><input id="maintDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
    '<div class="form-group"><label>Próxima manutenção</label><input id="maintNext" type="date"></div>'+
    '<div class="form-group"><label>Custo estimado (Kz)</label><input id="maintCost" type="number" min="0" value="0"></div>'+
    '<div class="form-group"><label>Prioridade</label><select id="maintPriority"><option>Normal</option><option>Alta</option><option>Urgente</option></select></div>'+
    '<div class="form-group full"><label>Problema / trabalho solicitado</label><textarea id="maintDescription" rows="2"></textarea></div>'+
    '<div class="form-group full"><label>Peças / materiais previstos</label><textarea id="maintParts" rows="2"></textarea></div></div>'+
    '<button class="btn btn-success btn-block" onclick="salvarManutencaoAtivo()">Guardar ordem de manutenção</button>',true);
}
async function salvarManutencaoAtivo() {
  const company=$('maintCompany').value.trim(),asset=$('maintAsset').value.trim();
  if(!company||!asset){toast('Indique a empresa cliente e o equipamento.','warning');return;}
  const staff=await getData('funcionarios'),tech=$('maintTech').value;
  const assigned=staff.find(x=>x.nome===tech);
  await saveData('manutencoes',{
    empresaCliente:company,ativo:asset,equipamento:asset,tipoManutencao:$('maintType').value,
    tecnicoNome:tech||'',tecnicoId:assigned?assigned.id:null,
    dataAgendada:$('maintDate').value,proximaManutencao:$('maintNext').value||null,
    custo:num($('maintCost').value,0),prioridade:$('maintPriority').value,
    descricao:$('maintDescription').value,pecasMateriais:$('maintParts').value,
    status:'pendente',dataCriacao:now(),historico:[{evento:'Ordem criada',data:now(),responsavel:(JSON.parse(localStorage.getItem('kanawa_user')||'{}').nome||'Administrador')}]
  });
  toast('Ordem de manutenção registada.','success');closeModal();openModule('ativos-manutencao');
}
async function verDetalheManutencao(id) {
  const m=await DB.get('manutencoes',id);if(!m)return;
  openModal('Histórico da intervenção',
    '<div class="card"><strong>'+esc(m.empresaCliente||m.cliente||'—')+'</strong><p>'+esc(m.ativo||m.equipamento||'—')+'</p>'+
    '<p>Técnico: '+esc(m.tecnicoNome||m.tecnico||'Por atribuir')+'</p><p>Tipo: '+esc(m.tipoManutencao||'—')+'</p>'+
    '<p>Agendada: '+fmtD(m.dataAgendada||m.data)+'</p><p>Concluída: '+fmtD(m.dataConclusao)+'</p>'+
    '<p>Próxima: '+fmtD(m.proximaManutencao)+'</p><p>Custo: '+fmt(m.custo||0)+'</p>'+
    '<p>Descrição: '+esc(m.descricao||'—')+'</p><p>Relatório técnico: '+esc(m.relatorioTecnico||'Ainda não registado')+'</p>'+
    '<p>Peças: '+esc(m.pecasMateriais||'—')+'</p></div>'+
    '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>',true);
}
async function concluirManutencaoAtivo(id) {
  const m=await DB.get('manutencoes',id);if(!m)return;
  const report=prompt('Relatório do técnico / trabalho executado:',m.relatorioTecnico||'');
  if(report===null)return;
  const user=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
  m.status='concluida';m.dataConclusao=now();m.relatorioTecnico=report;
  m.tecnicoNome=m.tecnicoNome||user.nome||'Administrador';
  m.historico=Array.isArray(m.historico)?m.historico:[];
  m.historico.push({evento:'Manutenção concluída',data:now(),responsavel:m.tecnicoNome,relatorio:report});
  await saveData('manutencoes',m);toast('Manutenção concluída e histórico actualizado.','success');openModule('ativos-manutencao');
}
async function renderAtivosGarantia() {
  const g = await getData('garantias') || [];
  return header('Controle de Garantia', g.length + ' garantias', 'var(--success)',
    '<button class="btn btn-success" onclick="novaGarantia()"><i class="fas fa-plus"></i> Nova Garantia</button>', 'fa-shield-alt') +
    '<div class="card">' + table(['Ativo', 'Início', 'Fim', 'Status', 'Ações'],
      g.map(x => { const v = new Date(x.fim) > new Date(); return [esc(x.ativo || '-'), fmtD(x.inicio), fmtD(x.fim), badge(v ? 'Válida' : 'Expirada', v ? 'success' : 'danger'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'garantias\',' + x.id + ')"><i class="fas fa-trash"></i></button>']; })) + '</div>';
}
async function novaGarantia() { const a = prompt('Nome do ativo:'); if (!a) return; await saveData('garantias', { ativo: a, inicio: new Date().toISOString().split('T')[0], fim: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0], data: now() }); toast('Garantia registrada', 'success'); openModule('ativos-garantia'); }

/* FROTA AVANÇADO */
async function renderFrotaManutencao() {
  const m = await getData('manutencoes') || [];
  return header('Manutenção de Frota', m.length + ' ordens', 'var(--warning)',
    '<button class="btn btn-success" onclick="novaManutencaoFrota()"><i class="fas fa-plus"></i> Nova Manutenção</button>', 'fa-tools') +
    '<div class="card">' + table(['Veículo', 'Data', 'Custo', 'Status', 'Ações'],
      m.map(x => [esc(x.veiculo || x.ativo || '-'), fmtD(x.data), fmt(x.custo || 0), badge(x.status === 'concluida' ? 'Concluída' : 'Pendente', x.status === 'concluida' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-success" onclick="concluirManutencaoFrota(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'manutencoes\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaManutencaoFrota() { const v = prompt('Placa do veículo:'); if (!v) return; await saveData('manutencoes', { veiculo: v, data: now(), custo: parseFloat(prompt('Custo:', '0')) || 0, status: 'pendente' }); toast('Manutenção registrada', 'success'); openModule('frota-manutencao'); }
async function concluirManutencaoFrota(id) { const m = await DB.get('manutencoes', id); if (m) { m.status = 'concluida'; await saveData('manutencoes', m); toast('Manutenção concluída', 'success'); openModule('frota-manutencao'); } }
async function renderFrotaRotas() {
  const r = await getData('roteirizacao') || [];
  return header('Rotas', r.length + ' rotas', 'var(--info)',
    '<button class="btn btn-success" onclick="novaRotaFrota()"><i class="fas fa-plus"></i> Nova Rota</button>', 'fa-route') +
    '<div class="card">' + table(['Origem', 'Destino', 'Distância', 'Veículo', 'Ações'],
      r.map(x => [esc(x.origem || '-'), esc(x.destino || '-'), esc(x.distancia || '-'), esc(x.veiculo || '-'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'roteirizacao\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaRotaFrota() { const o = prompt('Origem:'); if (!o) return; await saveData('roteirizacao', { origem: o, destino: prompt('Destino:') || 'Não especificado', distancia: prompt('Distância:', '0 km') || '0 km', veiculo: prompt('Veículo:') || 'Não alocado', data: now() }); toast('Rota criada', 'success'); openModule('frota-rotas'); }
async function renderFrotaGPS() {
  const g = await getData('gpsTracking') || [];
  return header('GPS Tracking', g.length + ' veículos', 'var(--success)',
    '<button class="btn btn-success" onclick="adicionarGPS()"><i class="fas fa-plus"></i> Adicionar</button>', 'fa-satellite') +
    '<div class="card"><div class="gps-map" style="height:300px;background:var(--bg);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text-muted);border:1px solid var(--border)"><div style="text-align:center"><i class="fas fa-map" style="font-size:3rem;opacity:0.3"></i><p style="font-size:.8rem">Mapa de rastreamento GPS</p></div></div></div>' +
    '<div class="card">' + table(['Veículo', 'Latitude', 'Longitude', 'Última Atualização'],
      g.map(x => ['<strong>' + esc(x.veiculo) + '</strong>', esc(x.lat || '-'), esc(x.lng || '-'), fmtDT(x.ultimaAtualizacao)])) + '</div>';
}
async function adicionarGPS() { const v = prompt('Placa do veículo:'); if (!v) return; await saveData('gpsTracking', { veiculo: v, lat: '-8.8391', lng: '13.2894', ultimaAtualizacao: now() }); toast('Veículo adicionado ao GPS', 'success'); openModule('frota-gps'); }
async function renderFrotaCombustivel() {
  const a = await getData('abastecimentos') || [];
  return header('Consumo de Combustível', a.length + ' abastecimentos', 'var(--warning)',
    '<button class="btn btn-success" onclick="novoAbastecimento()"><i class="fas fa-plus"></i> Novo Abastecimento</button>', 'fa-gas-pump') +
    '<div class="card">' + table(['Veículo', 'Data', 'Litros', 'Custo', 'Ações'],
      a.map(x => [esc(x.veiculo || '-'), fmtD(x.data), (x.litros || 0) + 'L', fmt(x.custo || 0), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'abastecimentos\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoAbastecimento() { const v = prompt('Placa do veículo:'); if (!v) return; await saveData('abastecimentos', { veiculo: v, data: now(), litros: parseFloat(prompt('Litros:', '0')) || 0, custo: parseFloat(prompt('Custo:', '0')) || 0 }); toast('Abastecimento registrado', 'success'); openModule('frota-combustivel'); }
function renderFrotaDocumentos() {
  return header('Documentação da Frota', 'Documentos dos veículos', 'var(--primary)', '', 'fa-file-alt') +
    '<div class="card"><div class="form-grid">' +
    '<div class="form-group"><label>Veículo</label><select id="docVeiculo"><option value="">Selecione...</option></select></div>' +
    '<div class="form-group"><label>Tipo</label><select><option>Licenciamento</option><option>Seguro</option><option>Inspeção</option></select></div>' +
    '<div class="form-group"><label>Validade</label><input type="date" id="docValidade"></div></div>' +
    '<button class="btn btn-success" onclick="salvarDocumentoFrota()"><i class="fas fa-save"></i> Salvar</button></div>';
}
function salvarDocumentoFrota() { toast('Documento salvo', 'success'); }
async function renderFrotaMultas() {
  const m = await getData('multas') || [];
  return header('Multas', m.length + ' multas', 'var(--danger)',
    '<button class="btn btn-success" onclick="novaMulta()"><i class="fas fa-plus"></i> Nova Multa</button>', 'fa-exclamation-circle') +
    '<div class="card">' + table(['Veículo', 'Data', 'Valor', 'Status', 'Ações'],
      m.map(x => [esc(x.veiculo || '-'), fmtD(x.data), fmt(x.valor || 0), badge(x.status === 'paga' ? 'Paga' : 'Pendente', x.status === 'paga' ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-success" onclick="pagarMulta(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'multas\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaMulta() { const v = prompt('Placa do veículo:'); if (!v) return; await saveData('multas', { veiculo: v, data: now(), valor: parseFloat(prompt('Valor:', '0')) || 0, status: 'pendente', descricao: prompt('Descrição:') || '' }); toast('Multa registrada', 'success'); openModule('frota-multas'); }
async function pagarMulta(id) { const m = await DB.get('multas', id); if (m) { m.status = 'paga'; await saveData('multas', m); toast('Multa paga', 'success'); openModule('frota-multas'); } }
async function renderFrotaDesempenho() {
  const f = await getData('frotas') || [];
  const ativos = f.filter(x => x.status === 'ativo').length;
  const manut = f.filter(x => x.status === 'manutencao').length;
  return header('Desempenho da Frota', f.length + ' veículos', 'var(--info)',
    '<button class="btn btn-success" onclick="gerarRelatorioFrota()"><i class="fas fa-file-export"></i> Relatório</button>', 'fa-chart-bar') +
    '<div class="metric-grid">' +
    '<div class="metric-card"><div class="label">Veículos Ativos</div><div class="value">' + ativos + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--warning)"><div class="label">Em Manutenção</div><div class="value">' + manut + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">Utilização</div><div class="value">' + (f.length > 0 ? Math.round((ativos / f.length) * 100) : 0) + '%</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Detalhes</h3></div>' +
    (f.length > 0 ? f.map(x => '<div style="padding:6px 0;border-bottom:1px solid var(--border)"><strong>' + esc(x.placa) + '</strong> - ' + esc(x.modelo || '-') + ' ' + badge(x.status || 'ativo', x.status === 'ativo' ? 'success' : 'warning') + '</div>').join('') : 'Nenhum veículo') + '</div>';
}
function gerarRelatorioFrota() { toast('Relatório gerado', 'success'); }

/* OS AVANÇADO */
async function renderOSManutencao() {
  const o = await getData('ordensManutencao') || [];
  return header('Ordens de Manutenção', o.length + ' ordens', 'var(--warning)',
    '<button class="btn btn-success" onclick="novaOrdemManutencao()"><i class="fas fa-plus"></i> Nova Ordem</button>', 'fa-tools') +
    '<div class="card">' + table(['Equipamento', 'Data', 'Status', 'Ações'],
      o.map(x => [esc(x.equipamento || x.veiculo || '-'), fmtD(x.data), badge(x.status === 'concluida' ? 'Concluída' : 'Pendente', x.status === 'concluida' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-success" onclick="concluirOSManutencao(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'ordensManutencao\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaOrdemManutencao() { const e = prompt('Equipamento:'); if (!e) return; await saveData('ordensManutencao', { equipamento: e, data: now(), status: 'pendente', descricao: prompt('Descrição:') || '' }); toast('Ordem criada', 'success'); openModule('os-manutencao'); }
async function concluirOSManutencao(id) { const o = await DB.get('ordensManutencao', id); if (o) { o.status = 'concluida'; await saveData('ordensManutencao', o); toast('Ordem concluída', 'success'); openModule('os-manutencao'); } }
async function renderOSChecklist() {
  const c = await getData('checklistsInspecao') || [];
  return header('Checklist de Inspeção', c.length + ' checklists', 'var(--success)',
    '<button class="btn btn-success" onclick="novoChecklist()"><i class="fas fa-plus"></i> Novo Checklist</button>', 'fa-clipboard-check') +
    '<div class="card">' + table(['Item', 'Data', 'Responsável', 'Status', 'Ações'],
      c.map(x => [esc(x.item || '-'), fmtD(x.data), esc(x.responsavel || '-'), badge(x.status === 'aprovado' ? 'Aprovado' : 'Pendente', x.status === 'aprovado' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-success" onclick="aprovarChecklist(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'checklistsInspecao\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoChecklist() { const i = prompt('Item do checklist:'); if (!i) return; await saveData('checklistsInspecao', { item: i, data: now(), responsavel: prompt('Responsável:') || 'Não definido', status: 'pendente' }); toast('Checklist criado', 'success'); openModule('os-checklist'); }
async function aprovarChecklist(id) { const c = await DB.get('checklistsInspecao', id); if (c) { c.status = 'aprovado'; await saveData('checklistsInspecao', c); toast('Checklist aprovado', 'success'); openModule('os-checklist'); } }
async function renderOSCalendario() {
  const e = await getData('calendarioManutencoes') || [];
  return header('Calendário de Manutenções', e.length + ' eventos', 'var(--info)',
    '<button class="btn btn-success" onclick="novoEventoManutencao()"><i class="fas fa-plus"></i> Novo Evento</button>', 'fa-calendar-alt') +
    '<div class="card">' + table(['Data', 'Equipamento', 'Tipo', 'Status', 'Ações'],
      e.map(x => [fmtD(x.data), esc(x.equipamento || '-'), esc(x.tipo || '-'), badge(x.status === 'concluido' ? 'Concluído' : 'Pendente', x.status === 'concluido' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-success" onclick="concluirEventoManutencao(' + x.id + ')"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'calendarioManutencoes\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoEventoManutencao() { const eq = prompt('Equipamento:'); if (!eq) return; await saveData('calendarioManutencoes', { equipamento: eq, data: prompt('Data (YYYY-MM-DD):') || new Date().toISOString().split('T')[0], tipo: prompt('Tipo:', 'Preventiva') || 'Preventiva', status: 'pendente' }); toast('Evento agendado', 'success'); openModule('os-calendario'); }
async function concluirEventoManutencao(id) { const e = await DB.get('calendarioManutencoes', id); if (e) { e.status = 'concluido'; await saveData('calendarioManutencoes', e); toast('Evento concluído', 'success'); openModule('os-calendario'); } }
async function renderOSTecnicos() {
  const t = await getData('tecnicos') || [];
  return header('Técnicos', t.length + ' técnicos', 'var(--info)',
    '<button class="btn btn-success" onclick="novoTecnico()"><i class="fas fa-plus"></i> Novo Técnico</button>', 'fa-user-cog') +
    '<div class="card">' + table(['Nome', 'Especialidade', 'Telefone', 'Ações'],
      t.map(x => ['<strong>' + esc(x.nome) + '</strong>', esc(x.especialidade || '-'), esc(x.telefone || '-'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'tecnicos\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoTecnico() { const n = prompt('Nome do técnico:'); if (!n) return; await saveData('tecnicos', { nome: n, especialidade: prompt('Especialidade:') || 'Geral', telefone: prompt('Telefone:') || '' }); toast('Técnico cadastrado', 'success'); openModule('os-tecnicos'); }

/* PRODUTOS AVALIAÇÕES */
async function renderProdutosAvaliacoes() {
  const a = await getData('avaliacoes') || [];
  return header('Avaliações', a.length + ' avaliações', 'var(--warning)',
    '<button class="btn btn-success" onclick="novaAvaliacao()"><i class="fas fa-plus"></i> Nova Avaliação</button>', 'fa-star') +
    '<div class="card">' + table(['Produto', 'Cliente', 'Nota', 'Comentário', 'Data', 'Ações'],
      a.map(x => [esc(x.produto || '-'), esc(x.cliente || 'Anônimo'), '⭐'.repeat(x.nota || 0) + ' (' + (x.nota || 0) + ')', esc((x.comentario || '-').substring(0, 50)), fmtD(x.data),
      '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'avaliacoes\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaAvaliacao() { const p = prompt('Produto:'); if (!p) return; await saveData('avaliacoes', { produto: p, cliente: prompt('Cliente:', 'Anônimo') || 'Anônimo', nota: Math.min(5, Math.max(1, parseInt(prompt('Nota (1-5):', '5')) || 5)), comentario: prompt('Comentário:') || '', data: now() }); toast('Avaliação registrada', 'success'); openModule('produtos-avaliacoes'); }

/* TABELAS DE PREÇOS */
async function renderTabelasPrecos() {
  const t = await getData('tabelasPrecos') || [];
  return header('Tabelas de Preços', t.length + ' tabelas', 'var(--primary)',
    '<button class="btn btn-success" onclick="novaTabelaPreco()"><i class="fas fa-plus"></i> Nova Tabela</button>', 'fa-table') +
    '<div class="card">' + table(['Nome', 'Produtos', 'Desconto', 'Status', 'Ações'],
      t.map(x => ['<strong>' + esc(x.nome) + '</strong>', formatN(x.produtos || 0), (x.desconto || 0) + '%', badge(x.ativo !== false ? 'Ativa' : 'Inativa', x.ativo !== false ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-primary" onclick="editarTabelaPreco(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'tabelasPrecos\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaTabelaPreco() { const n = prompt('Nome da tabela:'); if (!n) return; await saveData('tabelasPrecos', { nome: n, desconto: parseFloat(prompt('Desconto (%):', '0')) || 0, ativo: true, data: now() }); toast('Tabela criada', 'success'); openModule('tabelas-precos'); }
async function editarTabelaPreco(id) { const t = await DB.get('tabelasPrecos', id); if (!t) return; const n = prompt('Novo nome:', t.nome); if (n) { t.nome = n; await saveData('tabelasPrecos', t); toast('Atualizada', 'success'); openModule('tabelas-precos'); } }

/* VENDAS CONSIGNADAS */
async function renderVendasConsignadas() {
  const v = await getData('vendasConsignadas') || [];
  return header('Vendas Consignadas', v.length + ' vendas', 'var(--purple)',
    '<button class="btn btn-success" onclick="novaVendaConsignada()"><i class="fas fa-plus"></i> Nova Venda</button>', 'fa-handshake') +
    '<div class="card">' + table(['Cliente', 'Produto', 'Quantidade', 'Valor', 'Status', 'Ações'],
      v.map(x => [esc(x.cliente || '-'), esc(x.produto || '-'), formatN(x.quantidade || 0), fmt(x.valor || 0), badge(x.status === 'finalizada' ? 'Finalizada' : 'Pendente', x.status === 'finalizada' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-primary" onclick="editarVendaConsignada(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'vendasConsignadas\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaVendaConsignada() { const c = prompt('Cliente:'); if (!c) return; await saveData('vendasConsignadas', { cliente: c, produto: prompt('Produto:') || 'Produto', quantidade: parseInt(prompt('Quantidade:', '1')) || 1, valor: parseFloat(prompt('Valor:', '0')) || 0, status: 'pendente', data: now() }); toast('Venda consignada registrada', 'success'); openModule('vendas-consignadas'); }
async function editarVendaConsignada(id) { const v = await DB.get('vendasConsignadas', id); if (!v) return; const s = prompt('Status (pendente, finalizada):', v.status); if (s) { v.status = s; await saveData('vendasConsignadas', v); toast('Atualizada', 'success'); openModule('vendas-consignadas'); } }

/* VENDAS PROMOÇÕES */
async function renderVendasPromocoes() {
  const c = await getData('cupons') || [];
  return header('Promoções e Cupons', c.length + ' cupons', 'var(--warning)',
    '<button class="btn btn-success" onclick="novoCupom()"><i class="fas fa-plus"></i> Novo Cupom</button>' +
    '<button class="btn btn-info" onclick="gerarCupomPromocional()"><i class="fas fa-random"></i> Gerar</button>', 'fa-tags') +
    '<div class="card">' + table(['Código', 'Desconto', 'Tipo', 'Validade', 'Status', 'Ações'],
      c.map(x => { const v = new Date(x.validade) > new Date(); return ['<strong>' + esc(x.codigo) + '</strong>', (x.desconto || 0) + '%', badge(x.tipo || 'geral', 'info'), fmtD(x.validade), badge(v ? 'Válido' : 'Expirado', v ? 'success' : 'danger'),
        '<button class="btn btn-sm btn-primary" onclick="editarCupom(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'cupons\',' + x.id + ')"><i class="fas fa-trash"></i></button>']; })) + '</div>';
}
async function novoCupom() { const c = prompt('Código do cupom:'); if (!c) return; await saveData('cupons', { codigo: c.toUpperCase(), desconto: parseFloat(prompt('Desconto (%):', '10')) || 10, tipo: prompt('Tipo (geral, produto, frete):', 'geral') || 'geral', validade: new Date(Date.now() + 30 * 86400000).toISOString(), data: now() }); toast('Cupom criado', 'success'); openModule('vendas-promocoes'); }
async function gerarCupomPromocional() { const c = 'PROMO' + Math.random().toString(36).substr(2, 4).toUpperCase(); await saveData('cupons', { codigo: c, desconto: Math.floor(Math.random() * 20) + 5, tipo: 'promocional', validade: new Date(Date.now() + 15 * 86400000).toISOString(), data: now() }); toast('Cupom ' + c + ' gerado', 'success'); openModule('vendas-promocoes'); }
async function editarCupom(id) { const c = await DB.get('cupons', id); if (!c) return; const d = prompt('Novo desconto (%):', c.desconto); if (d !== null) { c.desconto = parseFloat(d) || 0; await saveData('cupons', c); toast('Atualizado', 'success'); openModule('vendas-promocoes'); } }

/* CLIENTES FIDELIDADE / CUPONS / PORTAL / SEGMENTAÇÃO */
async function renderClientesFidelidade() {
  const f = await getData('fidelidade') || [];
  return header('Fidelização de Clientes', f.length + ' clientes', 'var(--success)',
    '<button class="btn btn-success" onclick="adicionarClienteFidelidade()"><i class="fas fa-user-plus"></i> Adicionar Cliente</button>', 'fa-star') +
    '<div class="card">' + table(['Cliente', 'Pontos', 'Nível', 'Status', 'Ações'],
      f.map(x => [esc(x.cliente || '-'), '<strong>' + formatN(x.pontos || 0) + '</strong>', badge(x.nivel === 'ouro' ? 'Ouro' : x.nivel === 'prata' ? 'Prata' : 'Bronze', x.nivel === 'ouro' ? 'warning' : x.nivel === 'prata' ? 'info' : 'secondary'), badge(x.ativo !== false ? 'Ativo' : 'Inativo', x.ativo !== false ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-success" onclick="adicionarPontosFidelidade(' + x.id + ')"><i class="fas fa-plus"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'fidelidade\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function adicionarClienteFidelidade() { const c = prompt('Nome do cliente:'); if (!c) return; await saveData('fidelidade', { cliente: c, pontos: 0, nivel: 'bronze', ativo: true, data: now() }); toast('Cliente adicionado', 'success'); openModule('clientes-fidelidade'); }
async function adicionarPontosFidelidade(id) { const f = await DB.get('fidelidade', id); if (!f) return; const p = parseInt(prompt('Pontos a adicionar:', '10')) || 0; f.pontos = (f.pontos || 0) + p; if (f.pontos >= 1000) f.nivel = 'ouro'; else if (f.pontos >= 500) f.nivel = 'prata'; else f.nivel = 'bronze'; await saveData('fidelidade', f); toast('Pontos adicionados', 'success'); openModule('clientes-fidelidade'); }
async function renderClientesCupons() {
  const c = await getData('cupons') || [];
  return header('Cupons para Clientes', c.length + ' cupons', 'var(--warning)',
    '<button class="btn btn-success" onclick="distribuirCupomCliente()"><i class="fas fa-gift"></i> Distribuir Cupom</button>', 'fa-ticket-alt') +
    '<div class="card">' + table(['Código', 'Cliente', 'Desconto', 'Validade', 'Status'],
      c.map(x => { const v = new Date(x.validade) > new Date(); return ['<strong>' + esc(x.codigo) + '</strong>', esc(x.cliente || 'Geral'), (x.desconto || 0) + '%', fmtD(x.validade), badge(v ? 'Válido' : 'Expirado', v ? 'success' : 'danger')]; })) + '</div>';
}
async function distribuirCupomCliente() { const c = prompt('Nome do cliente:'); if (!c) return; const cod = 'CUPOM' + Math.random().toString(36).substr(2, 4).toUpperCase(); await saveData('cupons', { codigo: cod, cliente: c, desconto: parseInt(prompt('Desconto (%):', '10')) || 10, validade: new Date(Date.now() + 30 * 86400000).toISOString(), data: now() }); toast('Cupom distribuído', 'success'); openModule('clientes-cupons'); }
async function renderPortalCliente() {
  const c = await getData('clientes') || [];
  return header('Portal do Cliente', c.length + ' clientes', 'var(--info)',
    '<button class="btn btn-success" onclick="convidarClientePortal()"><i class="fas fa-envelope"></i> Convidar</button>' +
    '<button class="btn btn-primary" onclick="abrirPortalCliente()"><i class="fas fa-external-link-alt"></i> Abrir Portal</button>', 'fa-user-circle') +
    '<div class="card">' + table(['Cliente', 'Email', 'Último Acesso', 'Status'],
      c.slice(0, 10).map(x => [esc(x.nome), esc(x.email || '-'), x.ultimoAcesso ? fmtDT(x.ultimoAcesso) : '-', badge(x.ativo !== false ? 'Ativo' : 'Inativo', x.ativo !== false ? 'success' : 'danger')])) + '</div>';
}
function convidarClientePortal() { toast('Convite enviado', 'success'); }
function abrirPortalCliente() { toast('Abrindo portal...', 'info'); }
async function renderClientesSegmentacao() {
  const s = await getData('segmentacoes') || [];
  return header('Segmentação de Clientes', s.length + ' segmentos', 'var(--purple)',
    '<button class="btn btn-success" onclick="novoSegmento()"><i class="fas fa-plus"></i> Novo Segmento</button>', 'fa-users-cog') +
    '<div class="card">' + table(['Nome', 'Critério', 'Clientes', 'Ações'],
      s.map(x => ['<strong>' + esc(x.nome) + '</strong>', esc(x.criterio || '-'), formatN(x.clientes || 0),
      '<button class="btn btn-sm btn-primary" onclick="editarSegmento(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'segmentacoes\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoSegmento() { const n = prompt('Nome do segmento:'); if (!n) return; await saveData('segmentacoes', { nome: n, criterio: prompt('Critério:', 'Geral') || 'Geral', clientes: 0, data: now() }); toast('Segmento criado', 'success'); openModule('clientes-segmentacao'); }
async function editarSegmento(id) { const s = await DB.get('segmentacoes', id); if (!s) return; const n = prompt('Novo nome:', s.nome); if (n) { s.nome = n; await saveData('segmentacoes', s); toast('Atualizado', 'success'); openModule('clientes-segmentacao'); } }

/* CRM AVANÇADO */
async function renderCRMPipeline() {
  const l = await getData('leads') || [];
  const stages = ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'fechado'];
  const labels = { novo: '🆕 Novo', contato: '📞 Contato', qualificado: '✅ Qualificado', proposta: '📄 Proposta', negociacao: '🤝 Negociação', fechado: '🏆 Fechado' };
  return header('Pipeline de Vendas', l.length + ' leads', 'var(--primary)', '', 'fa-columns') +
    '<div class="kanban-columns">' + stages.map(s => { const ls = l.filter(x => x.status === s); return '<div class="kanban-column"><h5>' + (labels[s] || s) + ' (' + ls.length + ')</h5>' + (ls.length > 0 ? ls.map(x => '<div class="kanban-card" onclick="detalharLead(' + x.id + ')"><div style="font-weight:600;font-size:.75rem">' + esc(x.nome) + '</div><div style="font-size:.6rem;color:var(--text-muted)">' + esc(x.telefone || x.email || '-') + '</div></div>').join('') : '<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:.6rem">Vazio</div>') + '</div>'; }).join('') + '</div>';
}
async function detalharLead(id) { const l = await DB.get('leads', id); if (l) toast(l.nome + ' - ' + (l.telefone || l.email || 'Sem contato'), 'info'); }
async function renderCRMAutomacao() {
  const a = await getData('automacoes') || [];
  return header('Automação CRM', a.length + ' automações', 'var(--info)',
    '<button class="btn btn-success" onclick="novaAutomacaoCRM()"><i class="fas fa-plus"></i> Nova Automação</button>', 'fa-robot') +
    '<div class="card">' + table(['Nome', 'Gatilho', 'Ação', 'Status', 'Ações'],
      a.map(x => ['<strong>' + esc(x.nome) + '</strong>', esc(x.gatilho || '-'), esc(x.acao || '-'), badge(x.ativo !== false ? 'Ativo' : 'Inativo', x.ativo !== false ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-primary" onclick="editarAutomacaoCRM(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'automacoes\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaAutomacaoCRM() { const n = prompt('Nome da automação:'); if (!n) return; await saveData('automacoes', { nome: n, gatilho: prompt('Gatilho:', 'Novo lead') || 'Novo lead', acao: prompt('Ação:', 'Enviar email') || 'Enviar email', ativo: true, data: now() }); toast('Automação criada', 'success'); openModule('crm-automacao'); }
async function editarAutomacaoCRM(id) { const a = await DB.get('automacoes', id); if (!a) return; const n = prompt('Novo nome:', a.nome); if (n) { a.nome = n; await saveData('automacoes', a); toast('Atualizada', 'success'); openModule('crm-automacao'); } }
async function renderCRMScore() {
  const s = await getData('scoreLeads') || [];
  return header('Score de Leads', s.length + ' leads pontuados', 'var(--primary)', '', 'fa-chart-line') +
    '<div class="card">' + table(['Lead', 'Score', 'Nível', 'Status'],
      s.map(x => { const sc = x.score || 0; const n = sc >= 80 ? '🔥 Quente' : sc >= 50 ? '🌤️ Morno' : '❄️ Frio'; return [esc(x.lead || '-'), '<strong>' + sc + '%</strong>', badge(n, sc >= 80 ? 'danger' : sc >= 50 ? 'warning' : 'info'), badge(x.status === 'convertido' ? 'Convertido' : 'Pendente', x.status === 'convertido' ? 'success' : 'secondary')]; })) + '</div>';
}
function renderCRMRemarketing() {
  return header('Remarketing', 'Campanhas de remarketing', 'var(--warning)', '', 'fa-retweet') +
    '<div class="card"><div class="form-group"><label>Segmento</label><select><option>Clientes que abandonaram carrinho</option><option>Clientes inativos há 30 dias</option><option>Clientes com alta pontuação</option><option>Todos os clientes</option></select></div>' +
    '<div class="form-group"><label>Mensagem</label><textarea rows="3" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)">Olá! Temos uma oferta especial para você!</textarea></div>' +
    '<div class="form-actions"><button class="btn btn-success" onclick="executarRemarketing()"><i class="fas fa-play"></i> Executar Campanha</button><button class="btn btn-info" onclick="agendarRemarketing()"><i class="fas fa-clock"></i> Agendar</button></div></div>';
}
function executarRemarketing() { toast('Campanha executada', 'success'); }
function agendarRemarketing() { toast('Campanha agendada', 'success'); }

/* MARKETING */
async function renderMarketingCampanhas() {
  const c = await getData('campanhasMarketing') || [];
  return header('Campanhas de Marketing', c.length + ' campanhas', 'var(--danger)',
    '<button class="btn btn-success" onclick="novaCampanhaMarketing()"><i class="fas fa-plus"></i> Nova Campanha</button>', 'fa-bullhorn') +
    '<div class="card">' + table(['Nome', 'Canal', 'Orçamento', 'Status', 'Ações'],
      c.map(x => ['<strong>' + esc(x.nome) + '</strong>', esc(x.canal || '-'), fmt(x.orcamento || 0), badge(x.status === 'ativa' ? 'Ativa' : 'Pendente', x.status === 'ativa' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-primary" onclick="editarCampanhaMarketing(' + x.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'campanhasMarketing\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novaCampanhaMarketing() { const n = prompt('Nome da campanha:'); if (!n) return; await saveData('campanhasMarketing', { nome: n, canal: prompt('Canal:', 'Email') || 'Email', orcamento: parseFloat(prompt('Orçamento:', '0')) || 0, status: 'pendente', data: now() }); toast('Campanha criada', 'success'); openModule('marketing-campanhas'); }
async function editarCampanhaMarketing(id) { const c = await DB.get('campanhasMarketing', id); if (!c) return; const n = prompt('Novo nome:', c.nome); if (n) { c.nome = n; await saveData('campanhasMarketing', c); toast('Atualizada', 'success'); openModule('marketing-campanhas'); } }
async function renderMarketingAnalise() {
  const c = await getData('campanhasMarketing') || [];
  return header('Análise de Campanhas', c.length + ' campanhas analisadas', 'var(--info)', '', 'fa-chart-pie') +
    '<div class="metric-grid">' +
    '<div class="metric-card"><div class="label">Total Campanhas</div><div class="value">' + c.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">Campanhas Ativas</div><div class="value">' + c.filter(x => x.status === 'ativa').length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--info)"><div class="label">Orçamento Total</div><div class="value">' + fmt(c.reduce((s, x) => s + (x.orcamento || 0), 0)) + '</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Desempenho</h3></div>' +
    '<div style="font-size:.8rem"><div style="padding:4px 0;border-bottom:1px solid var(--border)">📊 ROI Médio: +15%</div>' +
    '<div style="padding:4px 0;border-bottom:1px solid var(--border)">🎯 Taxa de Conversão: 8.5%</div>' +
    '<div style="padding:4px 0">📈 Crescimento: +12%</div></div></div>';
}

/* E-LEARNING */
async function renderElearningCursos() {
  const c = await getData('cursos') || [];
  return header('Cursos', c.length + ' cursos', 'var(--success)',
    '<button class="btn btn-success" onclick="novoCurso()"><i class="fas fa-plus"></i> Novo Curso</button>', 'fa-book') +
    '<div class="card">' + (c.length > 0 ? '<div class="product-grid">' + c.map(x => '<div class="pdv-prod-card"><div style="background:var(--bg);height:100px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);font-size:2rem;color:var(--primary)"><i class="fas fa-graduation-cap"></i></div><div class="info"><div class="name">' + esc(x.nome) + '</div><div style="font-size:.6rem;color:var(--text-muted)">' + (x.modulos || 0) + ' módulos</div><div style="font-size:.6rem;color:var(--text-muted)">' + (x.alunos || 0) + ' alunos</div><div style="margin-top:4px">' + badge(x.status || 'ativo', 'success') + '</div><div style="margin-top:6px;display:flex;gap:4px;justify-content:center"><button class="btn btn-sm btn-primary" onclick="abrirCurso(' + x.id + ')"><i class="fas fa-eye"></i></button><button class="btn btn-sm btn-danger" onclick="excluirItem(\'cursos\',' + x.id + ')"><i class="fas fa-trash"></i></button></div></div></div>').join('') + '</div>' : emptyState('fa-book', 'Nenhum curso cadastrado')) + '</div>';
}
async function novoCurso() { const n = prompt('Nome do curso:'); if (!n) return; await saveData('cursos', { nome: n, descricao: prompt('Descrição:') || '', modulos: 0, alunos: 0, status: 'ativo', data: now() }); toast('Curso criado', 'success'); openModule('elearning-cursos'); }
function abrirCurso(id) { toast('Abrindo curso...', 'info'); }
async function renderElearningCertificacoes() {
  const c = await getData('certificacoes') || [];
  return header('Certificações', c.length + ' certificações', 'var(--warning)',
    '<button class="btn btn-success" onclick="novaCertificacao()"><i class="fas fa-plus"></i> Nova Certificação</button>', 'fa-certificate') +
    '<div class="card">' + table(['Aluno', 'Curso', 'Data', 'Validade', 'Status'],
      c.map(x => { const v = new Date(x.validade) > new Date(); return [esc(x.aluno || '-'), esc(x.curso || '-'), fmtD(x.data), fmtD(x.validade), badge(v ? 'Válida' : 'Expirada', v ? 'success' : 'danger')]; })) + '</div>';
}
async function novaCertificacao() { const a = prompt('Nome do aluno:'); if (!a) return; const c = prompt('Curso:'); if (!c) return; await saveData('certificacoes', { aluno: a, curso: c, data: now(), validade: new Date(Date.now() + 365 * 86400000).toISOString() }); toast('Certificação emitida', 'success'); openModule('elearning-certificacoes'); }
async function renderElearningQuizzes() {
  const q = await getData('quizzes') || [];
  return header('Quizzes', q.length + ' quizzes', 'var(--info)',
    '<button class="btn btn-success" onclick="novoQuiz()"><i class="fas fa-plus"></i> Novo Quiz</button>', 'fa-question-circle') +
    '<div class="card">' + (q.length > 0 ? q.map(x => '<div style="padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:6px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center"><div><strong style="font-size:.8rem">' + esc(x.titulo) + '</strong><div style="font-size:.6rem;color:var(--text-muted)">' + (x.questoes || 0) + ' questões</div></div><div style="display:flex;gap:4px"><button class="btn btn-sm btn-primary" onclick="responderQuiz(' + x.id + ')"><i class="fas fa-play"></i></button><button class="btn btn-sm btn-danger" onclick="excluirItem(\'quizzes\',' + x.id + ')"><i class="fas fa-trash"></i></button></div></div>').join('') : emptyState('fa-question-circle', 'Nenhum quiz disponível')) + '</div>';
}
async function novoQuiz() { const t = prompt('Título do quiz:'); if (!t) return; await saveData('quizzes', { titulo: t, questoes: parseInt(prompt('Número de questões:', '5')) || 5, data: now() }); toast('Quiz criado', 'success'); openModule('elearning-quizzes'); }
function responderQuiz(id) { toast('Iniciando quiz...', 'info'); }
function renderElearningProgresso() {
  return header('Progresso do Aluno', 'Acompanhamento de aprendizado', 'var(--primary)', '', 'fa-chart-line') +
    '<div class="card"><div class="form-grid">' +
    '<div class="form-group"><label>Aluno</label><select id="progressoAluno"><option value="">Todos</option></select></div>' +
    '<div class="form-group"><label>Curso</label><select id="progressoCurso"><option value="">Todos</option></select></div></div>' +
    '<button class="btn btn-primary" onclick="gerarRelatorioProgresso()"><i class="fas fa-chart-bar"></i> Gerar Relatório</button></div>' +
    '<div id="progressoResultado" style="display:none" class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Resultado</h3></div><div id="progressoConteudo"></div></div>';
}
function gerarRelatorioProgresso() { toast('Relatório gerado', 'success'); }
async function renderElearningRelatorios() {
  const c = await getData('cursos') || []; const cert = await getData('certificacoes') || []; const q = await getData('quizzes') || []; const f = await getData('funcionarios') || [];
  return header('Relatórios E-learning', 'Análise de desempenho educacional', 'var(--purple)', '', 'fa-file-alt') +
    '<div class="metric-grid">' +
    '<div class="metric-card"><div class="label">Total Cursos</div><div class="value">' + c.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">Certificações</div><div class="value">' + cert.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--info)"><div class="label">Quizzes</div><div class="value">' + q.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--warning)"><div class="label">Alunos</div><div class="value">' + f.length + '</div></div></div>' +
    '<div class="card"><div class="form-actions">' +
    '<button class="btn btn-success" onclick="exportarRelatorioElearning()"><i class="fas fa-file-export"></i> Exportar Relatório</button>' +
    '<button class="btn btn-info" onclick="gerarGraficoElearning()"><i class="fas fa-chart-pie"></i> Gerar Gráfico</button></div></div>';
}
function exportarRelatorioElearning() { toast('Relatório exportado', 'success'); }
function gerarGraficoElearning() { toast('Gráfico gerado', 'success'); }

/* E-COMMERCE PRODUTOS (catálogo) */
async function renderEcommerceProdutos() {
  const produtos = await getData('produtos');
  return header('Catálogo E-commerce', produtos.length + ' produtos', 'var(--info)',
    '<button class="btn btn-success" onclick="abrirFormProdutoEcommerce()"><i class="fas fa-plus"></i> Novo Produto</button>' +
    '<button class="btn btn-info" onclick="sincronizarProdutosEcommerce()"><i class="fas fa-sync"></i> Sincronizar</button>', 'fa-box') +
    '<div class="card">' + table(['Imagem', 'Nome', 'Preço', 'Estoque', 'Status', 'Ações'],
      produtos.map(p => ['<img src="' + imgSrc(p) + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px" onerror="this.src=\'' + PLACEHOLDER + '\'">', '<strong>' + esc(p.nome) + '</strong>', fmt(p.preco || 0), formatN(p.estoque || 0), badge(p.ativo !== false ? 'Ativo' : 'Inativo', p.ativo !== false ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-primary" onclick="editarProdutoEcommerce(' + p.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirProdutoEcommerce(' + p.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirFormProdutoEcommerce() { openModule('produtos-novo'); }
async function editarProdutoEcommerce(id) { openModule('produtos-editar', { id: id }); }
async function excluirProdutoEcommerce(id) { if (!confirm('Excluir este produto do catálogo?')) return; await deleteData('produtos', id); toast('Produto removido', 'info'); openModule('ecommerce-produtos'); }
async function toggleProdutoEcommerce(id) { const p = await DB.get('produtos', id); if (p) { p.ativo = p.ativo === false ? true : false; await saveData('produtos', p); toast('Status atualizado', 'success'); openModule('ecommerce-produtos'); } }

/* SERVIÇOS */
async function renderServicos() {
  const servicos = await getData('servicos') || [];
  return header('Serviços', servicos.length + ' serviços', 'var(--info)',
    '<button class="btn btn-success" onclick="novoServico()"><i class="fas fa-plus"></i> Novo Serviço</button>', 'fa-concierge-bell') +
    '<div class="card">' + table(['Código', 'Nome', 'Preço', 'Duração', 'Status', 'Ações'],
      servicos.map(s => [esc(s.codigo || '-'), '<strong>' + esc(s.nome) + '</strong>', fmt(s.preco || 0), esc(s.duracao || '-'), badge(s.status === 'ativo' ? 'Ativo' : 'Inativo', s.status === 'ativo' ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-primary" onclick="editarServico(' + s.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'servicos\',' + s.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoServico() { const n = prompt('Nome do serviço:'); if (!n) return; await saveData('servicos', { codigo: 'SRV-' + String(Date.now()).slice(-6), nome: n, descricao: prompt('Descrição:') || '', preco: parseFloat(prompt('Preço:', '0')) || 0, duracao: prompt('Duração:', '1h') || '1h', status: 'ativo' }); toast('Serviço criado', 'success'); openModule('servicos'); }
async function editarServico(id) { const s = await DB.get('servicos', id); if (!s) return; const n = prompt('Novo nome:', s.nome); if (n) { s.nome = n; await saveData('servicos', s); toast('Atualizado', 'success'); openModule('servicos'); } }

/* ====== SEED ====== */
/* ====== INIT ====== */
async function init() {
  try {
    const manifest = { name: 'Kanawa Soft ERP', short_name: 'Kanawa', start_url: '.', display: 'standalone', background_color: '#1a3a5c', theme_color: '#1a3a5c', orientation: 'any', icons: [{ src: 'logo.png', sizes: '192x192', type: 'image/png' }, { src: 'logo.png', sizes: '512x512', type: 'image/png' }] };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestLink = $('pwaManifest'); if (manifestLink) manifestLink.href = URL.createObjectURL(blob);

    await DB.init();
    const theme = localStorage.getItem('kanawa_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = $('themeIcon'); if (themeIcon) themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    aplicarLogo();

    let cloudContext = null;
    try { cloudContext = await KanawaCloud.init(); }
    catch (cloudError) { console.warn('Sessão cloud:', cloudError); }

    const loading = $('loadingScreen');
    if (loading) loading.classList.add('hidden');

    if (cloudContext && KanawaCloud.ready) {
      await activateCloudSession(cloudContext, true);
      mostrarAplicacaoAutenticada(cloudContext);
    } else {
      localStorage.removeItem('kanawa_user');
      if ($('app')) $('app').classList.remove('active');
      if ($('setupWizard')) $('setupWizard').classList.remove('active');
      if (!localStorage.getItem('kanawa_plan_intro_seen_v1')) {
        if ($('planWelcome')) $('planWelcome').classList.add('active');
      } else {
        if ($('authScreen')) $('authScreen').classList.add('active');
        if ($('loginEmail')) $('loginEmail').value = localStorage.getItem('kanawa_pending_email') || '';
      }
    }

    const loginForm = $('loginForm');
    if (loginForm) {
      let otpStep = false;
      const emailInput = $('loginEmail');
      const methodInput = $('loginMethod');
      const identifierLabel = $('loginIdentifierLabel');
      function loginMethod() { return methodInput && methodInput.value === 'sms' ? 'sms' : 'email'; }
      function updateLoginChannel() {
        const sms = loginMethod() === 'sms';
        emailInput.type = sms ? 'tel' : 'email';
        emailInput.autocomplete = sms ? 'tel' : 'email';
        emailInput.placeholder = sms ? '+244923000000' : 'seu@email.com';
        if (identifierLabel) identifierLabel.textContent = sms ? '📱 Telemóvel (formato internacional)' : '📧 Email';
        if (otpHelp) otpHelp.textContent = sms
          ? 'Enviámos um código de utilização única por SMS. Verifique se o número está confirmado na sua conta.'
          : 'Enviámos um código de utilização única para o seu email. Consulte também a pasta de spam.';
        if (!otpStep) emailInput.value = '';
      }
      if (methodInput) methodInput.addEventListener('change', updateLoginChannel);
      const codeInput = $('loginOtpCode');
      if (codeInput) {
        codeInput.minLength = 6;
        codeInput.maxLength = 6;
        codeInput.addEventListener('input', function () {
          const digits = String(codeInput.value || '').replace(/\D/g, '').slice(0, 6);
          if (codeInput.value !== digits) codeInput.value = digits;
          codeInput.setCustomValidity(digits.length === 6 ? '' : 'Introduza os seis dígitos recebidos.');
        });
      }
      const codeGroup = $('otpCodeGroup');
      const otpHelp = $('otpHelp');
      const otpActions = $('otpActions');
      const submit = $('loginSubmit');
      const errorBox = $('loginError');

      function showLoginError(message) {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.classList.add('show');
      }
      function resetOtpStep() {
        otpStep = false;
        emailInput.readOnly = false;
        if (methodInput) methodInput.disabled = false;
        codeInput.value = '';
        codeInput.setCustomValidity('');
        codeInput.required = false;
        codeGroup.style.display = 'none';
        otpHelp.style.display = 'none';
        otpActions.style.display = 'none';
        submit.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar código de acesso';
        if (errorBox) { errorBox.textContent = ''; errorBox.classList.remove('show'); }
      }
      async function sendLoginCode() {
        const method = loginMethod();
        const identifier = emailInput.value.trim();
        if (!identifier || !emailInput.checkValidity()) {
          emailInput.reportValidity();
          return;
        }
        const pendingKey = $('preLoginLicenseKey') && $('preLoginLicenseKey').value.trim();
        if (pendingKey) sessionStorage.setItem('kanawa_pending_license_key', pendingKey);
        await KanawaCloud.requestOtp(identifier, method);
        otpStep = true;
        emailInput.readOnly = true;
        if (methodInput) methodInput.disabled = true;
        codeGroup.style.display = 'block';
        codeInput.required = true;
        otpHelp.style.display = 'block';
        otpActions.style.display = 'flex';
        submit.innerHTML = '<i class="fas fa-unlock-alt"></i> Validar código e entrar';
        codeInput.focus();
        toast('Código de acesso enviado por ' + (method === 'sms' ? 'SMS para ' : 'email para ') + identifier + '.', 'success');
      }

      loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (errorBox) { errorBox.textContent = ''; errorBox.classList.remove('show'); }
        submit.disabled = true;
        const idleLoginLabel = submit.innerHTML;
        submit.setAttribute('aria-busy','true');
        submit.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> A processar acesso...';
        try {
          if (!otpStep) {
            await sendLoginCode();
            return;
          }
          const ctx = await KanawaCloud.verifyOtp(emailInput.value, codeInput.value, loginMethod());
          await activateCloudSession(ctx, true);
          if (loginMethod() === 'email') localStorage.removeItem('kanawa_pending_email');
          mostrarAplicacaoAutenticada(ctx);
          toast('Sessão iniciada. Os seus dados estão disponíveis no espaço de trabalho.', 'success');
        } catch (error) {
          showLoginError(error.message || 'Não foi possível validar o acesso. Verifique o email e o código.');
        } finally {
          submit.disabled = false;
          submit.removeAttribute('aria-busy');
          if (!otpStep) submit.innerHTML = idleLoginLabel;
          else if (submit.innerHTML.indexOf('fa-spinner') !== -1) submit.innerHTML = '<i class="fas fa-unlock-alt"></i> Validar código e entrar';
        }
      });

      const inviteForm = $('inviteSignupForm');
      if (inviteForm) inviteForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!TEAM_INVITATIONS_ENABLED) { showLoginError('A aceitação de convites está temporariamente suspensa até o servidor associar a conta à empresa correcta.'); return; }
        const submit = $('inviteSignupSubmit');
        if (submit) submit.disabled = true;
        try {
          const result = await KanawaCloud.acceptInvitation({
            fullName: $('inviteFullName').value.trim(),
            email: $('inviteEmail').value.trim(),
            invitationCode: $('inviteCode').value.trim(),
            password: $('invitePassword').value
          });
          if (result.session && KanawaCloud.ready) {
            await activateCloudSession(KanawaCloud.context, false);
            mostrarAplicacaoAutenticada(KanawaCloud.context);
            toast('Convite aceite. Acesso à empresa ativado.', 'success');
          } else {
            $('loginEmail').value = $('inviteEmail').value.trim();
            $('inviteSignupPanel').style.display = 'none';
            toast('Conta criada. Confirme o email e depois entre com o código de acesso.', 'success');
          }
        } catch (error) {
          showLoginError(error.message || 'Não foi possível aceitar o convite.');
        } finally {
          if (submit) submit.disabled = false;
        }
      });

      const resendButton = $('resendOtpBtn');
      if (resendButton) resendButton.addEventListener('click', async function () {
        if (resendButton.disabled) return;
        resendButton.disabled = true;
        try {
          await KanawaCloud.requestOtp(emailInput.value, loginMethod());
          toast('Novo código enviado. Utilize o código mais recente.', 'success');
          if (errorBox) { errorBox.textContent = ''; errorBox.classList.remove('show'); }
        } catch (error) {
          showLoginError(error.message || 'Não foi possível reenviar o código.');
        } finally {
          resendButton.disabled = false;
        }
      });

      const changeEmailButton = $('changeOtpEmailBtn');
      if (changeEmailButton) changeEmailButton.addEventListener('click', resetOtpStep);
    }

    aplicarTemaPersonalizado();
    startAutoSync();
  } catch (e) {
    console.error('Init error:', e);
    const loading = $('loadingScreen'); if (loading) loading.classList.add('hidden');
    const errorBox = $('loginError');
    if (errorBox) { errorBox.textContent = 'Erro ao iniciar o Kanawa Soft: ' + e.message; errorBox.classList.add('show'); }
  }
}

/* ====== INTEGRAÇÃO ELECTRON ====== */
if (window.kanawaNative && window.kanawaNative.isDesktop) {
  window.kanawaNative.onMenuNavigate((moduleId) => {
    if (moduleId === '__toggle_theme') { toggleTheme(); return; }
    if (moduleId === '__sync') { syncNow(true); return; }
    if (moduleId && MENU.find(m => m.id === moduleId)) openModule(moduleId);
  });
  if (window.kanawaNative.notifyReady) window.kanawaNative.notifyReady();
}

/* ====== EXPORT GLOBAL ====== */
const EXPORTS = [
  'openModule','toggleMenuGroup','toggleMobileSidebar','closeMobileSidebar','mudarAbaContabilidade','alterarPeriodoContabil','importarPGCAngola','adicionarLinhaLancamento','removerLinhaLancamento','recalcularTotaisLancamento','alterarEstadoModulo','abrirPermissoesMembro','guardarPermissoesMembro','abrirConfiguracaoAGT','guardarConfiguracaoAGT','prepararSAFTAO','guardarRascunhoIVA','guardarRascunhoIRT','abrirDeclaracaoFiscal','closeModal','openModal','toggleTheme','toggleUserMenu','logout','aplicarLogo','setupNextStep','finalizarSetup','abrirCadastroEmpresa','toggleSync','syncNow','mostrarToast','toast','solicitarVerificacaoSMS','confirmarTelefoneSMS',
  'pdvIrParaTela','pdvSelecionarProduto','pdvAltQty','pdvRemoverItem','pdvSalvarCliente','pdvClienteAnonimo','pdvSelecionarPagamento','pdvAtualizarValores','pdvCancelarVenda','pdvSalvarRascunho','pdvSalvarOrcamento','pdvFinalizarVenda','abrirModalPDVCliente','salvarNovoClientePDV','filtrarPDV','toggleFavorito',
  'abrirScanner','fecharScanner','buscarPorCodigo','cadastroRapidoProduto','salvarCadastroRapido',
  'imprimirEtiquetaIndividual','imprimirEtiquetasLote','gerarLoteEtiquetas','imprimirEtiquetaHTML','baixarEtiquetaPDF',
  'abrirFatura','imprimirFatura','imprimirTermica','baixarFaturaPDF','compartilharWhatsApp','gerarQRCodeFatura',
  'abrirModalProduto','salvarProduto','excluirProduto','exportarProdutos','abrirModalImportar','importarProdutos','escolherImagemProduto','removerImagemProduto',
  'abrirModalCategoria','salvarCategoria','editarCategoria','salvarEditCategoria',
  'abrirModalCliente','salvarClienteModal',
  'abrirModalFornecedor','salvarFornecedor',
  'abrirModalTransportadora','salvarTransportadora',
  'abrirModalLead','salvarLead',
  'abrirMovEstoque','salvarMov','ajustarEstoque',
  'abrirModalCompra','salvarCompra',
  'abrirModalConta','salvarConta','marcarPago',
  'exportarSAFTCompleto','exportarIRTDeclaracao','exportarIVADeclaracao','exportarInventario',
  'abrirModalFuncionario','salvarFuncionario',
  'abrirModalProjeto','salvarProjeto',
  'abrirModalTarefa','salvarTarefa','concluirTarefa',
  'abrirModalAtivo','salvarAtivo',
  'abrirModalVeiculo','salvarVeiculo',
  'abrirModalOS','salvarOS',
  'abrirModalContrato','salvarContrato',
  'abrirModalDocumento','salvarDocumento',
  'abrirModalTicket','salvarTicket','resolverTicket',
  'exportarBackupCompleto','exportarVendasCSV',
  'abrirModalUsuario','salvarUsuario',
  'verFatura','excluirItem',
  'abrirModalPromocao','salvarPromocao','togglePublicado',
  'converterOrcamento',
  'criarNotificacao','marcarNotificacaoLida','marcarTodasLidas','updateNotifBadge',
  'salvarConfigEmpresa','salvarRegras','salvarConfigAPI','testarAPI','salvarConfigFatura','previewConfigFatura',
  'limparColecao','recarregarDemo','resetTotal',
  'escolherLogoEmpresa','removerLogoEmpresa',
  'escolherAvatarPerfil','removerAvatarPerfil','salvarPerfil','alterarSenhaPerfil',
  'abrirModalDispositivo','salvarDispositivo','definirPadrao','testarImpressora','abrirGaveta',
  'detectarImpressoras','detectarEDetalhes','numeroPorExtenso',
  // Módulos adicionais
  'renderProducao','abrirModalProducao','salvarProducao','editarProducao',
  'renderOrdensProducao','abrirModalOrdemProducao','salvarOrdemProducao','editarOrdemProducao',
  'renderMRP','calcularMRP',
  'renderBOM','abrirModalBOM','salvarBOM','editarBOM',
  'renderCustosProducao','abrirModalCustoProducao','salvarCustoProducao','editarCustoProducao',
  'renderControleQualidade','abrirModalQualidade','salvarQualidade','editarQualidade',
  'renderPlanosProducao','abrirModalPlanoProducao','salvarPlanoProducao','editarPlanoProducao',
  'renderLogisticaRoteirizacao','abrirModalRota','salvarRota','otimizarRotas',
  'renderLogisticaEtiquetas','gerarEtiqueta','visualizarEtiqueta',
  'renderLogisticaPicking','iniciarPicking','renderLogisticaArmazens','novoArmazem',
  'renderLogisticaCrossdocking','realizarCrossdocking','renderLogisticaRastreio','buscarRastreio',
  'renderEcommerceVitrine','adicionarAoCarrinhoEcommerce','sincronizarProdutosEcommerce',
  'renderEcommerceCarrinho','removerDoCarrinhoEcommerce','limparCarrinhoEcommerce','finalizarPedidoEcommerce',
  'renderEcommercePedidos','detalharPedidoEcommerce','atualizarStatusPedidoEcommerce','exportarPedidosEcommerce',
  'renderEcommercePagamento','configurarPagamento','testarPagamento','renderEcommerceRastreio','rastrearEncomenda',
  'renderRHRecrutamento','novaVaga','novoCandidato','renderRHDesempenho','novaAvaliacaoDesempenho',
  'renderRHBeneficios','novoBeneficio','editarBeneficio','renderRHOnboarding','novoOnboarding','editarOnboarding',
  'renderRHPonto','registrarPonto','relatorioPonto','renderRHRescisao','novaRescisao',
  'renderRHPlanoCarreira','novoPlanoCarreira','editarPlanoCarreira',
  'renderProjetosTarefas','novaTarefa','renderKanban','detalharTarefa',
  'renderProjetosGantt','novaAtividadeGantt','editarGantt','renderProjetosRecursos','alocarRecurso',
  'renderProjetosTimesheet','novoTimesheet','renderProjetosCustos','salvarCustoProjeto','analisarCustos',
  'renderProjetosRiscos','salvarRisco',
  'renderAtivosDepreciacao','renderAtivosManutencao','novaManutencaoAtivo','concluirManutencaoAtivo',
  'renderAtivosGarantia','novaGarantia',
  'renderFrotaManutencao','novaManutencaoFrota','concluirManutencaoFrota','renderFrotaRotas','novaRotaFrota',
  'renderFrotaGPS','adicionarGPS','renderFrotaCombustivel','novoAbastecimento',
  'renderFrotaDocumentos','salvarDocumentoFrota','renderFrotaMultas','novaMulta','pagarMulta',
  'renderFrotaDesempenho','gerarRelatorioFrota',
  'renderOSManutencao','novaOrdemManutencao','concluirOSManutencao','renderOSChecklist','novoChecklist','aprovarChecklist',
  'renderOSCalendario','novoEventoManutencao','concluirEventoManutencao','renderOSTecnicos','novoTecnico',
  'renderProdutosAvaliacoes','novaAvaliacao','renderTabelasPrecos','novaTabelaPreco','editarTabelaPreco',
  'renderVendasConsignadas','novaVendaConsignada','editarVendaConsignada',
  'renderVendasPromocoes','novoCupom','gerarCupomPromocional','editarCupom',
  'renderClientesFidelidade','adicionarClienteFidelidade','adicionarPontosFidelidade',
  'renderClientesCupons','distribuirCupomCliente','renderPortalCliente','convidarClientePortal','abrirPortalCliente',
  'renderClientesSegmentacao','novoSegmento','editarSegmento',
  'renderCRMPipeline','detalharLead','renderCRMAutomacao','novaAutomacaoCRM','editarAutomacaoCRM',
  'renderCRMScore','renderCRMRemarketing','executarRemarketing','agendarRemarketing',
  'renderMarketingCampanhas','novaCampanhaMarketing','editarCampanhaMarketing','renderMarketingAnalise',
  'renderElearningCursos','novoCurso','abrirCurso','renderElearningCertificacoes','novaCertificacao',
  'renderElearningQuizzes','novoQuiz','responderQuiz','renderElearningProgresso','gerarRelatorioProgresso',
  'renderElearningRelatorios','exportarRelatorioElearning','gerarGraficoElearning',
  'renderEcommerceProdutos','abrirFormProdutoEcommerce','editarProdutoEcommerce','excluirProdutoEcommerce','toggleProdutoEcommerce',
  'renderServicos','novoServico','editarServico'
];
EXPORTS.forEach(name => { try { window[name] = eval(name); } catch (e) { } });


let contabilidadeTab='resumo';
let contabilidadeFromDate=new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10);
let contabilidadeToDate=new Date().toISOString().slice(0,10);

function mudarAbaContabilidade(tab) {
  contabilidadeTab=tab;
  openModule('contabilidade');
}
function alterarPeriodoContabil() {
  const from=$('contPeriodoInicio')&&$('contPeriodoInicio').value;
  const to=$('contPeriodoFim')&&$('contPeriodoFim').value;
  if(!from||!to||to<from){toast('Seleccione um período válido.','warning');return;}
  contabilidadeFromDate=from;contabilidadeToDate=to;
  openModule('contabilidade');
}
function renderJournalLineRow(index) {
  return '<div class="journal-line-row" data-journal-row="'+index+'">'+
    '<select data-account class="form-control">'+(window._journalAccountOptions||'')+'</select>'+
    '<input data-debit class="form-control" type="number" min="0" step="0.01" placeholder="Débito (Kz)" oninput="recalcularTotaisLancamento()">'+
    '<input data-credit class="form-control" type="number" min="0" step="0.01" placeholder="Crédito (Kz)" oninput="recalcularTotaisLancamento()">'+
    '<button type="button" class="btn btn-sm btn-danger" onclick="removerLinhaLancamento('+index+')" aria-label="Remover linha"><i class="fas fa-trash"></i></button></div>';
}
function adicionarLinhaLancamento() {
  const host=$('jeLines');if(!host)return;
  const index=window._journalLineSequence||0;window._journalLineSequence=index+1;
  host.insertAdjacentHTML('beforeend',renderJournalLineRow(index));
}
function removerLinhaLancamento(index) {
  const row=$('jeLines')&&$('jeLines').querySelector('[data-journal-row="'+index+'"]');
  if(row)row.remove();
  recalcularTotaisLancamento();
}
function recalcularTotaisLancamento() {
  const rows=Array.from($$(' [data-journal-row]')).filter(row=>row.closest('#jeLines'));
  const debit=rows.reduce((sum,row)=>sum+Number(row.querySelector('[data-debit]').value||0),0);
  const credit=rows.reduce((sum,row)=>sum+Number(row.querySelector('[data-credit]').value||0),0);
  if($('jeTotalDebit'))$('jeTotalDebit').textContent=fmt(debit);
  if($('jeTotalCredit'))$('jeTotalCredit').textContent=fmt(credit);
  if($('jeDifference'))$('jeDifference').textContent=fmt(debit-credit);
}
async function importarPGCAngola() {
  if(!window.KanawaCloud||!KanawaCloud.ready){toast('Ligue a empresa antes de importar o PGC.','warning');return;}
  if(!confirm('Importar o Plano Geral de Contabilidade de Angola? A operação só funciona se a empresa ainda não tiver contas e não apaga dados existentes.'))return;
  try {
    const response=await fetch('data/pgc-angola.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Não foi possível carregar o ficheiro PGC.');
    const dataset=await response.json();
    const result=await KanawaCloud.seedAngolaChartOfAccounts(dataset.accounts||[]);
    toast('Plano PGC importado: '+(result.inserted||0)+' contas.','success');
    contabilidadeTab='contas';openModule('contabilidade');
  } catch(error) { toast(error.message||'Falha ao importar o PGC.','error'); }
}
async function alterarEstadoModulo(moduleId,enabled) {
  try {
    await KanawaCloud.setCompanyModuleEnabled(moduleId,enabled);
    toast('Módulo '+(enabled?'activado':'desactivado')+'.','success');
    renderSidebar();openModule('modulos');
  } catch(error) { toast(error.message||'Não foi possível alterar o módulo.','error'); }
}
async function abrirPermissoesMembro(userId) {
  try {
    const members=await KanawaCloud.listTeamMembers();
    const member=members.find(m=>m.user_id===userId);
    if(!member){toast('Membro não encontrado.','error');return;}
    const role=String(member.role||'operator').toLowerCase();
    const roleKey=({manager:'gerente',gerente:'gerente',accountant:'contabilista',contabilista:'contabilista',cashier:'caixa',caixa:'caixa',operator:'operador',operador:'operador'})[role]||'operador';
    const defaults=PERMISSOES[roleKey].modulos;
    const custom=(member.permissions&&member.permissions.modules)||{};
    const groups=MENU_GROUPS.map(group=>{
      const items=group.items.map(item=>{
        const current=custom[item.id]||{};
        const defaultView=defaults==='*'||defaults.includes(item.id);
        const defaultEdit=roleKey==='gerente'&&defaultView||roleKey==='contabilista'&&['contabilidade','fiscal','financeiro','relatorios','ativos','orcamentos','folha-salarial'].includes(item.id);
        const canView=typeof current.ver==='boolean'?current.ver:defaultView;
        const canEdit=typeof current.editar==='boolean'?current.editar:defaultEdit;
        return '<div class="permission-module-row"><span>'+esc(item.label)+'</span>'+
          '<label><input type="checkbox" data-perm-module="'+esc(item.id)+'" data-perm-action="ver" '+(canView?'checked':'')+'> Aceder</label>'+
          '<label><input type="checkbox" data-perm-module="'+esc(item.id)+'" data-perm-action="editar" '+(canEdit?'checked':'')+'> Editar</label></div>';
      }).join('');
      return '<section class="permission-group"><h4>'+esc(group.label)+'</h4>'+items+'</section>';
    }).join('');
    openModal('Permissões — '+esc(member.full_name||member.email||'Colaborador'),
      '<p class="text-muted">Define o acesso e a edição por módulo. O servidor valida as mesmas permissões nas operações protegidas.</p>'+
      '<div class="permission-groups">'+groups+'</div>'+
      '<button class="btn btn-primary btn-block" onclick="guardarPermissoesMembro(&quot;'+esc(userId)+'&quot;)">Guardar permissões</button>');
  } catch(error) { toast(error.message||'Não foi possível carregar as permissões.','error'); }
}
async function guardarPermissoesMembro(userId) {
  try {
    const members=await KanawaCloud.listTeamMembers();
    const member=members.find(m=>m.user_id===userId);
    if(!member)throw new Error('Membro não encontrado.');
    const modules={};
    Array.from($$('[data-perm-module]')).forEach(input=>{
      const id=input.dataset.permModule,action=input.dataset.permAction;
      modules[id]=modules[id]||{};
      modules[id][action]=input.checked;
    });
    Object.keys(modules).forEach(id=>{
      if(!modules[id].ver)modules[id].editar=false;
      modules[id].criar=!!modules[id].editar;
      modules[id].exportar=!!modules[id].ver;
      modules[id].excluir=false;
    });
    const roleInput=$('teamRole_'+userId);
    await KanawaCloud.updateTeamMemberAccess({
      userId:userId,role:roleInput?roleInput.value:member.role,status:member.status,
      permissions:{modules:modules}
    });
    toast('Permissões guardadas no servidor.','success');
    closeModal();openModule('usuarios');
  } catch(error) { toast(error.message||'Não foi possível guardar as permissões.','error'); }
}
function toggleMobileSidebar(force) {
  const sidebar=$('sidebar'),overlay=$('sidebarOverlay');
  if(!sidebar)return;
  const open=typeof force==='boolean'?force:!sidebar.classList.contains('mobile-open');
  sidebar.classList.toggle('mobile-open',open);
  if(overlay)overlay.classList.toggle('active',open);
  document.body.classList.toggle('menu-open',open);
}
function closeMobileSidebar() { toggleMobileSidebar(false); }


async function guardarRascunhoIVA() {
  try {
    const vendas=await getData('vendas'),compras=await getData('compras');
    const hasSalesVat=vendas.some(v=>v.iva!==undefined&&v.iva!==null||v.ivaTotal!==undefined&&v.ivaTotal!==null||v.valorIVA!==undefined&&v.valorIVA!==null);
    const hasPurchaseVat=compras.some(c=>c.iva!==undefined&&c.iva!==null||c.ivaTotal!==undefined&&c.ivaTotal!==null||c.valorIVA!==undefined&&c.valorIVA!==null);
    if(!hasSalesVat||!hasPurchaseVat){toast('Não é seguro guardar a declaração: falta IVA discriminado nas vendas ou compras.','warning');return;}
    const ivaV=vendas.reduce((sum,v)=>sum+Number(v.iva||v.ivaTotal||v.valorIVA||0),0);
    const ivaC=compras.reduce((sum,c)=>sum+Number(c.iva||c.ivaTotal||c.valorIVA||0),0);
    const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,0);
    const base=vendas.reduce((sum,v)=>sum+Number(v.subtotal||v.total||0)-Number(v.descontoValor||0),0);
    await KanawaCloud.saveTaxReturn({taxType:'IVA',periodStart:start.toISOString().slice(0,10),periodEnd:end.toISOString().slice(0,10),
      taxRegime:KanawaCloud.context.company.tax_regime,taxableBase:base,taxAmount:ivaV,taxCredit:ivaC,payableAmount:ivaV-ivaC,
      payload:{salesCount:vendas.length,purchaseCount:compras.length,ivaLiquidado:ivaV,ivaDedutivel:ivaC,source:'Kanawa Soft ERP',stage:'draft'}});
    toast('Rascunho de IVA guardado no servidor.','success');openModule('fiscal');
  } catch(error) { toast(error.message||'Não foi possível guardar o rascunho IVA.','error'); }
}
async function guardarRascunhoIRT() {
  try {
    const employees=await getData('funcionarios');
    if(!employees.length){toast('Não existem funcionários para calcular o IRT.','warning');return;}
    const details=employees.map(e=>({name:e.nome||'',nif:e.nif||'',...calcularRemuneracaoAO(e)}));
    const taxableBase=details.reduce((sum,e)=>sum+Number(e.irtBase||0),0);
    const taxAmount=details.reduce((sum,e)=>sum+Number(e.irt||0),0);
    const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,0);
    await KanawaCloud.saveTaxReturn({taxType:'IRT_A',periodStart:start.toISOString().slice(0,10),periodEnd:end.toISOString().slice(0,10),
      taxRegime:KanawaCloud.context.company.tax_regime,taxableBase,taxAmount,taxCredit:0,payableAmount:taxAmount,
      payload:{employeeCount:details.length,employeeInss:details.reduce((sum,e)=>sum+Number(e.employeeInss||0),0),employees:details,stage:'draft',legalReference:'Lei 14/25 e CIRT Lei 18/14 alterada pela Lei 28/20'}});
    toast('Rascunho de IRT guardado no servidor.','success');openModule('fiscal');
  } catch(error) { toast(error.message||'Não foi possível guardar o rascunho IRT.','error'); }
}
async function abrirDeclaracaoFiscal(id) {
  try {
    const rows=await KanawaCloud.listTaxReturns(),row=rows.find(r=>r.id===id);
    if(!row){toast('Declaração não encontrada.','error');return;}
    openModal('Declaração fiscal — '+esc(row.tax_type),
      '<div class="metric-grid"><div class="metric-card"><div class="label">Matéria colectável</div><div class="value">'+fmt(row.taxable_base)+'</div></div>'+
      '<div class="metric-card"><div class="label">Imposto</div><div class="value">'+fmt(row.tax_amount)+'</div></div>'+
      '<div class="metric-card"><div class="label">Crédito</div><div class="value">'+fmt(row.tax_credit)+'</div></div>'+
      '<div class="metric-card"><div class="label">A pagar</div><div class="value">'+fmt(row.payable_amount)+'</div></div></div>'+
      '<p><strong>Período:</strong> '+fmtD(row.period_start)+' — '+fmtD(row.period_end)+'</p>'+
      '<p><strong>Estado:</strong> '+esc(row.status)+'</p>'+
      '<p class="text-muted">Este é um rascunho de conferência. Ainda não foi submetido à AGT.</p>'+
      '<pre class="fiscal-payload">'+esc(JSON.stringify(row.payload||{},null,2))+'</pre>');
  } catch(error) { toast(error.message||'Não foi possível abrir a declaração.','error'); }
}

async function abrirConfiguracaoAGT() {
  let status={};
  try { status=await KanawaCloud.getAGTStatus(); } catch(error) { status={}; }
  const company=KanawaCloud.context&&KanawaCloud.context.company||{};
  const softwarePublicKey=status.softwarePublicKey||'';
  openModal('Configuração AGT — chaves e ambiente',
    '<div class="card agt-certification-status"><h3>Registo e certificação do software</h3>'+
    '<p><strong>Software:</strong> Kanawa Soft ERP · <strong>Versão:</strong> '+esc(status.softwareVersion||'A definir no servidor')+'</p>'+
    '<p><strong>Número de validação AGT:</strong> '+esc(status.softwareValidationNumber||'Ainda não emitido/configurado')+'</p>'+
    '<p><strong>Chave pública do software:</strong> '+(status.softwarePublicKeyConfigured?'Configurada no servidor':'Em falta')+
    ' · <strong>Chave privada do software:</strong> '+(status.softwarePrivateKeyConfigured?'Configurada no servidor':'Em falta')+'</p>'+
    '<p class="text-muted">A chave pública do software é registada no Portal do Parceiro. A chave privada do software fica exclusivamente nos segredos do servidor; nunca a cole neste formulário.</p>'+
    (softwarePublicKey?'<div class="form-group"><label>Chave pública do software — copiar para o Portal do Parceiro</label><textarea readonly rows="4">'+esc(softwarePublicKey)+'</textarea></div>':'')+
    '<a href="https://quiosqueagt.minfin.gov.ao/" target="_blank" rel="noopener">Abrir Quiosque AGT / Portal do Parceiro</a></div>'+
    '<div class="form-group"><label>NIF do contribuinte *</label><input id="agtNif" value="'+esc(company.tax_id||'')+'" inputmode="numeric" maxlength="15"></div>'+
    '<div class="form-group"><label>Ambiente</label><select id="agtEnvironment"><option value="homologation" '+(status.environment==='homologation'?'selected':'')+'>Homologação / Testes</option><option value="production" '+(status.environment==='production'?'selected':'')+'>Produção (bloqueada até certificação)</option></select></div>'+
    '<div class="form-group"><label>Chave privada do contribuinte emitida pela AGT (ficheiro PEM/KEY)</label><input id="agtTaxpayerPrivateKeyFile" type="file" accept=".pem,.key,.txt"></div>'+
    '<div class="form-group"><label>Chave pública do contribuinte emitida pela AGT (ficheiro PEM/PUB/CRT)</label><input id="agtTaxpayerPublicKeyFile" type="file" accept=".pem,.pub,.crt,.cer,.txt"></div>'+
    '<p class="text-muted">Estado actual das chaves do contribuinte: privada '+(status.taxpayerPrivateKeyConfigured?'configurada':'em falta')+' · pública '+(status.taxpayerPublicKeyConfigured?'configurada':'em falta')+'. As duas são guardadas cifradas por empresa e não são devolvidas ao navegador.</p>'+
    '<div class="card"><h3>Segredos globais do software no Supabase</h3><p>Configurar no servidor: <code>AGT_SOFTWARE_PUBLIC_KEY</code>, <code>AGT_SOFTWARE_PRIVATE_KEY</code>, <code>AGT_SOFTWARE_VALIDATION_NUMBER</code> e <code>AGT_SOFTWARE_VERSION</code>. O número de validação só deve ser preenchido depois de emitido pela AGT.</p></div>'+
    '<button class="btn btn-primary btn-block" onclick="guardarConfiguracaoAGT()">Guardar chaves do contribuinte de forma cifrada</button>');
}
async function guardarConfiguracaoAGT() {
  try {
    const privateFile=$('agtTaxpayerPrivateKeyFile')&&$('agtTaxpayerPrivateKeyFile').files[0];
    const publicFile=$('agtTaxpayerPublicKeyFile')&&$('agtTaxpayerPublicKeyFile').files[0];
    const [taxpayerPrivateKey,taxpayerPublicKey]=await Promise.all([privateFile?privateFile.text():'',publicFile?publicFile.text():'']);
    const result=await KanawaCloud.saveAGTConfig({
      taxRegistrationNumber:$('agtNif').value.trim(),
      environment:$('agtEnvironment').value,
      taxpayerPrivateKey:taxpayerPrivateKey,
      taxpayerPublicKey:taxpayerPublicKey
    });
    toast(result.message||'Chaves do contribuinte guardadas de forma cifrada no servidor.','success');
    closeModal();openModule('fiscal');
  } catch(error) { toast(error.message||'Não foi possível guardar as chaves AGT.','error'); }
}
async function prepararSAFTAO() {
  let snap={accounts:[],entries:[]};
  try { snap=await KanawaCloud.getAccountingSnapshot(); } catch(error) { }
  const company=KanawaCloud.context&&KanawaCloud.context.company||{};
  const missing=[];
  if(!company.tax_id)missing.push('NIF da empresa');
  if(!company.legal_name)missing.push('Denominação legal');
  if(!snap.accounts||!snap.accounts.length)missing.push('Plano de contas PGC');
  if(!snap.entries||!snap.entries.length)missing.push('Lançamentos contabilísticos confirmados');
  openModal('Preparação SAF-T AO',
    '<p><strong>O sistema não vai gerar um ficheiro XML inválido.</strong> A exportação SAF-T AO será activada depois de validar a estrutura oficial e os dados obrigatórios.</p>'+
    '<p>Dados ainda em falta:</p>'+(missing.length?'<ul>'+missing.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>Os dados básicos estão presentes; falta validar o XML contra o XSD oficial.</p>')+
    '<p class="text-muted">SAF-T contabilístico e Facturação Electrónica AGT são obrigações/integrações diferentes. A API de Facturação Electrónica não substitui a exportação SAF-T.</p>'+
    '<a href="https://www.agt.minfin.gov.ao/" target="_blank" rel="noopener">Consultar AGT</a>');
}

/* ====== START ====== */
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

/* ====== CENTRO DE INTEGRAÇÕES (credenciais apenas no backend) ====== */
function renderIntegracoes() {
  const cloudReady = !!(window.KanawaCloud && window.KanawaCloud.ready);
  return `
    <div class="card" style="background:linear-gradient(120deg,var(--primary),var(--primary-light));color:#fff;border:0">
      <h2 style="font-size:1.25rem;margin-bottom:6px"><i class="fas fa-plug"></i> Centro de Integrações</h2>
      <p style="opacity:.85">Ligue o Kanawa Soft a WhatsApp, Facebook, Instagram, lojas virtuais e aplicações externas.</p>
    </div>
    <div class="metric-grid">
      <div class="metric-card"><div class="label">Meta / WhatsApp</div><div class="value" style="font-size:1rem">Credenciais protegidas</div><div class="sub">Segredos cifrados no servidor</div></div>
      <div class="metric-card"><div class="label">E-commerce API</div><div class="value" style="font-size:1rem">Chaves por empresa</div><div class="sub">Gerar, consultar prefixo e revogar</div></div>
      <div class="metric-card"><div class="label">Conectores</div><div class="value" style="font-size:1rem">Entrada e saída</div><div class="sub">Arquitetura para webhooks e ERP externo</div></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:8px">Configuração segura</h3>
      <p style="color:var(--text-muted);margin-bottom:12px">Cada empresa utiliza as suas próprias credenciais. O Kanawa Soft não apresenta App Secret ou Access Token depois de guardar e nunca os coloca no HTML ou no armazenamento local.</p>
      <p style="margin-bottom:14px"><span class="badge ${cloudReady ? 'badge-success' : 'badge-warning'}">${cloudReady ? 'Empresa cloud ligada' : 'Sessão cloud não confirmada'}</span></p>
      <a class="btn btn-primary" href="integracoes.html" target="_blank" rel="noopener"><i class="fas fa-shield-alt"></i> Abrir gestão de credenciais</a>
    </div>
    <div class="card">
      <h3 style="margin-bottom:8px">Assistente inteligente</h3>
      <p style="color:var(--text-muted)">Base de conhecimento e conector futuro para ChatGPT preparados na arquitetura. A ativação do modelo, permissões e políticas de dados será feita numa etapa separada; nenhuma informação financeira ou credencial será enviada automaticamente a um modelo externo.</p>
    </div>`;
}


/* ====== CENTRO DE CONFORMIDADE E LEGISLAÇÃO ====== */
function renderConformidade() {
  return `
    <div class="card" style="background:linear-gradient(120deg,var(--primary),var(--primary-light));color:#fff;border:0">
      <h2><i class="fas fa-balance-scale"></i> Conformidade e legislação</h2>
      <p style="opacity:.85">Biblioteca de referências legais, políticas e tarefas de conformidade da empresa.</p>
    </div>
    <div class="card">
      <h3 style="margin-bottom:8px">Angola · diplomas de referência</h3>
      <p style="color:var(--text-muted);margin-bottom:14px">Protecção de dados, comunicações electrónicas, cibersegurança, videovigilância, defesa do consumidor, trabalho e fiscalidade.</p>
      <a class="btn btn-primary" href="conformidade.html" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Abrir biblioteca legal e termos</a>
    </div>
    <div class="card">
      <h3 style="margin-bottom:8px">Aviso de conformidade</h3>
      <p style="color:var(--text-muted)">Os diplomas e minutas são referências para revisão. A empresa deve confirmar a legislação vigente, preencher os dados legais do operador e obter validação jurídica. O Kanawa Soft não declara homologação ou certificação AGT.</p>
    </div>`;
}


/* ====== FIRST-RUN PACKAGE ONBOARDING ====== */
const KS_PLAN_LABELS = { trial:'Teste gratuito', mini:'Mini', standard:'Standard', premium:'Premium', enterprise:'Enterprise' };
const KS_PLAN_PRICES = { trial:0, mini:15000, standard:35000, premium:75000, enterprise:0 };
function ignorarApresentacaoPlanos() {
  localStorage.setItem('kanawa_plan_intro_seen_v1','true');
  const splash=$('planWelcome'); if(splash)splash.classList.remove('active');
  if($('authScreen'))$('authScreen').classList.add('active');
}
function selecionarPlano(code) {
  localStorage.setItem('kanawa_selected_plan',code);
  localStorage.setItem('kanawa_plan_intro_seen_v1','true');
  if(code==='trial') {
    const splash=$('planWelcome');if(splash)splash.classList.remove('active');
    if($('authScreen'))$('authScreen').classList.remove('active');
    if($('setupWizard'))$('setupWizard').classList.add('active');
    toast('Teste gratuito de 14 dias seleccionado.','success');
    return;
  }
  const panel=$('planPaymentChoice'); if(panel)panel.classList.add('active');
  const label=$('chosenPlanLabel'); if(label)label.textContent=KS_PLAN_LABELS[code]||code;
  panel && panel.scrollIntoView({behavior:'smooth',block:'center'});
}
function continuarComPlanoPago() {
  const plan=localStorage.getItem('kanawa_selected_plan')||'mini';
  localStorage.setItem('kanawa_selected_term',$('chosenTerm').value);
  localStorage.setItem('kanawa_selected_payment',$('chosenPayment').value);
  const splash=$('planWelcome');if(splash)splash.classList.remove('active');
  if($('authScreen'))$('authScreen').classList.remove('active');
  if($('setupWizard'))$('setupWizard').classList.add('active');
  toast('Pacote '+(KS_PLAN_LABELS[plan]||plan)+' seleccionado. Crie a conta e depois envie o comprovativo em Licença e Pacotes.','info');
}

/* ====== COMPANY REGISTRY AND DOCUMENT EXPIRY ====== */
function ksExpiryLabel(date) {
  if(!date)return '<span class="badge badge-secondary">Sem validade indicada</span>';
  const days=Math.ceil((new Date(date+'T23:59:59').getTime()-Date.now())/86400000);
  if(days<0)return '<span class="badge badge-danger">Expirado há '+Math.abs(days)+' dia(s)</span>';
  if(days<=7)return '<span class="badge badge-danger">Expira em '+days+' dia(s)</span>';
  if(days<=15)return '<span class="badge badge-warning">Expira em '+days+' dias</span>';
  if(days<=30)return '<span class="badge badge-warning">Expira em '+days+' dias</span>';
  if(days<=60)return '<span class="badge badge-info">Expira em '+days+' dias</span>';
  if(days<=90)return '<span class="badge badge-info">Expira em '+days+' dias</span>';
  return '<span class="badge badge-success">Válido</span>';
}
async function renderEmpresaLegal() {
  let p=null,docs=[];
  try { p=await KanawaCloud.getCompanyLegalProfile(); docs=await KanawaCloud.getCompanyDocuments(); }
  catch(e){toast('Não foi possível carregar os dados legais: '+e.message,'warning');}
  p=p||{};
  const fields=[
    ['legal_form','Natureza jurídica'],['incorporation_date','Data de constituição','date'],
    ['commercial_registry_number','N.º matrícula / registo comercial'],['commercial_entry_number','N.º verbete / ficha'],['registry_office','Conservatória / entidade de registo'],['commercial_registry_date','Data da certidão','date'],['commercial_certificate_expires_at','Validade da certidão','date'],
    ['publication_number','N.º publicação online GUE'],['publication_date','Data publicação GUE','date'],
    ['publication_url','Link publicação GUE','url'],['capital_amount','Capital social (Kz)','number'],
    ['activity_code','Código de actividade'],['activity_description','Actividade principal'],
    ['alvara_number','N.º alvará/licença'],['alvara_type','Tipo de alvará'],
    ['alvara_issue_date','Emissão alvará','date'],['alvara_expiry_date','Validade alvará','date'],
    ['inss_employer_number','N.º empregador INSS'],['registered_address','Morada registada'],
    ['province','Província'],['municipality','Município'],['parish','Distrito / comuna / bairro']
  ];
  const inputs=fields.map(([key,label,type])=>'<div class="form-group"><label>'+label+'</label><input id="legal_'+key+'" type="'+(type||'text')+'" value="'+esc(p[key]||'')+'"></div>').join('');
  const rows=docs.map(d=>[esc(d.title),esc(d.document_number||'-'),fmtD(d.issued_at),fmtD(d.expires_at),ksExpiryLabel(d.expires_at),d.file_path?'<span class="badge badge-success">Anexado</span>':'-']);
  const expiring=docs.filter(d=>d.expires_at&&new Date(d.expires_at).getTime()-Date.now()<90*86400000);
  return header('Cadastro Legal da Empresa','Registo comercial, licenças e documentos com alertas de validade','var(--primary)','', 'fa-building')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Documentos registados</div><div class="value">'+docs.length+'</div></div><div class="metric-card"><div class="label">A renovar em 90 dias</div><div class="value" style="color:var(--warning)">'+expiring.length+'</div></div><div class="metric-card"><div class="label">Publicação</div><div class="value" style="font-size:1rem">GUE Online</div></div></div>'+
    '<div class="card"><h3>Dados legais e fiscais</h3><p style="color:var(--text-muted);font-size:.84rem">A publicação dos actos societários é registada no GUE online. Não se exige número de Diário da República como campo obrigatório.</p><div class="form-grid">'+inputs+'</div><button class="btn btn-success" onclick="guardarPerfilLegalEmpresa()">Guardar cadastro legal</button></div>'+
    '<div class="card"><h3>Documentos da empresa</h3><div class="form-grid"><div class="form-group"><label>Tipo de documento</label><select id="companyDocType"><option>Certidão comercial</option><option>Comprovativo NIF</option><option>Publicação GUE</option><option>Alvará / licença</option><option>Estatutos / pacto social</option><option>Acta / procuração</option><option>Comprovativo INSS</option><option>Seguro obrigatório</option><option>Outro</option></select></div><div class="form-group"><label>Título</label><input id="companyDocTitle" placeholder="Nome do documento"></div><div class="form-group"><label>Número / referência</label><input id="companyDocNumber"></div><div class="form-group"><label>Entidade emissora</label><input id="companyDocAuthority"></div><div class="form-group"><label>Data de emissão</label><input id="companyDocIssue" type="date"></div><div class="form-group"><label>Data de validade / expiração</label><input id="companyDocExpiry" type="date"></div><div class="form-group full"><label>Ficheiro (PDF/JPG/PNG/WEBP, até 15 MB)</label><input id="companyDocFile" type="file" accept=".pdf,image/jpeg,image/png,image/webp"></div></div><button class="btn btn-primary" onclick="adicionarDocumentoEmpresa()">Guardar documento e activar alertas</button></div>'+
    '<div class="card"><h3>Calendário de validade</h3>'+table(['Documento','Número','Emissão','Validade','Alerta','Ficheiro'],rows)+'</div>'+
    '<div class="card"><p style="font-size:.8rem;color:var(--text-muted)">Os alertas são calculados a 90, 60, 30, 15 e 7 dias. Para avisos automáticos por email/WhatsApp será necessário activar o serviço de notificações no servidor.</p><a href="https://gue.gov.ao/portal/public/publicacoes" target="_blank" rel="noopener">Consultar publicações oficiais do GUE</a></div>';
}
async function guardarPerfilLegalEmpresa() {
  const keys=['legal_form','incorporation_date','commercial_registry_number','commercial_registry_date','publication_number','publication_date','publication_url','capital_amount','activity_code','activity_description','alvara_number','alvara_type','alvara_issue_date','alvara_expiry_date','inss_employer_number','registered_address','province','municipality','parish'];
  const data={};keys.forEach(k=>{const el=$('legal_'+k);if(el)data[k]=el.value||null;});
  if(data.capital_amount)data.capital_amount=Number(data.capital_amount);
  try{await KanawaCloud.saveCompanyLegalProfile(data);toast('Cadastro legal actualizado no servidor.','success');openModule('empresa-legal');}
  catch(e){toast(e.message||'Erro ao guardar cadastro.','danger');}
}
async function adicionarDocumentoEmpresa() {
  const title=$('companyDocTitle').value.trim()||$('companyDocType').value;
  const file=$('companyDocFile').files[0];
  if(!file){toast('Anexe o documento para continuar.','warning');return;}
  try{
    const path=await KanawaCloud.uploadPrivateFile('ks-company-documents',file,'company');
    await KanawaCloud.saveCompanyDocument({document_type:$('companyDocType').value,title,document_number:$('companyDocNumber').value.trim(),issuing_authority:$('companyDocAuthority').value.trim(),issued_at:$('companyDocIssue').value||null,expires_at:$('companyDocExpiry').value||null,file_path:path,status:'valid',reminder_days:[90,60,30,15,7]});
    toast('Documento guardado em armazenamento privado.','success');openModule('empresa-legal');
  }catch(e){toast(e.message||'Não foi possível guardar o documento.','danger');}
}

/* ====== EMPLOYEE DOCUMENTS ====== */
async function renderDocumentosFuncionarios() {
  const employees=await getData('funcionarios');
  let docs=[];try{docs=await KanawaCloud.getEmployeeDocuments();}catch(e){console.warn(e);}
  const options=employees.map(x=>'<option value="'+esc(x.cloud_id||'')+'" data-local-id="'+x.id+'" '+(!x.cloud_id?'disabled':'')+'>'+esc(x.nome)+(x.cloud_id?'':' · sincronização pendente')+'</option>').join('');
  return header('Documentos dos Funcionários',docs.length+' documentos pessoais e laborais','var(--info)','', 'fa-id-card')+
    '<div class="card"><div class="form-grid"><div class="form-group"><label>Funcionário</label><select id="empDocEmployee">'+options+'</select></div><div class="form-group"><label>Tipo</label><select id="empDocType"><option>Bilhete de Identidade</option><option>Passaporte</option><option>NIF</option><option>Contrato de trabalho</option><option>Atestado / exame médico</option><option>Certificado profissional</option><option>Visto / autorização de trabalho</option><option>Seguro</option><option>Outro</option></select></div><div class="form-group"><label>Título</label><input id="empDocTitle"></div><div class="form-group"><label>Número</label><input id="empDocNumber"></div><div class="form-group"><label>Emissão</label><input id="empDocIssue" type="date"></div><div class="form-group"><label>Validade</label><input id="empDocExpiry" type="date"></div><div class="form-group full"><label>Ficheiro privado</label><input id="empDocFile" type="file" accept=".pdf,image/jpeg,image/png,image/webp"></div></div><button class="btn btn-primary" onclick="adicionarDocumentoFuncionario()">Guardar documento</button></div>'+
    '<div class="card">'+table(['Funcionário','Documento','Número','Emissão','Validade','Alerta'],docs.map(d=>{const emp=employees.find(x=>String(x.cloud_id)===String(d.employee_id));return[esc(emp?emp.nome:'Funcionário'),esc(d.title),esc(d.document_number||'-'),fmtD(d.issued_at),fmtD(d.expires_at),ksExpiryLabel(d.expires_at)];}))+'</div>';
}
async function adicionarDocumentoFuncionario() {
  const select=$('empDocEmployee'),employeeId=select.value,file=$('empDocFile').files[0];
  if(!employeeId||!file){toast('Seleccione um funcionário sincronizado e anexe o ficheiro.','warning');return;}
  const localId=select.options[select.selectedIndex].dataset.localId;
  try{const path=await KanawaCloud.uploadPrivateFile('ks-company-documents',file,'employee');
    await KanawaCloud.saveEmployeeDocument({employeeId,documentType:$('empDocType').value,title:$('empDocTitle').value.trim()||$('empDocType').value,documentNumber:$('empDocNumber').value.trim(),issuedAt:$('empDocIssue').value||null,expiresAt:$('empDocExpiry').value||null,filePath:path});
    toast('Documento do funcionário guardado.','success');openModule('rh-documentos');
  }catch(e){toast(e.message||'Falha ao guardar documento.','danger');}
}

/* ====== LICENSE, PLANS, PAYMENT AND INVOICE QUOTAS ====== */
async function renderLicenca() {
  let license=null,ent=null,plans=[],requests=[],terms=[];
  try{[license,ent,plans,requests,terms]=await Promise.all([KanawaCloud.getLicense(),KanawaCloud.getEntitlements(),KanawaCloud.getPlans(),KanawaCloud.getPaymentRequests(),KanawaCloud.getLicenseTerms()]);}
  catch(e){console.warn('Licença:',e);}
  const current=license||{};
  const plan=plans.find(x=>x.plan_code===current.plan_code);
  const used=Number(ent&&ent.invoice_usage||0),limit=Number(ent&&ent.invoice_limit||0);
  const pct=limit?Math.min(100,Math.round(used/limit*100)):0;
  const selected=localStorage.getItem('kanawa_selected_plan')||'mini';
  const opts=plans.filter(x=>x.plan_code!=='trial').map(x=>'<option value="'+x.plan_code+'" data-price="'+Number(x.price||0)+'" '+(x.plan_code===selected?'selected':'')+'>'+esc(x.name)+' · '+(Number(x.price)?fmt(x.price)+' Kz/mês':'Sob consulta')+' · '+(Number(x.max_invoices_period)>0?Number(x.max_invoices_period).toLocaleString('pt-AO')+' facturas/mês':'Facturas ilimitadas')+'</option>').join('');
  const isPlatformAdmin=!!(KanawaCloud.context&&KanawaCloud.context.isPlatformAdmin);
  let adminRequests=[];
  if(isPlatformAdmin){try{adminRequests=await KanawaCloud.listAllPaymentRequests();}catch(adminError){console.warn(adminError);}}
  const selectedTerm=localStorage.getItem('kanawa_selected_term')||'monthly';
  const selectedMethod=localStorage.getItem('kanawa_selected_payment')||'bank_transfer';
  const termLabel=(code,months,days)=>{const found=terms.find(t=>t.term_code===code);if(found)return found.name;if(Number(days)>0)return Number(days)+' dias';return Number(months)+' meses';};
  const termOpts=terms.filter(t=>!t.internal_only&&t.term_code!=='trial_14_days').map(t=>'<option value="'+esc(t.term_code)+'" data-months="'+Number(t.duration_months||0)+'" data-days="'+Number(t.duration_days||0)+'" '+(t.term_code===selectedTerm?'selected':'')+'>'+esc(t.name)+'</option>').join('');
  const requestRows=requests.map(x=>[esc(x.plan_code),esc(termLabel(x.term_code,x.duration_months,x.duration_days)),fmt(x.amount)+' Kz',esc(x.payment_method),badge(x.status,x.status==='approved'?'success':'warning'),fmtD(x.created_at)]);
  setTimeout(atualizarTotalLicenca,0);
  const adminRows=adminRequests.map(x=>[esc((x.company&&x.company.trade_name)|| (x.company&&x.company.legal_name)||x.company_id),esc(x.plan_code),esc(termLabel(x.term_code,x.duration_months,x.duration_days)),fmt(x.amount)+' Kz',esc(x.payment_method),'<button class="btn btn-sm btn-info" onclick="abrirComprovativoPagamento(&quot;'+esc(x.proof_path||'')+'&quot;)">Comprovativo</button> <button class="btn btn-sm btn-success" onclick="emitirChavePedido(&quot;'+esc(x.plan_code)+'&quot;,&quot;'+esc(x.term_code||({1:'monthly',12:'annual',24:'two_year',36:'three_year'}[Number(x.duration_months)]||'monthly'))+'&quot;,&quot;'+x.id+'&quot;)">Emitir chave</button>']);
  return header('Licença e Pacotes','Teste de 14 dias, activação por chave e controlo de facturas','var(--primary)','', 'fa-key')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Pacote actual</div><div class="value" style="font-size:1.25rem">'+esc(plan?plan.name:(current.plan_code||'Pendente'))+'</div></div><div class="metric-card"><div class="label">Estado</div><div class="value" style="font-size:1.1rem">'+badge(current.status||'sem licença',current.status==='active'||current.status==='trial'?'success':'warning')+'</div></div><div class="metric-card"><div class="label">Facturas este mês</div><div class="value">'+used.toLocaleString('pt-AO')+' / '+(limit?limit.toLocaleString('pt-AO'):'Ilimitado')+'</div><div style="height:8px;background:var(--border);border-radius:8px;margin-top:8px"><div style="height:8px;width:'+pct+'%;background:var(--success);border-radius:8px"></div></div></div><div class="metric-card"><div class="label">Validade</div><div class="value" style="font-size:1rem">'+(current.plan_code==='internal_lifetime'?'Vitalícia':(current.expires_at?fmtD(current.expires_at):'A aguardar activação'))+'</div></div></div>'+
    '<div class="card"><h3>Introduzir chave de licença</h3><p style="color:var(--text-muted);font-size:.84rem">A chave é validada no servidor. Não a partilhe com outros utilizadores.</p><div class="form-group"><input id="licenseActivationKey" autocomplete="off" placeholder="KANAWA-XXXX-XXXX-XXXX"></div><button class="btn btn-success" onclick="ativarChaveLicenca()">Validar e activar</button></div>'+
    '<div class="card"><h3>Solicitar activação de pacote</h3><div class="form-grid"><div class="form-group"><label>Pacote</label><select id="activationPlan" onchange="atualizarTotalLicenca()">'+opts+'</select></div><div class="form-group"><label>Duração</label><select id="activationDuration" onchange="atualizarTotalLicenca()">'+termOpts+'</select></div><div class="form-group"><label>Meio de pagamento</label><select id="activationMethod"><option value="bank_transfer" '+(selectedMethod==='bank_transfer'?'selected':'')+'>Transferência bancária</option><option value="card" '+(selectedMethod==='card'?'selected':'')+'>Cartão</option><option value="multicaixa_express" '+(selectedMethod==='multicaixa_express'?'selected':'')+'>Multicaixa Express</option><option value="cash_without_card" '+(selectedMethod==='cash_without_card'?'selected':'')+'>Levantamento sem cartão</option></select></div><div class="form-group"><label>Referência / comprovativo</label><input id="activationReference" placeholder="Referência da operação"></div><div class="form-group full"><label>Comprovativo de pagamento (PDF/JPG/PNG)</label><input id="activationProof" type="file" accept=".pdf,image/jpeg,image/png,image/webp"></div></div><p id="activationTotal" style="font-weight:800">Total: —</p><button class="btn btn-primary" onclick="solicitarAtivacaoLicenca()">Enviar comprovativo para validação</button><p style="font-size:.76rem;color:var(--text-muted)">A licença permanece pendente até o pagamento ser verificado e o administrador emitir uma chave. O sistema nunca activa uma licença apenas porque um ficheiro foi carregado.</p></div>'+
    '<div class="card"><h3>Histórico de pedidos</h3>'+table(['Pacote','Período','Valor','Método','Estado','Data'],requestRows)+'</div>'+
    (isPlatformAdmin?'<div class="card"><h3>Administração de licenças · pedidos pendentes</h3><p style="color:var(--text-muted);font-size:.82rem">Verifique o comprovativo antes de emitir uma chave. A chave é mostrada uma única vez; envie-a ao cliente por um canal seguro.</p><button class="btn btn-purple" onclick="emitirChaveVitaliciaInterna()"><i class="fas fa-infinity"></i> Gerar chave vitalícia interna da D.PEDRO</button><p style="font-size:.76rem;color:var(--text-muted);margin-top:8px">A chave vitalícia interna só pode ser activada na empresa do proprietário da plataforma.</p>'+table(['Empresa','Pacote','Prazo','Valor','Pagamento','Acções'],adminRows)+'</div>':'');
}
function atualizarTotalLicenca(){
  const p=$('activationPlan'),d=$('activationDuration');if(!p||!d)return;
  const opt=d.options[d.selectedIndex],months=Number(opt&&opt.dataset.months||0),days=Number(opt&&opt.dataset.days||0);
  const factor=months||days/30;
  const price=Number(p.options[p.selectedIndex]&&p.options[p.selectedIndex].dataset.price)||KS_PLAN_PRICES[p.value]||0;
  localStorage.setItem('kanawa_selected_term',d.value);
  const el=$('activationTotal');
  if(el)el.textContent=price?'Total proposto: '+fmt(Math.round(price*factor))+' Kz ('+(days?days+' dias':months+' mês(es)')+')':'Total: orçamento sob consulta';
}
async function solicitarAtivacaoLicenca(){
  const file=$('activationProof').files[0],plan=$('activationPlan').value,term=$('activationDuration').value;
  const opt=$('activationDuration').options[$('activationDuration').selectedIndex];
  const months=Number(opt&&opt.dataset.months||0),days=Number(opt&&opt.dataset.days||0);
  if(!file){toast('Anexe o comprovativo de pagamento.','warning');return;}
  const selectedOption=$('activationPlan').options[$('activationPlan').selectedIndex];
  const price=Number(selectedOption&&selectedOption.dataset.price)||KS_PLAN_PRICES[plan]||0;
  if(!price){toast('O pacote Enterprise exige proposta comercial aprovada.','warning');return;}
  const factor=months||days/30;
  try{const path=await KanawaCloud.uploadPrivateFile('ks-payment-proofs',file,'payment');
    const req=await KanawaCloud.requestPaymentActivation({planCode:plan,termCode:term,durationMonths:months,durationDays:days,amount:Math.round(price*factor),paymentMethod:$('activationMethod').value,transactionReference:$('activationReference').value,proofPath:path});
    toast('Pedido de activação enviado para validação. Referência '+req.id,'success');openModule('licenca');
  }catch(e){toast(e.message||'Não foi possível enviar o pedido.','danger');}
}
async function ativarChaveLicenca(){
  const key=$('licenseActivationKey').value.trim();if(!key){toast('Introduza a chave recebida.','warning');return;}
  try{const result=await KanawaCloud.redeemLicenseKey(key);localStorage.removeItem('kanawa_pending_license_key');toast('Licença '+result.plan_code+' activada com sucesso.','success');openModule('licenca');}
  catch(e){toast(e.message||'Chave inválida.','danger');}
}

/* ====== GENERAL EXPENSES ====== */
async function renderDespesasGerais(){
  let items=[];try{items=await KanawaCloud.listGeneralExpenses();}catch(e){console.warn(e);}
  const total=items.reduce((s,x)=>s+Number(x.amount||0),0);
  return header('Despesas Gerais','Custos operacionais, comprovativos e centros de custo','var(--danger)','<button class="btn btn-success" onclick="novaDespesaGeral()"><i class="fas fa-plus"></i> Registar despesa</button>','fa-file-invoice-dollar')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Total registado</div><div class="value">'+fmt(total)+'</div></div><div class="metric-card"><div class="label">Despesas</div><div class="value">'+items.length+'</div></div><div class="metric-card"><div class="label">Por pagar</div><div class="value">'+fmt(items.filter(x=>x.status!=='paid').reduce((s,x)=>s+Number(x.amount||0),0))+'</div></div></div>'+
    '<div class="card">'+table(['Categoria','Descrição','Fornecedor','Valor','Vencimento','Estado','Acções'],items.map(x=>[esc(x.category||'-'),esc(x.description||'-'),esc(x.supplier_name||'-'),fmt(x.amount),fmtD(x.due_on),badge(x.status,x.status==='paid'?'success':'warning'),x.status!=='paid'?'<button class="btn btn-sm btn-success" onclick="marcarDespesaGeralPaga(\''+x.id+'\')">Pagar</button>':'-']))+'</div>';
}
function novaDespesaGeral(){
  openModal('Nova Despesa Geral','<div class="form-grid"><div class="form-group"><label>Categoria</label><select id="dgCategoria"><option>Renda</option><option>Água e electricidade</option><option>Internet e comunicações</option><option>Combustível e transporte</option><option>Manutenção</option><option>Material de escritório</option><option>Alimentação</option><option>Seguros</option><option>Impostos e taxas</option><option>Marketing</option><option>Outros</option></select></div><div class="form-group"><label>Fornecedor</label><input id="dgFornecedor"></div><div class="form-group full"><label>Descrição</label><input id="dgDescricao"></div><div class="form-group"><label>Valor (Kz)</label><input id="dgValor" type="number" min="0" value="0"></div><div class="form-group"><label>Vencimento</label><input id="dgVenc" type="date"></div><div class="form-group"><label>Centro de custo</label><input id="dgCentro"></div><div class="form-group"><label>Projecto</label><input id="dgProjecto"></div></div><button class="btn btn-primary btn-block" onclick="guardarDespesaGeral()">Guardar despesa</button>');
}
async function guardarDespesaGeral(){
  const desc=$('dgDescricao').value.trim();if(!desc){toast('Informe a descrição.','warning');return;}
  try{
    await KanawaCloud.createGeneralExpense({category:$('dgCategoria').value,description:desc,supplierName:$('dgFornecedor').value.trim(),amount:num($('dgValor').value,0),dueOn:$('dgVenc').value||null});
    toast('Despesa registada na base de dados central.','success');closeModal();openModule('despesas-gerais');
  }catch(e){toast(e.message||'Não foi possível registar a despesa.','danger');}
}
async function marcarDespesaGeralPaga(id){
  if(!confirm('Confirmar que esta despesa foi paga?'))return;
  try{await KanawaCloud.updateGeneralExpenseStatus(id,'paid');toast('Despesa marcada como paga.','success');openModule('despesas-gerais');}
  catch(e){toast(e.message||'Não foi possível actualizar a despesa.','danger');}
}

/* ====== LEAVE, HOLIDAYS AND ABSENCES ====== */
async function renderFeriasDispensas(){
  const [remoteRows,staff]=await Promise.all([KanawaCloud.listLeaveRequests(),getData('funcionarios')]);
  const rows=remoteRows.map(x=>{const emp=staff.find(e=>String(e.cloud_id)===String(x.employee_id));return{id:x.id,cloud_id:x.id,funcionarioNome:emp?emp.nome:'Funcionário',tipo:x.reason||'Pedido de ausência',inicio:x.starts_on,fim:x.ends_on,dias:x.requested_days,motivo:x.reason,status:x.status==='approved'?'aprovado':x.status==='rejected'?'rejeitado':'pendente'};});
  const pending=rows.filter(x=>x.status==='pendente').length;
  const vacationBalances=staff.map(x=>({name:x.nome,days:calcularDireitoFerias(x)}));
  return header('Férias, Licenças e Dispensas',rows.length+' pedidos · '+pending+' pendentes','var(--info)','<button class="btn btn-success" onclick="novoPedidoAusencia()"><i class="fas fa-plus"></i> Novo pedido</button>','fa-calendar-minus')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Pedidos</div><div class="value">'+rows.length+'</div></div><div class="metric-card"><div class="label">Pendentes</div><div class="value">'+pending+'</div></div><div class="metric-card"><div class="label">Aprovados</div><div class="value">'+rows.filter(x=>x.status==='aprovado').length+'</div></div></div>'+
    '<div class="card"><h3>Referência de férias anuais</h3><p style="font-size:.8rem;color:var(--text-muted)">Estimativa inicial com base na Lei 12/23, artigo 204.º: 22 dias úteis por ano; no ano de admissão, 2 dias úteis por mês completo, sujeito às regras legais e à validação do RH.</p>'+table(['Funcionário','Dias estimados no ano'],vacationBalances.map(x=>[esc(x.name),x.days]))+'</div>'+
    '<div class="card"><p style="font-size:.82rem;color:var(--text-muted)">Os pedidos são guardados na base de dados da empresa. A aprovação final deve respeitar o contrato, o calendário de férias e a legislação aplicável.</p>'+
    table(['Funcionário','Tipo / motivo','Início','Fim','Dias','Estado','Acção'],rows.map(x=>[esc(x.funcionarioNome),esc(x.tipo||'-'),fmtD(x.inicio),fmtD(x.fim),x.dias||'-',badge(x.status,x.status==='aprovado'?'success':x.status==='rejeitado'?'danger':'warning'),x.status==='pendente'&&podeFazer('aprovar')?'<button class="btn btn-sm btn-success" onclick="decidirAusencia(\''+x.id+'\',\'aprovado\')">Aprovar</button> <button class="btn btn-sm btn-danger" onclick="decidirAusencia(\''+x.id+'\',\'rejeitado\')">Rejeitar</button>':'A aguardar']))+'</div>';
}
function novoPedidoAusencia(){
  const staff=DB.getAll('funcionarios');
  staff.then(list=>openModal('Pedido de Férias / Dispensa','<div class="form-group"><label>Funcionário</label><select id="ausFuncionario">'+list.map(x=>'<option value="'+x.id+'">'+esc(x.nome)+'</option>').join('')+'</select></div><div class="form-group"><label>Tipo</label><select id="ausTipo"><option>Férias anuais</option><option>Dispensa autorizada</option><option>Falta justificada</option><option>Licença sem remuneração</option><option>Licença de formação</option><option>Assistência familiar</option><option>Outro</option></select></div><div class="form-grid"><div class="form-group"><label>Início</label><input id="ausInicio" type="date"></div><div class="form-group"><label>Fim</label><input id="ausFim" type="date"></div></div><div class="form-group"><label>Motivo / observação</label><textarea id="ausMotivo"></textarea></div><button class="btn btn-primary btn-block" onclick="guardarPedidoAusencia()">Enviar pedido</button>'));
}
async function guardarPedidoAusencia(){
  const staff=await DB.getAll('funcionarios'),id=$('ausFuncionario').value,emp=staff.find(x=>String(x.id)===String(id));
  const start=$('ausInicio').value,end=$('ausFim').value;if(!emp||!start||!end||end<start){toast('Verifique funcionário e datas.','warning');return;}
  const days=Math.floor((new Date(end+'T12:00:00')-new Date(start+'T12:00:00'))/86400000)+1;
  try{
    let employeeId=emp.cloud_id;
    if(!employeeId){
      const remote=await KanawaCloud.upsertEmployee({employeeNumber:'EMP-'+emp.id,fullName:emp.nome,email:emp.email,phone:emp.telefone,taxId:emp.nif,department:emp.departamento,jobTitle:emp.cargo,hireDate:emp.dataContratacao,salary:emp.salario,status:'active'});
      employeeId=remote.id;emp.cloud_id=employeeId;await DB.put('funcionarios',emp);
    }
    await KanawaCloud.createLeaveRequest({employeeId,startsOn:start,endsOn:end,days,reason:$('ausTipo').value+': '+$('ausMotivo').value});
    toast('Pedido enviado para aprovação.','success');closeModal();openModule('ferias-dispensas');
  }catch(e){toast(e.message||'Não foi possível enviar o pedido.','danger');}
}
async function decidirAusencia(id,status){
  try{await KanawaCloud.decideLeaveRequest(id,status==='aprovado'?'approved':'rejected');toast('Pedido '+status+'.','success');openModule('ferias-dispensas');}
  catch(e){toast(e.message||'Não foi possível decidir o pedido.','danger');}
}

/* ====== CALENDAR AND MEETINGS ====== */
async function renderAgenda(){
  let events=[];
  try{
    const [calendar,meetings]=await Promise.all([KanawaCloud.listCalendarEvents(),KanawaCloud.listMeetings()]);
    events=calendar.map(x=>({titulo:x.title,tipo:x.event_type,inicio:x.starts_at,local:x.location,status:x.status,hora:new Date(x.starts_at).toLocaleTimeString('pt-AO',{hour:'2-digit',minute:'2-digit'})}));
    meetings.forEach(m=>events.push({titulo:m.title,tipo:'Reunião',inicio:m.starts_at,local:m.meeting_url||m.location,status:m.status,hora:new Date(m.starts_at).toLocaleTimeString('pt-AO',{hour:'2-digit',minute:'2-digit'})}));
  }catch(e){events=await getData('eventosCalendar');console.warn('Agenda central indisponível:',e);}
  const sorted=events.slice().sort((a,b)=>String(a.inicio||'').localeCompare(String(b.inicio||'')));
  window.KS_AGENDA_CACHE=sorted;
  return header('Agenda e Marcações',sorted.length+' eventos e compromissos','var(--primary)','<button class="btn btn-success" onclick="novoEventoAgenda()"><i class="fas fa-plus"></i> Nova marcação</button>','fa-calendar-alt')+
    '<div class="card"><div class="form-grid"><div class="form-group"><label>Pesquisar agenda</label><input id="agendaSearch" oninput="filtrarAgenda()" placeholder="Título, local ou responsável"></div><div class="form-group"><label>Tipo</label><select id="agendaType" onchange="filtrarAgenda()"><option value="">Todos</option><option>Reunião</option><option>Marcação</option><option>Entrega</option><option>Manutenção</option><option>Prazo</option><option>Outro</option></select></div></div><div id="agendaRows">'+table(['Data','Hora','Compromisso','Tipo','Local','Estado'],sorted.map(x=>[fmtD(x.inicio),esc(x.hora||''),'<strong>'+esc(x.titulo)+'</strong>',esc(x.tipo||'-'),esc(x.local||'-'),badge(x.status||'agendado','info')]))+'</div></div>';
}
function filtrarAgenda(){
  const q=($('agendaSearch').value||'').toLowerCase(),t=$('agendaType').value;
  const rows=(window.KS_AGENDA_CACHE||[]).filter(x=>(!t||x.tipo===t)&&JSON.stringify(x).toLowerCase().includes(q));
  $('agendaRows').innerHTML=table(['Data','Hora','Compromisso','Tipo','Local','Estado'],rows.map(x=>[fmtD(x.inicio),esc(x.hora||''),'<strong>'+esc(x.titulo)+'</strong>',esc(x.tipo||'-'),esc(x.local||'-'),badge(x.status||'agendado','info')]));
}
function novoEventoAgenda(){
  openModal('Novo compromisso','<div class="form-grid"><div class="form-group full"><label>Título</label><input id="agTitulo"></div><div class="form-group"><label>Tipo</label><select id="agTipo"><option>Marcação</option><option>Reunião</option><option>Entrega</option><option>Manutenção</option><option>Prazo</option><option>Outro</option></select></div><div class="form-group"><label>Data</label><input id="agData" type="date"></div><div class="form-group"><label>Hora</label><input id="agHora" type="time"></div><div class="form-group"><label>Local / Link</label><input id="agLocal"></div><div class="form-group"><label>Responsável</label><input id="agResp"></div><div class="form-group full"><label>Descrição</label><textarea id="agDesc"></textarea></div></div><button class="btn btn-primary btn-block" onclick="guardarEventoAgenda()">Guardar na agenda</button>');
}
async function guardarEventoAgenda(){
  const title=$('agTitulo').value.trim(),date=$('agData').value;
  if(!title||!date){toast('Título e data são obrigatórios.','warning');return;}
  const startsAt=new Date(date+'T'+($('agHora').value||'09:00')+':00').toISOString();
  try{
    await KanawaCloud.createCalendarEvent({title,description:$('agDesc').value,eventType:$('agTipo').value,startsAt,location:$('agLocal').value});
    toast('Compromisso guardado na agenda central.','success');closeModal();openModule('agenda');
  }catch(e){toast(e.message||'Não foi possível agendar.','danger');}
}
async function renderReunioes(){
  let rows=[];try{rows=await KanawaCloud.listMeetings();}catch(e){console.warn(e);}
  return header('Reuniões Empresariais',rows.length+' reuniões','var(--purple)','<button class="btn btn-success" onclick="novaReuniao()">Agendar reunião</button>','fa-users')+
    '<div class="card"><p style="color:var(--text-muted);font-size:.84rem">Registe pauta, participantes, decisões, actas, local e link de videoconferência.</p>'+
    table(['Data','Reunião','Pauta','Local / Link','Estado'],rows.map(x=>[fmtD(x.starts_at),'<strong>'+esc(x.title)+'</strong>',esc(x.agenda||'-'),esc(x.meeting_url||x.location||'-'),badge(x.status||'agendada','info')]))+'</div>';
}
function novaReuniao(){
  openModal('Agendar reunião empresarial','<div class="form-grid"><div class="form-group full"><label>Título</label><input id="meetTitle"></div><div class="form-group full"><label>Pauta / objectivo</label><textarea id="meetAgenda"></textarea></div><div class="form-group"><label>Data e hora de início</label><input id="meetStart" type="datetime-local"></div><div class="form-group"><label>Data e hora de fim</label><input id="meetEnd" type="datetime-local"></div><div class="form-group"><label>Local</label><input id="meetLocation"></div><div class="form-group"><label>Link de reunião</label><input id="meetUrl" type="url"></div><div class="form-group full"><label>Emails dos participantes (separados por vírgula)</label><input id="meetAttendees" type="text"></div></div><button class="btn btn-primary btn-block" onclick="guardarReuniao()">Guardar reunião e convites</button>');
}
async function guardarReuniao(){
  const title=$('meetTitle').value.trim(),start=$('meetStart').value;
  if(!title||!start){toast('Título e data de início são obrigatórios.','warning');return;}
  try{
    await KanawaCloud.createMeeting({title,agenda:$('meetAgenda').value,startsAt:new Date(start).toISOString(),endsAt:$('meetEnd').value?new Date($('meetEnd').value).toISOString():null,location:$('meetLocation').value,meetingUrl:$('meetUrl').value,attendees:$('meetAttendees').value.split(',').map(x=>x.trim()).filter(Boolean)});
    toast('Reunião registada e participantes convidados.','success');closeModal();openModule('reunioes');
  }catch(e){toast(e.message||'Não foi possível criar a reunião.','danger');}
}

/* ====== INTERNAL COMMUNICATION ====== */
async function renderComunicacao(){
  let msgs=[],files=[];try{[msgs,files]=await Promise.all([KanawaCloud.listInternalMessages(),KanawaCloud.listSharedFiles()]);}catch(e){console.warn(e);}
  return header('Comunicação Interna',msgs.length+' mensagens e '+files.length+' ficheiros partilhados','var(--info)','','fa-comments')+
    '<div class="card"><h3>Conversas e comunicados</h3><div style="max-height:430px;overflow:auto">'+(msgs.length?msgs.slice().reverse().map(m=>'<div style="padding:10px;border-bottom:1px solid var(--border)"><strong>'+esc(String(m.sender_user_id||'Colaborador').slice(0,8))+'</strong> <small style="color:var(--text-muted)">'+fmtD(m.created_at)+'</small><div>'+esc(m.body||'')+'</div></div>').join(''):emptyState('fa-comments','Ainda não existem mensagens'))+'</div><div class="form-group" style="margin-top:12px"><label>Mensagem para a equipa</label><textarea id="chatMessage" rows="3" placeholder="Escreva uma mensagem ou comunicado…"></textarea></div><div class="form-group"><label>Canal</label><select id="chatChannel"><option>Geral</option><option>Direcção</option><option>Financeiro</option><option>Recursos Humanos</option><option>Operações</option><option>Produção</option></select></div><button class="btn btn-primary" onclick="enviarMensagemInterna()">Enviar mensagem</button></div>'+
    '<div class="card"><h3>Partilha segura de ficheiros</h3><div class="form-group"><label>Nome do ficheiro / assunto</label><input id="shareTitle"></div><div class="form-group"><label>Descrição</label><input id="shareDescription"></div><div class="form-group"><label>Ficheiro PDF, imagem ou documento (máx. 15 MB)</label><input id="shareFile" type="file" accept=".pdf,image/jpeg,image/png,image/webp"></div><button class="btn btn-primary" onclick="partilharFicheiroEmpresa()">Carregar e partilhar com a empresa</button>'+table(['Ficheiro','Categoria','Data','Acção'],files.map(x=>[esc(x.title),esc(x.category||'Geral'),fmtD(x.created_at),'<button class="btn btn-sm btn-info" onclick="abrirFicheiroPartilhado(\''+esc(x.file_path)+'\')">Abrir</button>']))+'</div>';
}
async function enviarMensagemInterna(){
  const text=$('chatMessage').value.trim();if(!text){toast('Escreva uma mensagem.','warning');return;}
  try{await KanawaCloud.sendInternalMessage('['+$('chatChannel').value+'] '+text);toast('Mensagem enviada à empresa.','success');openModule('comunicacao');}
  catch(e){toast(e.message||'Não foi possível enviar.','danger');}
}
async function partilharFicheiroEmpresa(){
  const file=$('shareFile').files[0];if(!file){toast('Seleccione um ficheiro.','warning');return;}
  try{const path=await KanawaCloud.uploadPrivateFile('ks-shared-files',file,'shared');
    await KanawaCloud.createSharedFile({title:$('shareTitle').value.trim()||file.name,description:$('shareDescription').value,filePath:path,category:'Partilha interna'});
    toast('Ficheiro partilhado com segurança.','success');openModule('comunicacao');
  }catch(e){toast(e.message||'Não foi possível partilhar o ficheiro.','danger');}
}
async function abrirFicheiroPartilhado(path){
  try{const url=await KanawaCloud.getPrivateFileUrl('ks-shared-files',path);window.open(url,'_blank','noopener');}
  catch(e){toast(e.message||'Não foi possível abrir o ficheiro.','danger');}
}

/* ====== APPROVALS, DEPARTMENTS AND BUDGETS ====== */
async function renderAprovacoesEmpresa(){const rows=await getData('aprovacoes');return header('Centro de Aprovações',rows.length+' pedidos','var(--warning)','', 'fa-clipboard-check')+'<div class="card">'+table(['Pedido','Solicitante','Valor','Data','Estado','Acção'],rows.map(x=>[esc(x.titulo||x.tipo||'-'),esc(x.solicitante||'-'),fmt(x.valor||0),fmtD(x.data),badge(x.status||'pendente','warning'),x.status==='pendente'?'<button class="btn btn-sm btn-success" onclick="decidirAprovacao('+x.id+',\'aprovado\')">Aprovar</button> <button class="btn btn-sm btn-danger" onclick="decidirAprovacao('+x.id+',\'rejeitado\')">Rejeitar</button>':'-']))+'</div>';}
async function decidirAprovacao(id,status){const x=await DB.get('aprovacoes',id);if(!x)return;x.status=status;x.decididoEm=now();await saveData('aprovacoes',x);toast('Pedido '+status,'success');openModule('aprovacoes-empresa');}
async function renderDepartamentosEmpresa(){
  let rows=[];try{rows=await KanawaCloud.listDepartments();}catch(e){console.warn(e);}
  return header('Departamentos e Estrutura',rows.length+' departamentos','var(--primary)','<button class="btn btn-success" onclick="novoDepartamentoEmpresa()">Novo departamento</button>','fa-sitemap')+'<div class="card">'+table(['Código','Departamento','Responsável','Estado'],rows.map(x=>[esc(x.code||'-'),'<strong>'+esc(x.name)+'</strong>',esc(x.manager_user_id||'-'),badge(x.status||'active','success')]))+'</div>';
}
async function novoDepartamentoEmpresa(){
  const n=prompt('Nome do departamento:');if(!n)return;
  const code=prompt('Código (opcional):')||'';
  try{await KanawaCloud.createDepartment({name:n,code});toast('Departamento criado.','success');openModule('departamentos-empresa');}
  catch(e){toast(e.message||'Não foi possível criar departamento.','danger');}
}
async function renderOrcamentoEmpresa(){
  let rows=[];try{rows=await KanawaCloud.listBudgets();}catch(e){console.warn(e);}
  const total=rows.reduce((s,x)=>s+Number(x.approved_amount||0),0);
  return header('Orçamento Empresarial','Planeamento anual e controlo de custos','var(--success)','<button class="btn btn-success" onclick="novoOrcamentoEmpresa()">Novo orçamento</button>','fa-chart-pie')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Orçamentos</div><div class="value">'+rows.length+'</div></div><div class="metric-card"><div class="label">Valor planeado</div><div class="value">'+fmt(total)+'</div></div></div>'+
    '<div class="card">'+table(['Nome','Ano','Período','Valor','Estado'],rows.map(x=>[esc(x.name),x.fiscal_year,esc(x.period_type),fmt(x.approved_amount),badge(x.status,'info')]))+'</div>';
}
async function novoOrcamentoEmpresa(){
  const nome=prompt('Nome do orçamento:');if(!nome)return;
  const valor=Number(prompt('Valor total em Kz:','0'))||0;
  try{await KanawaCloud.createBudget({name:nome,fiscalYear:new Date().getFullYear(),amount:valor});toast('Orçamento criado.','success');openModule('orcamento-empresa');}
  catch(e){toast(e.message||'Não foi possível criar orçamento.','danger');}
}

async function abrirComprovativoPagamento(path){
  if(!path){toast('Sem comprovativo anexado.','warning');return;}
  try{const url=await KanawaCloud.getPrivateFileUrl('ks-payment-proofs',path);window.open(url,'_blank','noopener');}
  catch(e){toast(e.message||'Não foi possível abrir o comprovativo.','danger');}
}
async function emitirChaveVitaliciaInterna(){
  if(!KanawaCloud.context||!KanawaCloud.context.isPlatformAdmin){
    toast('Apenas o proprietário da plataforma pode gerar esta licença.','warning');return;
  }
  if(!confirm('Gerar uma chave vitalícia interna para utilização da D.PEDRO SOLUÇÕES? A chave será apresentada apenas uma vez.'))return;
  try{
    const result=await KanawaCloud.issueLicenseKeyByTerm('internal_lifetime','lifetime_internal',null);
    openModal('Chave vitalícia interna emitida','<div style="padding:12px;background:var(--bg);border-radius:10px"><p><strong>Guarde esta chave agora. Ela não será apresentada novamente.</strong></p><h3 style="letter-spacing:.08em;overflow-wrap:anywhere">'+esc(result.license_key)+'</h3><p>Licença interna · Vitalícia · A chave pode ser activada uma única vez na empresa do proprietário.</p><button class="btn btn-primary" onclick="navigator.clipboard.writeText(\''+esc(result.license_key)+'\').then(()=>toast(\'Chave copiada\',\'success\'))">Copiar chave</button></div>');
    toast('Chave vitalícia interna criada e guardada de forma protegida na base de dados.','success');
  }catch(e){toast(e.message||'Não foi possível gerar a chave vitalícia.','danger');}
}
async function emitirChavePedido(plan,termCode,requestId){
  const termName=({weekly:'7 dias',monthly:'1 mês',annual:'1 ano',two_year:'2 anos',three_year:'3 anos'}[termCode]||termCode);
  if(!confirm('Confirma que verificou o pagamento e pretende emitir uma chave '+plan+' por '+termName+'?'))return;
  try{
    const result=await KanawaCloud.issueLicenseKeyByTerm(plan,termCode,requestId);
    const durationLabel=result.is_lifetime?'Vitalícia':(Number(result.duration_days)>0?result.duration_days+' dias':result.duration_months+' meses');
    openModal('Chave de licença emitida','<div style="padding:12px;background:var(--bg);border-radius:10px"><p><strong>Copie esta chave agora. Ela não será mostrada novamente.</strong></p><h3 style="letter-spacing:.08em;overflow-wrap:anywhere">'+esc(result.license_key)+'</h3><p>Pacote: '+esc(result.plan_code)+' · Duração: '+esc(durationLabel)+' · Limite: '+Number(result.max_invoices_period).toLocaleString('pt-AO')+' facturas/mês</p><button class="btn btn-primary" onclick="navigator.clipboard.writeText(\''+esc(result.license_key)+'\').then(()=>toast(\'Chave copiada\',\'success\'))">Copiar chave</button></div>');
    toast('Chave emitida. Envie-a ao cliente por canal seguro.','success');
  }catch(e){toast(e.message||'Não foi possível emitir a chave.','danger');}
}

/* ====== ANGOLA PAYROLL ENGINE ====== */
function calcularDireitoFerias(employee){
  const start=new Date(employee.dataContratacao||employee.dataInicio||new Date().toISOString().slice(0,10));
  if(Number.isNaN(start.getTime()))return 0;
  const today=new Date(),year=today.getFullYear();
  if(start.getFullYear()===year){
    let months=(today.getFullYear()-start.getFullYear())*12+(today.getMonth()-start.getMonth());
    if(today.getDate()<start.getDate())months--;
    return Math.max(0,Math.min(22,months*2));
  }
  return start.getFullYear()<year?22:0;
}
function calcularRemuneracaoAO(employee) {
  const base=Number(employee.salario||0),bonus=Number(employee.bonus||0);
  const transport=Number(employee.subsidioTransporte||0),meal=Number(employee.subsidioAlimentacao||0);
  const holiday=Number(employee.subsidioFerias||0),christmas=Number(employee.subsidioNatal||0);
  const family=Number(employee.abonoFamilia||0),housing=Number(employee.subsidioRenda||0);
  const rent=Number(employee.valorRenda||0);
  const gross=base+bonus+transport+meal+holiday+christmas+family+housing;

  // CIRT (Lei 18/14, alterada pela Lei 28/20): alimentação e transporte têm limites separados;
  // o abono de família não está sujeito até 5% do salário-base.
  const nonSubjectMeal=Math.min(meal,30000);
  const nonSubjectTransport=Math.min(transport,30000);
  const nonSubjectFamily=Math.min(family,base*0.05);
  // O subsídio de renda integra os rendimentos até 50% do contrato de arrendamento, quando entregue.
  const taxableHousing=employee.contratoRendaEntregue?Math.min(housing,rent*0.5):housing;
  const taxableRemuneration=base+bonus+holiday+christmas+taxableHousing+
    Math.max(0,transport-nonSubjectTransport)+Math.max(0,meal-nonSubjectMeal)+Math.max(0,family-nonSubjectFamily);

  // A base de INSS pode ser ajustada pela entidade conforme a incidência contributiva aplicável.
  const inssBase=Math.max(0,Number(employee.baseINSS||base+bonus+holiday+christmas));
  const employeeInss=Math.round(inssBase*0.03*100)/100;
  const employerInss=Math.round(inssBase*0.08*100)/100;
  const taxableBase=Math.max(0,taxableRemuneration-employeeInss);
  const irtResult=calcIRT(taxableBase);
  const irt=Number(irtResult.irt||0);
  return {gross,irt,irtBase:taxableBase,irtFaixa:irtResult.faixa,employeeInss,employerInss,net:Math.max(0,gross-irt-employeeInss),bonus,
    allowances:transport+meal+holiday+christmas+family+housing,
    nonSubjectAllowances:nonSubjectMeal+nonSubjectTransport+nonSubjectFamily,
    taxableRemuneration,inssBase};
}
async function renderFolhaSalarial(){
  const staff=(await getData('funcionarios')).filter(x=>x.status!=='inactivo');
  const rows=staff.map(x=>{const p=calcularRemuneracaoAO(x);return[esc(x.nome),fmt(x.salario||0),fmt(x.bonus||0),fmt(p.gross),fmt(p.irt),fmt(p.employeeInss),'<strong>'+fmt(p.net)+'</strong>'];});
  const totals=staff.reduce((s,x)=>{const p=calcularRemuneracaoAO(x);s.gross+=p.gross;s.irt+=p.irt;s.inss+=p.employeeInss;s.net+=p.net;s.employer+=p.employerInss;return s;},{gross:0,irt:0,inss:0,net:0,employer:0});
  const history=await getData('folhasPagamento');
  return header('Processamento Salarial','Folha mensal, bónus, subsídios, IRT e INSS','var(--success)','<button class="btn btn-success" onclick="processarFolhaSalarial()">Calcular e fechar folha</button>','fa-money-check-alt')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Remuneração bruta</div><div class="value">'+fmt(totals.gross)+'</div></div><div class="metric-card"><div class="label">IRT estimado</div><div class="value">'+fmt(totals.irt)+'</div></div><div class="metric-card"><div class="label">INSS trabalhador (3%)</div><div class="value">'+fmt(totals.inss)+'</div></div><div class="metric-card"><div class="label">Custo empregador + INSS (8%)</div><div class="value">'+fmt(totals.gross+totals.employer)+'</div></div></div>'+
    '<div class="card"><p style="font-size:.8rem;color:var(--text-muted)">Estimativa do regime geral: 3% trabalhador e 8% empregador, com base de incidência sujeita à lei e ao regime de cada trabalhador. O IRT utiliza a tabela configurada no sistema. Validar a folha e os casos especiais antes de pagar ou declarar.</p>'+table(['Trabalhador','Base','Bónus','Bruto','IRT','INSS 3%','Líquido estimado'],rows)+'</div>'+
    '<div class="card"><h3>Folhas processadas</h3>'+table(['Período','Funcionários','Bruto','Líquido','Data'],history.map(x=>[esc(x.periodo),x.quantidade,fmt(x.bruto),fmt(x.liquido),fmtD(x.data)]))+'</div>';
}
async function processarFolhaSalarial(){
  const staff=(await getData('funcionarios')).filter(x=>x.status!=='inactivo');
  if(!staff.length){toast('Cadastre funcionários antes de processar a folha.','warning');return;}
  const nowDate=new Date(),start=new Date(nowDate.getFullYear(),nowDate.getMonth(),1),end=new Date(nowDate.getFullYear(),nowDate.getMonth()+1,0);
  const items=[];
  for(const emp of staff){
    let remoteId=emp.cloud_id;
    if(!remoteId){
      const remote=await KanawaCloud.upsertEmployee({employeeNumber:'EMP-'+emp.id,fullName:emp.nome,email:emp.email,phone:emp.telefone,taxId:emp.nif,department:emp.departamento,jobTitle:emp.cargo,hireDate:emp.dataContratacao,salary:emp.salario,status:'active'});
      remoteId=remote.id;emp.cloud_id=remoteId;await DB.put('funcionarios',emp);
    }
    const p=calcularRemuneracaoAO(emp);items.push({employeeId:remoteId,gross:p.gross,irt:p.irt,employeeInss:p.employeeInss,employerInss:p.employerInss,net:p.net,bonus:p.bonus,allowances:p.allowances});
  }
  const gross=items.reduce((s,x)=>s+x.gross,0),net=items.reduce((s,x)=>s+x.net,0),deductions=gross-net;
  try{
    await KanawaCloud.savePayrollRun({periodStart:start.toISOString().slice(0,10),periodEnd:end.toISOString().slice(0,10),grossTotal:gross,deductionsTotal:deductions,netTotal:net,items});
    await saveData('folhasPagamento',{periodo:start.toLocaleDateString('pt-AO',{month:'long',year:'numeric'}),quantidade:items.length,bruto:gross,liquido:net,data:now()});
    toast('Folha salarial processada e guardada com sucesso.','success');openModule('folha-salarial');
  }catch(e){toast(e.message||'Não foi possível processar a folha.','danger');}
}
