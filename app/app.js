'use strict';
/* KANAWA SOFT ERP 1.0 — aplicação principal unificada (perfil, AGT, firma, gaveta, impressora, líquido, produção, logística, ecommerce, RH, projetos, ativos, frota, OS, tickets, contratos, docs, auditoria, e-learning, CRM, marketing, integrações, dispositivos). */

const APP_VERSION = '1.0.0';
const IS_DESKTOP = !!(window.kanawaNative && window.kanawaNative.isDesktop);
let API_ONLINE = false;
let setupStep = 1;
let currentModule = 'dashboard';
let moduleRenderSequence = 0;
let scanner = null, scannerActive = false, scannerCallback = null;
let scannerProcessing = false, scannerLastCode = '', scannerLastAt = 0;
let syncTimer = null;
let pdvPendingFinalSale = null;
let pdvFinalizing = false;
let pdvSelectedItemId = null;
let pdvState = { screen: 1, carrinho: [], cliente: { nome: 'Cliente Anônimo', nif: '', telefone: '', endereco: '' }, pagamento: 'dinheiro', desconto: 0, valorRecebido: 0, aplicarIVA: true, regime: 'geral', observacoes: '' };
let pdvCache = { produtos: [], favoritos: JSON.parse(localStorage.getItem('kanawa_favoritos') || '[]'), ts: 0 };
let kanawaCommercialPolicy = null;
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
const KANAWA_LOADING_GREETINGS = {
  pt: ['Bom dia', 'Boa tarde', 'Boa noite'], en: ['Good morning', 'Good afternoon', 'Good evening'],
  fr: ['Bonjour', 'Bon après-midi', 'Bonsoir'], es: ['Buenos días', 'Buenas tardes', 'Buenas noches'],
  zh: ['早上好', '下午好', '晚上好'], ar: ['صباح الخير', 'مساء الخير', 'مساء الخير'],
  ln: ['Mbote na tongo', 'Mbote na midi', 'Mbote na pokwa'], cjk: ['Menekenu', 'Menekenu', 'Menekenu'],
  umb: ['Omele iwa', 'Utanya uwa', 'Uteke uwa'], kmb: ['Uazekele kiebi?', 'Kiambote', "Usuk'ó"],
  kon: ['Lumbu Kiambote', 'Kiambote', 'Nkokela yambote']
};
const KANAWA_LOADING_LANGUAGE_NAMES = ['Português','English','Français','Español','中文','العربية','Lingála','Cokwe','Umbundu','Kimbundu','Kikongo'];
let kanawaGreetingTimer = null;
function kanawaGreetingPeriod() {
  let hour = new Date().getHours();
  try { hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Luanda',hour:'2-digit',hour12:false}).format(new Date())); } catch (e) {}
  return hour >= 5 && hour < 12 ? 0 : (hour >= 12 && hour < 18 ? 1 : 2);
}
function kanawaStartLoadingGreetings() {
  const target = $('loadingGreeting'); if (!target) return;
  if (kanawaGreetingTimer) clearInterval(kanawaGreetingTimer);
  const codes = ['pt','en','fr','es','zh','ar','ln','cjk','umb','kmb','kon']; let index = 0;
  const paint = () => { const code = codes[index % codes.length]; target.textContent = KANAWA_LOADING_LANGUAGE_NAMES[index % KANAWA_LOADING_LANGUAGE_NAMES.length] + ' · ' + KANAWA_LOADING_GREETINGS[code][kanawaGreetingPeriod()]; target.setAttribute('lang',code); target.setAttribute('dir',code === 'ar' ? 'rtl' : 'auto'); index++; };
  paint(); kanawaGreetingTimer = setInterval(paint,850);
}
function showLoadingScreen(message) {
  const screen = $('loadingScreen'); if (screen) screen.classList.remove('hidden');
  const status = $('loadingStatus'); if (status && message) status.textContent = message;
  kanawaStartLoadingGreetings();
}
function setLoadingStatus(message) { const status = $('loadingStatus'); if (status && message) status.textContent = message; }
function hideLoadingScreen() {
  const screen = $('loadingScreen'); if (screen) screen.classList.add('hidden');
  if (kanawaGreetingTimer) { clearInterval(kanawaGreetingTimer); kanawaGreetingTimer = null; }
}

const now = () => new Date().toISOString();
const copy = o => JSON.parse(JSON.stringify(o));
const formatCurrency = fmt, formatDate = fmtD, formatDateTime = fmtDT, formatarData = fmtD, formatarNumero = fmtN, generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
function generateUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
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
  const topbar = document.querySelector('#app .topbar');
  if (topbar && topbar.offsetHeight > 0) root.style.setProperty('--kanawa-topbar-height', topbar.offsetHeight + 'px');
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
function aplicarTema(tema) {
  const escolhido = tema === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', escolhido);
  const ic = $('themeIcon'); if (ic) ic.className = escolhido === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('kanawa_theme', escolhido);
  if ($('modalOverlay')?.classList.contains('active')) closeModal();
  toast('Tema ' + (escolhido === 'dark' ? 'escuro' : 'claro') + ' aplicado.', 'success');
}
function abrirSeletorTema() {
  const atual = document.documentElement.getAttribute('data-theme') || 'light';
  const opcoes = [
    {id:'light',nome:'Tema claro',descricao:'Fundo claro e leitura tradicional',icone:'fa-sun'},
    {id:'dark',nome:'Tema escuro',descricao:'Fundo escuro para ambientes com pouca luz',icone:'fa-moon'}
  ];
  const conteudo = '<div class="kanawa-theme-options">' + opcoes.map(op =>
    '<button type="button" class="kanawa-theme-option'+(atual===op.id?' is-selected':'')+'" onclick="aplicarTema(&quot;'+op.id+'&quot;)"><span class="kanawa-theme-option-icon"><i class="fas '+op.icone+'"></i></span><span><strong>'+op.nome+'</strong><small>'+op.descricao+'</small></span><i class="fas '+(atual===op.id?'fa-check-circle':'fa-circle')+' kanawa-theme-check"></i></button>'
  ).join('') + '</div>';
  openModal('Escolher tema', conteudo, false);
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  aplicarTema(isDark ? 'light' : 'dark');
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
  'produtos','clientes','fornecedores','vendas','compras','estoque','contasReceber','contasPagar','funcionarios','categorias','projetos','tarefas','ativos','frotas','ordensServico','notificacoes','documentos','mensagens','cursos','leads','campanhas','eventos','devolucoes','faturas','pagamentos','empresas','usuarios','movimentacoesEstoque','estoqueArmazens','promocoes','ecommerce','auditoria','orcamentos','transportadoras','contratos','aprovacoes','sincronizacao','tickets','dispositivos','_sync_queue',
  'producao','ordensProducao','mrp','boms','custosProducao','controleQualidade','planosProducao','planoContas','budgets','forecasts','conciliacoes','transacoesBancarias','previsoesVendas','tendencias','folhasPagamento','turnos','ferias','vagas','candidatos','desempenhoRH','beneficios','planosCarreira','onboarding','pontoDigital','rescisoes','automacoes','scoreLeads','campanhasMarketing','segmentacoes','cupons','fidelidade','ganttProjetos','timesheets','manutencoes','ordensManutencao','garantias','pecasEstoque','checklistsInspecao','calendarioManutencoes','gpsTracking','abastecimentos','configuracoesFatura','empresaConfig','multas','tecnicos','roteirizacao','etiquetas','transferencias','inventarios','lotes','rastreios','recebimentos','ecommerceProdutos','ecommerceCarrinhos','ecommercePedidos','avaliacoes','pagamentosEcommerce','vendasConsignadas','tabelasPrecos','assinaturasDigitais','documentosFiscais','certificacoes','quizzes','mensagensChat','mensagensWhatsApp','eventosCalendar','unidades','servicos','clientesPortal','acessos','politicasSenha','tentativasLogin','sessoes','sms2FA','integracoesAGT','ivas','irts','backups','backupsAgendados','backupsNuvem','audiobooks','ddgHistorico','bingHistorico','dashboardsCustom','modulosPersonalizados','departamentos','frequencias','feriasFuncionarios','pagamentosFuncionarios','motoristas','manutencoesAtivos','depreciacoes','historicoOS','contatosWhatsApp','templatesWhatsApp','carrinhosSalvos','feedbacks','logsSeguranca','seguranca','migracoes','tarefasProjetos','membrosProjetos','atividadesProjetos','gruposUsuarios','config','armazens','centrosTrabalho','roteirosProducao','operacoesProducao','paradasProducao','manutencaoEquipamentos','subprodutosProducao','rastreabilidadeProducao','execucoesProducao'
];
let lastGeneratedRecordId = 0;
function nextGeneratedRecordId() {
  const candidate = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  lastGeneratedRecordId = Math.max(candidate, lastGeneratedRecordId + 1);
  return lastGeneratedRecordId;
}
const DB = {
  name: 'kanawa_erp_v15', version: 10, db: null, stores: DB_STORES,
  init() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeout = null;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        callback(value);
      };
      let req;
      try {
        if (!window.indexedDB) throw new Error('O navegador não disponibilizou o armazenamento local (IndexedDB).');
        req = indexedDB.open(this.name, this.version);
      } catch (error) {
        finish(reject, error);
        return;
      }
      timeout = setTimeout(() => finish(reject, new Error('A base de dados local demorou demasiado a abrir. Feche outras abas do Kanawa Soft e tente novamente.')), 12000);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        DB_STORES.forEach(s => {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
        });
      };
      req.onsuccess = e => {
        const db = e.target.result;
        db.onversionchange = () => db.close();
        if (settled) { db.close(); return; }
        this.db = db;
        finish(resolve, db);
      };
      req.onerror = e => finish(reject, e.target.error || new Error('Não foi possível abrir a base de dados local.'));
      req.onblocked = () => finish(reject, new Error('A base de dados local está bloqueada por outra aba ou janela do Kanawa Soft. Feche as outras abas do sistema e recarregue esta página.'));
    });
  },
  _tx(s, m) {
    const mode = m || 'readonly';
    if (window.KANAWA_PREVIEW_READ_ONLY === true && mode === 'readwrite') {
      throw new Error('Modo de demonstração: gravações estão desactivadas nesta Preview.');
    }
    return this.db.transaction(s, mode).objectStore(s);
  },
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

const kanawaStoreRefreshes = new Map();
const kanawaStoreRefreshAt = new Map();
function kanawaMergeCachedMedia(store, remote, local) {
  const merged = Object.assign({}, remote || {}), cached = local || {};
  if (store === 'produtos' && !merged.imagem && typeof cached.imagem === 'string' && cached.imagem.startsWith('data:image/')) merged.imagem = cached.imagem;
  if (store === 'empresaConfig' && !merged.logo && typeof cached.logo === 'string' && cached.logo.startsWith('data:image/')) merged.logo = cached.logo;
  return merged;
}
async function refreshKanawaStore(store, companyId, includeMedia) {
  const key = String(companyId) + ':' + store;
  if (kanawaStoreRefreshes.has(key)) {
    const pending = kanawaStoreRefreshes.get(key);
    return includeMedia ? pending.then(() => refreshKanawaStore(store,companyId,true)) : pending;
  }
  const task = (async function () {
    const queue = await DB.getAll('_sync_queue');
    if (queue.some(x => !x.synced && x.entity === store && x.company_id === companyId)) return null;

    const cursorKey = 'kanawa_store_cursor:' + companyId + ':' + store;
    const previousCursor = localStorage.getItem(cursorKey);
    const syncStartedAt = new Date().toISOString();
    const remote = await KanawaCloud.getStoreDelta(store, previousCursor, includeMedia === true);
    if (!Array.isArray(remote)) return null;

    const latestQueue = await DB.getAll('_sync_queue');
    if (latestQueue.some(x => !x.synced && x.entity === store && x.company_id === companyId)) return null;

    // Only products and company settings carry large inline media that must be merged with cache.
    const local = ['produtos','empresaConfig'].includes(store) ? await DB.getAll(store) : [];
    const localById = new Map(local.map(row => [String(row.id),row]));
    if (!previousCursor) await DB.clear(store);

    let applied = 0;
    for (const row of remote) {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      const id = payload.id !== undefined ? payload.id : (/^\d+$/.test(String(row.record_id)) ? Number(row.record_id) : row.record_id);
      if (payload._deleted === true) await DB.del(store,id);
      else {
        const cached = localById.get(String(id));
        await DB.put(store,kanawaMergeCachedMedia(store,Object.assign({},payload,{id}),cached));
      }
      applied++;
      if (applied % 100 === 0) await new Promise(resolve => setTimeout(resolve,0));
    }

    localStorage.setItem(cursorKey,syncStartedAt);
    kanawaStoreRefreshAt.set(key,Date.now());
    return applied;
  })().finally(() => kanawaStoreRefreshes.delete(key));
  kanawaStoreRefreshes.set(key,task);
  return task;
}
async function getData(store, options) {
  options = options || {};
  try {
    const local = await DB.getAll(store);
    if (window.KanawaCloud && KanawaCloud.ready && !KanawaCloud.isLocalOnly(store)) {
      const companyId = KanawaCloud.context && KanawaCloud.context.company && KanawaCloud.context.company.id;
      if (companyId) {
        const key = String(companyId) + ':' + store, ttl = store === 'produtos' ? 8000 : 15000;
        if (options.force === true || Date.now() - (kanawaStoreRefreshAt.get(key) || 0) > ttl) {
          const refresh = refreshKanawaStore(store,companyId,options.includeMedia === true);
          if (!local.length || options.waitForCloud === true) await refresh;
          else refresh.catch(error => console.warn('Kanawa cloud refresh:',store,error));
        }
      }
    }
    return await DB.getAll(store);
  } catch (e) { console.warn('getData:', store, e); return await DB.getAll(store).catch(() => []); }
}

function isCancelledSaleRecord(sale) {
  return ['cancelada','cancelado','anulada','anulado','cancelled','canceled','voided'].includes(String(sale&&sale.status||'').trim().toLowerCase());
}
function isFinalizedSaleRecord(sale) {
  return ['finalizada','finalizado'].includes(String(sale&&sale.status||'').trim().toLowerCase());
}
function moneyToCents(value) {
  const raw=String(value===null||value===undefined||value===''?'0':value).trim().replace(/\s/g,'').replace(',','.');
  const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if(!match)throw new Error('Valor monetário inválido: '+raw);
  const fraction=match[3]||'';
  if(fraction.length>2&&/[1-9]/.test(fraction.slice(2)))throw new Error('Valor com mais de duas casas decimais. O sistema não fará arredondamento automático.');
  const cents=BigInt(match[2])*100n+BigInt((fraction.slice(0,2)).padEnd(2,'0')||'0');
  return match[1]==='-'?-cents:cents;
}
function moneyCentsToNumber(cents){return Number(cents)/100;}
function sumMoneyCents(rows,getter){return (rows||[]).reduce((sum,row)=>sum+moneyToCents(getter(row)),0n);}
function saleTaxCents(sale){
  const value=sale.iva!==undefined&&sale.iva!==null?sale.iva:(sale.ivaTotal!==undefined&&sale.ivaTotal!==null?sale.ivaTotal:(sale.valorIVA!==undefined&&sale.valorIVA!==null?sale.valorIVA:0));
  return moneyToCents(value);
}
function saleBaseCents(sale){
  if(sale.baseIncidencia!==undefined&&sale.baseIncidencia!==null)return moneyToCents(sale.baseIncidencia);
  return moneyToCents(sale.subtotal!==undefined&&sale.subtotal!==null?sale.subtotal:(sale.total||0))-moneyToCents(sale.descontoValor||0);
}
function creditNoteTotalCents(note){return moneyToCents(note.total!==undefined?note.total:(note.valor||0));}
function creditNoteTaxCents(note){return moneyToCents(note.taxAmount!==undefined&&note.taxAmount!==null?note.taxAmount:(note.iva||0));}
function creditNoteBaseCents(note){return note.taxableBase!==undefined&&note.taxableBase!==null?moneyToCents(note.taxableBase):creditNoteTotalCents(note)-creditNoteTaxCents(note);}
function isIssuedCreditNote(note){return String(note&&note.status||'').toLowerCase()==='credit_note_issued';}
async function getIssuedCreditNotes(){
  const localReturns=await getData('devolucoes');
  let ledgerReturns=[];
  if(window.KanawaCloud&&KanawaCloud.ready&&typeof KanawaCloud.getSalesCreditNotes==='function'){
    try{
      ledgerReturns=await KanawaCloud.getSalesCreditNotes();
      for(const note of ledgerReturns)await DB.put('devolucoes',note);
    }catch(error){console.warn('Notas de crédito do livro fiscal indisponíveis neste momento:',error);}
  }
  const byDocument=new Map();
  for(const note of [...localReturns,...ledgerReturns]){
    if(!isIssuedCreditNote(note))continue;
    byDocument.set(String(note.notaCredito||note.id),note);
  }
  return Array.from(byDocument.values());
}
function dateIsInRange(value,range){
  if(!range||(!range.fromDate&&!range.toDate))return true;
  const date=String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  return (!range.fromDate||date>=range.fromDate)&&(!range.toDate||date<=range.toDate);
}
async function getOperationalSales(){return (await getData('vendas')).filter(sale=>!isCancelledSaleRecord(sale));}
async function getFiscalSalesSummary(range){
  const [allSales,issuedReturns]=await Promise.all([getData('vendas'),getIssuedCreditNotes()]);
  const creditedSaleIds=new Set(issuedReturns.map(note=>String(note.vendaId||note.saleId||'')));
  const sales=allSales.filter(sale=>(isFinalizedSaleRecord(sale)||creditedSaleIds.has(String(sale.id)))&&(!isCancelledSaleRecord(sale)||creditedSaleIds.has(String(sale.id)))&&dateIsInRange(sale.data||sale.sold_at||sale.created_at,range));
  const returns=issuedReturns.filter(note=>dateIsInRange(note.data||note.issued_at||note.created_at,range));
  const grossTotalCents=sumMoneyCents(sales,sale=>sale.total||0);
  const grossTaxCents=sales.reduce((sum,sale)=>sum+saleTaxCents(sale),0n);
  const grossBaseCents=sales.reduce((sum,sale)=>sum+saleBaseCents(sale),0n);
  const returnsTotalCents=returns.reduce((sum,note)=>sum+creditNoteTotalCents(note),0n);
  const returnsTaxCents=returns.reduce((sum,note)=>sum+creditNoteTaxCents(note),0n);
  const returnsBaseCents=returns.reduce((sum,note)=>sum+creditNoteBaseCents(note),0n);
  const hasSalesVat=sales.some(sale=>sale.iva!==undefined&&sale.iva!==null||sale.ivaTotal!==undefined&&sale.ivaTotal!==null||sale.valorIVA!==undefined&&sale.valorIVA!==null)||returns.some(note=>note.taxAmount!==undefined||note.iva!==undefined);
  return {sales,returns,creditNotesCount:returns.length,hasSalesVat,grossTotalCents,grossTaxCents,grossBaseCents,
    netTotalCents:grossTotalCents-returnsTotalCents,netTaxCents:grossTaxCents-returnsTaxCents,netBaseCents:grossBaseCents-returnsBaseCents};
}
function isTransientCloudError(error){
  const message=String(error&&(error.message||error.msg)||error||'').toLowerCase();
  const status=Number(error&&(error.status||error.statusCode||(error.context&&error.context.status))||0);
  return (typeof navigator!=='undefined'&&navigator.onLine===false)||status===0||status>=500||/failed to fetch|networkerror|network error|load failed|timeout|timed out|econn|connection reset|temporarily unavailable|gateway/.test(message);
}
async function saveData(store, item, options) {
  const existed = !!item.id;
  const id = existed ? (await DB.put(store, item), item.id) : await DB.add(store, item);
  const record = Object.assign({}, item, { id: id });
  if (window.KanawaCloud && store === 'empresas' && KanawaCloud.ready) {
    try { await KanawaCloud.updateCompany(record); }
    catch (e) { console.warn('Atualização da empresa pendente:', e); }
  } else if (window.KanawaCloud && !KanawaCloud.isLocalOnly(store)) {
    if (KanawaCloud.ready && navigator.onLine && !(store === 'vendas' && item.status === 'pendente_sincronizacao')) {
      try { await KanawaCloud.upsertRecord(store, record, options || {}); Object.assign(item, record); if (store === 'vendas') await DB.put(store, item); }
      catch (e) {
        // A finalized invoice is only successful after server confirmation. Never queue it as a
        // completed sale: pdvFinalizarVenda retains the same external ID and invoice number for
        // an idempotent retry if the server committed but the response was lost.
        if (store === 'vendas' && item.status === 'finalizada' && isTransientCloudError(e)) {
          item.status = 'pendente_sincronizacao';
          record.status = 'pendente_sincronizacao';
          await DB.put(store, item);
          await queueSync(store, 'create', record, Object.assign({}, options || {}, { offlineSale: true }));
          console.warn('Venda guardada localmente; sincronização pendente:', e);
        } else if (store === 'vendas' && item.status === 'finalizada') {
          await DB.del(store, id);
          throw e;
        } else {
          await queueSync(store, existed ? 'update' : 'create', record, options || {});
          console.warn('Kanawa cloud write queued:', store, e);
        }
      }
    } else {
      if (store === 'vendas' && item.status === 'finalizada') {
        item.status = 'pendente_sincronizacao';
        record.status = 'pendente_sincronizacao';
        await DB.put(store, item);
      }
      await queueSync(store, store === 'vendas' ? 'create' : (existed ? 'update' : 'create'), record, options || {});
    }
  }
  if (store !== 'auditoria' && store !== '_sync_queue') {
    const actor = kanawaCurrentActor();
    const moduleByStore = { vendas:'vendas', produtos:'produtos', clientes:'clientes', fornecedores:'fornecedores', compras:'compras', movimentacoesEstoque:'estoque', contasReceber:'financeiro', contasPagar:'financeiro', orcamentos:'orcamentos', funcionarios:'rh', tarefas:'tarefas', ordensServico:'os', departamentos:'departamentos-empresa', custosProducao:'custos-producao', centrosTrabalho:'producao', roteirosProducao:'producao', operacoesProducao:'producao', paradasProducao:'producao', manutencaoEquipamentos:'producao', subprodutosProducao:'producao', rastreabilidadeProducao:'producao', execucoesProducao:'producao' };
    const details = { operation: existed ? 'update' : 'create', record_id: String(id), role: actor.roleLabel };
    if (store === 'vendas') Object.assign(details, {
      invoice: record.numeroFatura || null, customer: record.clienteNome || null, customer_address: record.clienteEndereco || null,
      total: Number(record.total) || 0, gross_profit: record.lucroBruto == null ? null : Number(record.lucroBruto),
      quantity: (record.itens || []).reduce((sum,line)=>sum+(Number(line.qty)||0),0),
      products: (record.itens || []).map(line=>({name:line.nome,quantity:Number(line.qty)||0,unit_price:Number(line.preco)||0})),
      payment: record.pagamento || null, status: record.status || null
    });
    else if (store === 'fornecedores') Object.assign(details, { supplier: record.nome || null });
    else Object.assign(details, { name: record.nome || record.titulo || record.descricao || record.produto || null, total: Number(record.total || record.valor) || null, status: record.status || null });
    try {
      if (window.KanawaCloud && KanawaCloud.ready && navigator.onLine && typeof KanawaCloud.logAuditEvent === 'function') {
        await KanawaCloud.logAuditEvent({ action: details.operation, resourceType: moduleByStore[store] || store, resourceId: String(id), details });
      } else {
        await DB.add('auditoria', { acao: details.operation, modulo: moduleByStore[store] || store, detalhes: details, usuario: actor.name, cargo: actor.roleLabel, data: now() });
      }
    } catch (auditError) { console.warn('Registo de auditoria pendente:', auditError); }
  }
  return id;
}

async function deleteData(store, id) {
  if (store === 'vendas') throw new Error('Vendas finalizadas são imutáveis. Use uma Nota de Crédito (NC) para rectificar ou anular.');
  await DB.del(store, id);
  if (window.KanawaCloud && !KanawaCloud.isLocalOnly(store)) {
    if (KanawaCloud.ready) {
      try { await KanawaCloud.deleteRecord(store, id); }
      catch (e) { await queueSync(store, 'delete', { id: id }); }
    } else {
      await queueSync(store, 'delete', { id: id });
    }
  }
  try { await registrarAuditoria('delete',store,{record_id:String(id)}); } catch(error) { console.warn('Auditoria de eliminação:',error); }
}

async function queueSync(entity, action, payload, options) {
  if (window.KanawaCloud && KanawaCloud.isLocalOnly(entity)) return;
  try {
    const context = window.KanawaCloud && KanawaCloud.context || null;
    const companyId = context && context.company && context.company.id ||
      localStorage.getItem('kanawa_cloud_company_id') || null;
    const userId = context && context.user && context.user.id || null;
    const existing=(await DB.getAll('_sync_queue')).find(entry=>!entry.synced&&entry.entity===entity&&entry.company_id===companyId&&entry.user_id===userId&&String(entry.payload&&entry.payload.id)===String(payload&&payload.id));
    if(existing){
      existing.action=entity==='vendas'?'create':action;
      existing.payload=payload;
      existing.options=options||{};
      existing.last_error=null;
      await DB.put('_sync_queue',existing);
      return existing.id;
    }
    const eventId = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : 'ks-event-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    return await DB.add('_sync_queue', {
      event_id: eventId, company_id: companyId, user_id: userId, entity: entity,
      action: action, payload: payload, options: options || {},
      created_at_client: new Date().toISOString(), data: now(), synced: false
    });
  } catch (e) {
    console.warn('Não foi possível guardar fila de sincronização:', e);
  }
}

async function updatePendingSaleReferences(sale,queueItems){
  const saleId=String(sale&&sale.id||''),invoice=sale&&sale.numeroFatura||null;
  if(!saleId||!invoice)return;
  const updateRecord=record=>{
    if(!record||String(record.saleId||record.vendaId||'')!==saleId)return false;
    record.numeroFatura=invoice;record.descricao='Venda '+invoice;
    if(record.status==='pendente_sincronizacao')record.status='pendente';
    return true;
  };
  for(const store of ['contasReceber','movimentacoesEstoque']){
    const records=await DB.getAll(store);
    for(const record of records)if(updateRecord(record))await DB.put(store,record);
  }
  for(const entry of queueItems||await DB.getAll('_sync_queue')){
    if(entry.entity!=='contasReceber'&&entry.entity!=='movimentacoesEstoque')continue;
    if(updateRecord(entry.payload))await DB.put('_sync_queue',entry);
  }
}
let syncQueueProcessing = false;
async function processSyncQueue() {
  if (syncQueueProcessing || !navigator.onLine || !window.KanawaCloud || !KanawaCloud.ready) return 0;
  const context = KanawaCloud.context || {};
  const companyId = context.company && context.company.id;
  const userId = context.user && context.user.id;
  if (!companyId || !userId) return 0;
  syncQueueProcessing = true;
  try {
    const queue = await DB.getAll('_sync_queue');
    const eligible = queue.filter(item =>
      !item.synced && item.company_id === companyId && item.user_id === userId
    ).sort((a, b) =>
      Date.parse(a.created_at_client || a.data || 0) - Date.parse(b.created_at_client || b.data || 0)
    );
    let sent = 0;
    const batchSize = 50;
    for (let offset = 0; offset < eligible.length; offset += batchSize) {
      const batch = eligible.slice(offset, offset + batchSize);
      for (const item of batch) {
        if (!navigator.onLine) return sent;
        try {
          if (item.action === 'delete') {
            await KanawaCloud.deleteRecord(item.entity, item.payload.id);
          } else if (item.entity === 'vendas' && item.payload && item.payload.status === 'pendente_sincronizacao') {
            const salePayload=Object.assign({},item.payload,{status:'finalizada'});
            if(typeof gerarAssinatura==='function')salePayload.assinatura=gerarAssinatura(salePayload);
            await KanawaCloud.upsertRecord('vendas',salePayload,item.options||{});
            await DB.put('vendas',salePayload);
            await updatePendingSaleReferences(salePayload,eligible);
            if(salePayload.cashSessionId&&typeof KanawaCloud.attachSaleContext==='function'){
              try{await KanawaCloud.attachSaleContext(String(salePayload.id),salePayload.cashSessionId,salePayload.clienteEndereco||'');}
              catch(contextError){console.warn('Contexto da venda sincronizada:',contextError);}
            }
          } else {
            await KanawaCloud.upsertRecord(item.entity,item.payload,item.options||{});
            if(item.entity==='vendas'&&item.payload)await DB.put('vendas',item.payload);
          }
          await DB.del('_sync_queue', item.id);
          sent++;
        } catch (e) {
          item.attempts = Number(item.attempts || 0) + 1;
          item.last_attempt_at = new Date().toISOString();
          item.last_error = String(e && e.message || e).slice(0, 500);
          await DB.put('_sync_queue', item);
          console.warn('Fila de sincronização mantida para nova tentativa:', item.entity, item.last_error);
          // Preserve chronological order: do not overtake a failed dependency.
          return sent;
        }
      }
    }
    return sent;
  } finally {
    syncQueueProcessing = false;
  }
}

async function pullFromServer() {
  if (!window.KanawaCloud || !KanawaCloud.ready) return 0;
  const activeCompanyId = KanawaCloud.context && KanawaCloud.context.company && KanawaCloud.context.company.id;
  if (!activeCompanyId) return 0;
  const cursorKey = 'kanawa_sync_cursor:' + activeCompanyId, previousCursor = localStorage.getItem(cursorKey);
  const syncStartedAt = new Date().toISOString();
  setLoadingStatus(previousCursor ? 'A sincronizar apenas as alterações...' : 'A preparar a primeira sincronização segura...');
  const records = await KanawaCloud.getAllRecords(previousCursor || null);
  const queue = await DB.getAll('_sync_queue'), dirty = new Set(queue.filter(x => !x.synced && x.company_id === activeCompanyId).map(x => x.entity));
  const mediaCache = new Map(); let total = 0;
  if (!previousCursor) {
    for (const store of ['produtos','empresaConfig']) {
      const cached = await DB.getAll(store); mediaCache.set(store,new Map(cached.map(row => [String(row.id),row])));
    }
    for (const store of DB_STORES) if (!KanawaCloud.isLocalOnly(store) && !dirty.has(store)) await DB.clear(store);
  }
  for (const row of records) {
    const store = row.store_key; if (KanawaCloud.isLocalOnly(store) || dirty.has(store)) continue;
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const id = payload.id !== undefined ? payload.id : (/^\d+$/.test(row.record_id) ? Number(row.record_id) : row.record_id);
    if (payload._deleted === true) await DB.del(store,id);
    else {
      const cached = mediaCache.get(store);
      await DB.put(store,kanawaMergeCachedMedia(store,Object.assign({},payload,{id}),cached && cached.get(String(id))));
      total++;
    }
    if (total > 0 && total % 100 === 0) await new Promise(resolve => setTimeout(resolve,0));
  }
  if (!dirty.size) localStorage.setItem(cursorKey,syncStartedAt);
  for (const store of DB_STORES) {
    if (!KanawaCloud.isLocalOnly(store) && !dirty.has(store)) {
      localStorage.setItem('kanawa_store_cursor:' + activeCompanyId + ':' + store,syncStartedAt);
    }
  }
  for (const store of ['produtos','empresaConfig']) kanawaStoreRefreshAt.set(String(activeCompanyId)+':'+store,Date.now());
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
    const remainingQueue = (await DB.getAll('_sync_queue')).filter(item => !item.synced);
    if (remainingQueue.length) {
      if (indicator) indicator.className = 'sync-indicator show offline';
      if (label) label.textContent = remainingQueue.length + ' operação(ões) offline pendente(s)';
      if (showMessage) toast('Sincronização parcial: ' + sent + ' enviadas, ' + remainingQueue.length + ' ainda pendentes. A fila só é enviada pela conta e empresa que originaram cada operação.', 'warning');
      return false;
    }
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
    if (navigator.onLine && window.KanawaCloud && KanawaCloud.ready) syncNow(false);
  }, 60000);
  if(!window.__kanawaNetworkSyncBound){
    window.__kanawaNetworkSyncBound=true;
    window.addEventListener('online',()=>{const indicator=$('syncIndicator'),label=$('syncText');if(indicator)indicator.className='sync-indicator show syncing';if(label)label.textContent='Internet restabelecida — a sincronizar';if(window.KanawaCloud&&KanawaCloud.ready)syncNow(false);});
    window.addEventListener('offline',()=>{const indicator=$('syncIndicator'),label=$('syncText');if(indicator)indicator.className='sync-indicator show offline';if(label)label.textContent='Sem internet — operações locais em fila';});
  }
  iniciarSincronizacaoAutomatica();
}

async function activateCloudSession(ctx, migrateLocal) {
  setLoadingStatus('A confirmar a ligação segura ao Supabase...');
  if (!window.KanawaCloud || !KanawaCloud.ready || !(await KanawaCloud.check())) throw new Error('A base de dados Supabase não está ligada. O acesso ao espaço de trabalho foi bloqueado até a ligação ser restabelecida.');
  const companyId = ctx.company.id;
  const previousCompanyId = localStorage.getItem('kanawa_cloud_company_id');
  const localOnly = new Set(['empresas','usuarios','config','dispositivos','sessoes','tentativasLogin','politicasSenha','sms2FA','acessos','logsSeguranca','seguranca','migracoes','_sync_queue']);

  if (previousCompanyId && previousCompanyId !== companyId) {
    // Keep queued events: their company/user scope prevents cross-tenant delivery.
    for (const store of DB_STORES) if (store !== '_sync_queue') await DB.clear(store);
    localStorage.setItem('kanawa_cloud_company_id', companyId);
    localStorage.removeItem('kanawa_legacy_company');
  } else if (previousCompanyId !== companyId) {
    let remoteRows = null;
    try { remoteRows = await KanawaCloud.getAllRecordKeys(); }
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
  updateResponsiveLayout();
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
function iniciarSincronizacaoAutomatica() {
  if(window.__kanawaAutoSyncBound)return;
  window.__kanawaAutoSyncBound=true;
  const run=()=>{if(navigator.onLine&&window.KanawaCloud&&KanawaCloud.ready)syncNow(false).catch(error=>console.warn('Sincronização automática:',error));};
  window.addEventListener('online',run);
  window.addEventListener('focus',run);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)run();});
  run();
}


/* ====== PERMISSÕES ====== */
// Convites suspensos até o backend validar invitation_code e associar o membro à empresa correcta.
const TEAM_INVITATIONS_ENABLED = true;
const PERMISSOES = {
  admin: { modulos: '*', acoes: ['criar','editar','excluir','ver','configurar','aprovar','cancelar','exportar','importar'], verFinanceiro: true, excluir: true, configurar: true, descontoMax: 100 },
  contabilista: { modulos: ['dashboard','idioma','contabilidade','fiscal','financeiro','relatorios','documentos','auditoria','tarefas','perfil','ativos','orcamentos','folha-salarial','despesas-gerais','notificacoes'], acoes: ['criar','editar','ver','exportar','aprovar'], verFinanceiro: true, excluir: false, configurar: false, descontoMax: 0 },
  gerente: { modulos: ['dashboard','idioma','usuarios','auditoria','caixa','pdv','vendas','produtos','categorias','ecommerce','estoque','compras','clientes','fornecedores','crm','financeiro','fiscal','contabilidade','rh','projetos','tarefas','ativos','frota','os','documentos','relatorios','notificacoes','orcamentos','transportadoras','contratos','tickets','perfil','dispositivos','producao','ordens-producao','mrp','bom','custos-producao','controle-qualidade','planos-producao','logistica-roteirizacao','logistica-etiquetas','logistica-picking','logistica-armazens','logistica-crossdocking','logistica-rastreio','ecommerce-vitrine','ecommerce-carrinho','ecommerce-pedidos','ecommerce-produtos','ecommerce-pagamento','ecommerce-rastreio','rh-recrutamento','rh-desempenho','rh-beneficios','rh-onboarding','rh-ponto','rh-rescisao','rh-plano-carreira','projetos-tarefas','projetos-kanban','projetos-gantt','projetos-recursos','projetos-timesheet','projetos-custos','projetos-riscos','ativos-depreciacao','ativos-manutencao','ativos-garantia','frota-manutencao','frota-rotas','frota-gps','frota-combustivel','frota-documentos','frota-multas','frota-desempenho','os-manutencao','os-checklist','os-calendario','os-tecnicos','produtos-avaliacoes','tabelas-precos','vendas-consignadas','vendas-promocoes','clientes-fidelidade','clientes-cupons','portal-cliente','clientes-segmentacao','crm-pipeline','crm-automacao','crm-score','crm-remarketing','marketing-campanhas','marketing-analise','empresa-legal','despesas-gerais','ferias-dispensas','agenda','reunioes','comunicacao','aprovacoes-empresa','departamentos-empresa','orcamento-empresa','rh-documentos','folha-salarial','elearning-cursos','elearning-certificacoes','elearning-quizzes','elearning-progresso','elearning-relatorios','servicos'], acoes: ['criar','editar','ver','aprovar','exportar'], verFinanceiro: true, excluir: false, configurar: false, descontoMax: 30 },
  operador: { modulos: ['dashboard','idioma','usuarios','auditoria','caixa','pdv','vendas','produtos','clientes','estoque','notificacoes','perfil','producao','ordens-producao','controle-qualidade','os','os-manutencao','os-checklist','os-calendario','agenda','reunioes','comunicacao','ferias-dispensas','projetos-tarefas','projetos-kanban','tarefas'], acoes: ['criar','ver','cancelar','aprovar'], verFinanceiro: false, excluir: false, configurar: false, descontoMax: 10 },
  caixa: { modulos: ['dashboard','idioma','caixa','pdv','vendas','notificacoes','perfil'], acoes: ['criar','ver'], verFinanceiro: false, excluir: false, configurar: false, descontoMax: 5 }
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
const MENU_PLAN_RANK={mini:1,standard:2,premium:3,enterprise:4,trial:4,internal_lifetime:4};
const MENU_MODULE_MIN_PLAN={
'ecommerce-vitrine':'standard','ecommerce-carrinho':'standard','ecommerce-pedidos':'standard','ecommerce-pagamento':'standard','ecommerce-rastreio':'standard','vendas-consignadas':'standard','vendas-promocoes':'standard','produtos-avaliacoes':'standard','tabelas-precos':'standard',
'logistica-roteirizacao':'standard','logistica-picking':'standard','logistica-crossdocking':'premium','logistica-etiquetas':'standard','logistica-rastreio':'standard','logistica-armazens':'standard',
'crm-automacao':'standard','crm-score':'standard','crm-remarketing':'standard','marketing-campanhas':'standard','marketing-analise':'standard','clientes-segmentacao':'standard','clientes-fidelidade':'standard','clientes-cupons':'standard','portal-cliente':'standard',
fiscal:'standard',contabilidade:'standard','orcamento-empresa':'standard','filiais':'enterprise',
rh:'standard','rh-recrutamento':'standard','rh-onboarding':'standard','rh-desempenho':'standard','rh-beneficios':'standard','rh-ponto':'standard','rh-rescisao':'standard','rh-plano-carreira':'standard','rh-documentos':'standard','folha-salarial':'standard','ferias-dispensas':'standard','departamentos-empresa':'standard',
projetos:'standard',tarefas:'standard','projetos-tarefas':'standard','projetos-kanban':'standard','projetos-gantt':'standard','projetos-recursos':'standard','projetos-timesheet':'standard','projetos-custos':'standard','projetos-riscos':'standard',
ativos:'premium','ativos-depreciacao':'premium','ativos-manutencao':'premium','ativos-garantia':'premium',frota:'premium','frota-manutencao':'premium','frota-rotas':'premium','frota-gps':'enterprise','frota-combustivel':'premium','frota-documentos':'premium','frota-multas':'premium','frota-desempenho':'premium',
producao:'premium','ordens-producao':'premium',mrp:'premium',bom:'premium','custos-producao':'premium','controle-qualidade':'premium','planos-producao':'premium',
os:'standard','os-manutencao':'standard','os-checklist':'standard','os-calendario':'standard','os-tecnicos':'standard',agenda:'standard',reunioes:'standard',comunicacao:'standard','aprovacoes-empresa':'standard',
contratos:'standard',documentos:'standard',tickets:'standard','empresa-legal':'standard',conformidade:'standard',dispositivos:'standard',integracoes:'enterprise',
'elearning-cursos':'premium','elearning-certificacoes':'premium','elearning-quizzes':'premium','elearning-progresso':'premium','elearning-relatorios':'premium'
};
function getKanawaPlanCode(){try{const license=JSON.parse(localStorage.getItem('kanawa_license')||'null')||{};const context=window.KanawaCloud&&KanawaCloud.context||{};return String(license.plan_code||context.plan_code||'').trim().toLowerCase();}catch(_){return '';}}
function getKanawaPlanRank(){return MENU_PLAN_RANK[getKanawaPlanCode()]||0;}
function getModuleRequiredPlan(moduleId){return MENU_MODULE_MIN_PLAN[moduleId]||'mini';}
function planoPermiteModulo(moduleId){const rank=getKanawaPlanRank();return !rank||rank>=(MENU_PLAN_RANK[getModuleRequiredPlan(moduleId)]||1);}
function mostrarUpsellModulo(moduleId){const item=MENU.find(entry=>entry.id===moduleId),required=getModuleRequiredPlan(moduleId),labels={standard:'Standard',premium:'Premium',enterprise:'Enterprise'},planName=labels[required]||'Mini';openModal('Funcionalidade disponível noutro plano','<div class="menu-upsell-content"><div class="menu-upsell-lock"><i class="fas fa-lock"></i></div><h3>'+esc(item&&item.label||'Este módulo')+'</h3><p>Esta funcionalidade está disponível a partir do plano <strong>'+esc(planName)+'</strong>.</p><p>Actualize a licença da sua empresa para desbloquear este módulo. Os dados existentes permanecem preservados.</p><button type="button" class="btn btn-primary" onclick="closeModal();openModule(\'licenca\')"><i class="fas fa-arrow-up"></i> Ver planos e fazer upgrade</button></div>',false);}
function podeFazer(action, moduleId) {
  const p = getPerms();
  if (p.modulos === '*') return true;
  const module = moduleId || currentModule;
  if (module && !podeAcessar(module)) return false;
  const override = module ? getModuleOverride(module,action) : null;
  if (override !== null) return override;
  return Array.isArray(p.acoes) && p.acoes.includes(action);
}


(function instalarEstilosVistasProjetos(){if(document.getElementById('kanawa-project-views-styles'))return;const style=document.createElement('style');style.id='kanawa-project-views-styles';style.textContent='.project-views-nav{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 16px;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:12px}.project-view-tab{display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text-muted);font:inherit;font-size:.8rem;font-weight:650;cursor:pointer}.project-view-tab.active{background:var(--primary);color:#fff}.project-view-tab.is-locked{border-style:dashed;opacity:.7}.project-view-tab.is-locked>i:last-child{color:var(--warning)}@media(max-width:600px){.project-views-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.project-view-tab{justify-content:center}}';document.head.appendChild(style);})();

/* ====== MENU ====== */
const MENU = [
  { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
  { id: 'caixa', icon: 'fa-cash-register', label: 'Abertura e Fecho de Caixa' },
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
  { id: 'filiais', icon: 'fa-code-branch', label: 'Empresas e Filiais' },
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
  { id: 'tarefas', icon: 'fa-tasks', label: 'Tarefas' },
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
  { id: 'idioma', icon: 'fa-language', label: 'Idioma do Sistema' },
  { id: 'dispositivos', icon: 'fa-print', label: 'Dispositivos' },
  { id: 'config', icon: 'fa-cog', label: 'Configurações' },
  { id: 'modulos', icon: 'fa-code', label: 'Módulos' }
];

const MENU_INTERNAL_TABS = {
 pdv:['caixa'],
 vendas:['orcamentos','ecommerce-vitrine','ecommerce-carrinho','ecommerce-pedidos','ecommerce-pagamento','ecommerce-rastreio'],
 produtos:['categorias','servicos','tabelas-precos','produtos-avaliacoes'],
 estoque:['logistica-armazens','logistica-roteirizacao','logistica-picking','logistica-crossdocking','logistica-etiquetas','logistica-rastreio'],
 compras:['fornecedores','transportadoras'],
 producao:['bom','planos-producao','ordens-producao','mrp','custos-producao','controle-qualidade'],
 clientes:['clientes-fidelidade','clientes-cupons','portal-cliente'],
 crm:['crm-pipeline','marketing-campanhas','crm-automacao','crm-remarketing','crm-score','clientes-segmentacao','marketing-analise'],
 financeiro:['despesas-gerais','orcamento-empresa','contabilidade'], fiscal:[],
 rh:['rh-recrutamento','rh-onboarding','departamentos-empresa','rh-documentos','rh-ponto','ferias-dispensas','folha-salarial','rh-beneficios','rh-desempenho','rh-plano-carreira','rh-rescisao'],
 projetos:['tarefas','projetos-kanban','projetos-gantt','projetos-timesheet','projetos-custos','projetos-riscos','projetos-recursos'],
 os:['os-manutencao','os-checklist','os-tecnicos','os-calendario','agenda','reunioes','comunicacao','aprovacoes-empresa'],
 ativos:['ativos-manutencao','ativos-depreciacao','ativos-garantia'],
 frota:['frota-manutencao','frota-rotas','frota-gps','frota-combustivel','frota-documentos','frota-multas','frota-desempenho'],
 documentos:['contratos','empresa-legal'], tickets:[],
 config:['usuarios','auditoria','dispositivos','licenca','integracoes','filiais','perfil','relatorios','modulos','conformidade'],
 'elearning-cursos':['elearning-quizzes','elearning-progresso','elearning-certificacoes','elearning-relatorios']
};
const MENU_GROUP_DEFINITIONS=[
 {id:'vendas',label:'Vendas e Canais',icon:'fa-cash-register',sections:[{label:'ATALHOS PRINCIPAIS',ids:['pdv','vendas']}]},
 {id:'produtos',label:'Produtos e Logística',icon:'fa-boxes',sections:[{label:'ATALHOS PRINCIPAIS',ids:['produtos','estoque','compras']}]},
 {id:'producao',label:'Produção e MRP',icon:'fa-industry',sections:[{label:'ATALHOS PRINCIPAIS',ids:['producao']}]},
 {id:'clientes',label:'Clientes e CRM',icon:'fa-users',sections:[{label:'ATALHOS PRINCIPAIS',ids:['clientes','crm']}]},
 {id:'financeiro',label:'Financeiro e Contabilidade',icon:'fa-coins',sections:[{label:'ATALHOS PRINCIPAIS',ids:['financeiro','fiscal']}]},
 {id:'rh',label:'Recursos Humanos',icon:'fa-user-tie',sections:[{label:'ATALHOS PRINCIPAIS',ids:['rh']}]},
 {id:'projetos',label:'Projetos e Serviços',icon:'fa-project-diagram',sections:[{label:'ATALHOS PRINCIPAIS',ids:['projetos','os']}]},
 {id:'preferencias',label:'Preferências',icon:'fa-sliders-h',sections:[{label:'CONTA E IDIOMA',ids:['perfil','idioma']}]},
 {id:'ativos',label:'Frotas e Ativos',icon:'fa-truck-moving',sections:[{label:'ATALHOS PRINCIPAIS',ids:['ativos','frota']}]},
 {id:'administracao',label:'Documentos e Administração',icon:'fa-shield-alt',sections:[{label:'ATALHOS PRINCIPAIS',ids:['documentos','tickets','config']}]},
 {id:'formacao',label:'Formação e EAD',icon:'fa-graduation-cap',sections:[{label:'ATALHOS PRINCIPAIS',ids:['elearning-cursos']}]}
];
const MENU_GROUPS=MENU_GROUP_DEFINITIONS.map(group=>{
 const sections=group.sections.map(section=>({id:group.id+'-'+section.label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/,''),label:section.label,items:section.ids.map(id=>MENU.find(item=>item.id===id)).filter(Boolean)})).filter(section=>section.items.length);
 return {id:group.id,label:group.label,icon:group.icon,sections,items:sections.flatMap(section=>section.items)};
});
const MENU_GROUPED_IDS=new Set(MENU_GROUPS.flatMap(group=>group.items.map(item=>item.id)));
const MENU_MODULE_PARENT={};
Object.keys(MENU_INTERNAL_TABS).forEach(anchorId=>{MENU_MODULE_PARENT[anchorId]=anchorId;MENU_INTERNAL_TABS[anchorId].forEach(moduleId=>{MENU_MODULE_PARENT[moduleId]=anchorId;});});
function getMenuAnchorForModule(moduleId){return MENU_MODULE_PARENT[moduleId]||moduleId;}
function getMenuGroupForModule(moduleId){const anchorId=getMenuAnchorForModule(moduleId);return MENU_GROUPS.find(group=>group.items.some(item=>item.id===anchorId))||null;}
function renderModuleAnchorTabs(moduleId){
 const anchorId=getMenuAnchorForModule(moduleId),anchor=MENU.find(item=>item.id===anchorId);
 if(!anchor||!getMenuGroupForModule(anchorId))return '';
 const items=[anchorId,...(MENU_INTERNAL_TABS[anchorId]||[])].map(id=>MENU.find(item=>item.id===id)).filter(item=>item&&podeAcessar(item.id));
 if(items.length<2)return '';
 return '<nav class="module-anchor-tabs" aria-label="Separadores do módulo">'+items.map(item=>{
  const locked=!planoPermiteModulo(item.id),active=item.id===moduleId;
  const action=locked?'mostrarUpsellModulo':'openModule';
  return '<button type="button" class="module-anchor-tab'+(active?' active':'')+(locked?' is-locked':'')+'" '+(active?'aria-current="page" ':'')+'onclick="'+action+'(\''+esc(item.id)+'\')"><i class="fas '+esc(item.icon)+'" aria-hidden="true"></i><span>'+esc(item.label)+'</span>'+(locked?'<i class="fas fa-lock" aria-label="Requer plano superior"></i>':'')+'</button>';
 }).join('')+'</nav>';
}
let expandedMenuGroup = 'inicio';
let megaMenuVisible = false;
function toggleMegaMenu(force){
  megaMenuVisible = typeof force === 'boolean' ? force : !megaMenuVisible;
  const sidebar=$('sidebar'),overlay=$('sidebarOverlay'),mobile=window.innerWidth<=900;
  if(sidebar){
    sidebar.classList.toggle('mega-menu-hidden',!megaMenuVisible);
    sidebar.classList.toggle('mobile-open',mobile&&megaMenuVisible);
  }
  if(overlay)overlay.classList.toggle('active',mobile&&megaMenuVisible);
  document.body.classList.toggle('menu-open',mobile&&megaMenuVisible);
  const trigger=$('topbarMenuToggle');
  if(trigger){
    trigger.setAttribute('aria-expanded',megaMenuVisible?'true':'false');
    trigger.classList.toggle('is-open',megaMenuVisible);
    const label=trigger.querySelector('.topbar-menu-label');
    if(label) label.textContent=megaMenuVisible?'Fechar navegação':'Visão geral';
    trigger.title=megaMenuVisible?'Fechar navegação por módulo':'Abrir navegação por módulo';
  }
  if(megaMenuVisible) renderSidebar();
}
function pesquisarModuloTopbar(query){
  const box=$('topbarModuleResults');if(!box)return;
  const term=String(query||'').trim().toLocaleLowerCase('pt');
  if(!term){box.classList.remove('is-visible');box.innerHTML='';return;}
  const matches=MENU.filter(item=>(item.id==='dashboard'||MENU_GROUPED_IDS.has(item.id)||Object.prototype.hasOwnProperty.call(MENU_MODULE_PARENT,item.id))&&podeAcessar(item.id)&&String(item.label||'').toLocaleLowerCase('pt').includes(term)).slice(0,10);
  box.innerHTML=matches.length?matches.map(item=>'<button type="button" class="topbar-module-result" role="option" onclick="selecionarModuloPesquisa(\''+esc(item.id)+'\')"><i class="fas '+esc(item.icon)+'" aria-hidden="true"></i><span>'+esc(item.label)+'</span></button>').join(''):'<div class="topbar-module-empty">Nenhum módulo encontrado ou disponível para o seu perfil.</div>';
  box.classList.add('is-visible');
}
function selecionarModuloPesquisa(id){
  const input=$('topbarModuleSearch'),box=$('topbarModuleResults');
  if(input)input.value='';
  if(box){box.classList.remove('is-visible');box.innerHTML='';}
  openModule(id);
}
function teclaPesquisaModulo(event){
  if(event.key==='Escape'){const box=$('topbarModuleResults');if(box)box.classList.remove('is-visible');event.target.blur();}
  if(event.key==='Enter'){const first=$('topbarModuleResults')?.querySelector('.topbar-module-result');if(first)first.click();}
}

function toggleMenuGroup(groupId){
  openMenuGroupScreen(groupId);
}
function openMenuGroupScreen(groupId){
  const group=MENU_GROUPS.find(item=>item.id===groupId);
  if(!group)return;
  const items=group.items.filter(item=>podeAcessar(item.id));
  if(!items.length){toast('Não existem módulos disponíveis neste grupo.','info');return;}
  expandedMenuGroup=groupId;
  renderSidebar();
  if(typeof renderCategoryHub==='function')renderCategoryHub(groupId);
  const overlay=$('sidebarOverlay');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('menu-open');
}

async function openModule(id) {
  const renderToken = ++moduleRenderSequence;
  if (window.KanawaI18n && !KanawaI18n.isPreferenceLoaded() && window.KanawaCloud && KanawaCloud.ready) {
    await KanawaI18n.loadPreference();
  }
  if (!podeAcessar(id)) { toast('🔒 Sem permissão', 'error'); return; }
  if (!planoPermiteModulo(id)) { mostrarUpsellModulo(id); return; }
  currentModule = id;
  const selectedGroup = getMenuGroupForModule(id);
  if (selectedGroup) expandedMenuGroup = selectedGroup.id;
  megaMenuVisible = false;
  const navButton=$('topbarMenuToggle');
  if(navButton){navButton.setAttribute('aria-expanded','false');navButton.classList.remove('is-open');const navLabel=navButton.querySelector('.topbar-menu-label');if(navLabel)navLabel.textContent='Visão geral';navButton.title='Abrir navegação por módulo';}
  renderSidebar();
  closeMobileSidebar();
  const c = $('content');
  c.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:3rem;color:var(--primary)"></i></div>';
  const R = {
    dashboard: renderDashboard, caixa: renderCaixa, pdv: renderPDV, vendas: renderVendas, orcamentos: renderOrcamentos,
    integracoes: renderIntegracoes,
    filiais: renderEmpresasFiliais,
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
    projetos: renderProjetos, tarefas: renderTarefas, ativos: renderAtivos, 'ativos-manutencao': renderManutencoesUnificadas, 'frota-manutencao': renderManutencoesUnificadas,
    frota: renderFrota, os: renderOS, contratos: renderContratos,
    documentos: renderDocumentos, tickets: renderTickets, relatorios: renderRelatorios,
    notificacoes: renderNotificacoes, usuarios: renderUsuarios, auditoria: renderAuditoria,
    perfil: renderPerfil, idioma: renderIdioma, dispositivos: renderDispositivos, config: renderConfig, modulos: renderModulos,
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
    'ativos-depreciacao': renderAtivosDepreciacao, 'ativos-garantia': renderAtivosGarantia,
    'frota-rotas': renderFrotaRotas, 'frota-gps': renderFrotaGPS,
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
  if (!c) return;
  try {
    const renderedContent = R[id] ? await R[id]() : '<div class="card"><h3>Módulo ' + id + '</h3></div>';
    if (renderToken !== moduleRenderSequence) return;
    c.innerHTML = renderModuleAnchorTabs(id) + renderedContent;
        if (id === 'frota-gps' && typeof window.initFrotaGpsMap === 'function') {
          setTimeout(function () {
            window.initFrotaGpsMap().catch(function (error) {
              const status = document.getElementById('frotaGpsMapStatus');
              if (status) status.textContent = error.message || 'Não foi possível iniciar o mapa.';
            });
          }, 80);
        }
    if (window.KanawaTableEnhancements && typeof window.KanawaTableEnhancements.apply === 'function') {
      window.KanawaTableEnhancements.apply(c);
    }
    c.setAttribute('tabindex','0');
    c.setAttribute('aria-label','Área de conteúdo do módulo. Use a roda do rato ou Page Up/Page Down para navegar.');
    c.scrollTop = 0;
    if (id !== 'dashboard' && id !== 'pdv') setTimeout(() => renderModuleActivityChart(id, renderToken), 80);
  } catch (e) {
    console.error(e);
    if (renderToken !== moduleRenderSequence) return;
    const errorMessage = String(e && e.message || e || 'Erro inesperado ao abrir o módulo.');
    const errorStack = String(e && e.stack || '').split('\n').slice(0, 10).join('\n');
    window.__kanawaLastModuleError = { module: id, message: errorMessage, stack: errorStack, occurredAt: new Date().toISOString() };
    const technicalDetails = errorStack
      ? '<details class="kanawa-module-error-details"><summary>Detalhes técnicos para suporte</summary><pre>' + esc(errorStack) + '</pre></details>'
      : '';
    c.innerHTML = '<div class="card" role="alert"><h3>Erro ao abrir o módulo</h3><p>' + esc(errorMessage) + '</p><p class="text-muted">Módulo: ' + esc(id) + '</p>' + technicalDetails + '<button class="btn btn-light" onclick="openModule(\'' + esc(id) + '\')">Tentar novamente</button></div>';
  }
}

/* ====== UI HELPERS ====== */
function imprimirTelaAtual(){const content=$('content');if(!content){window.print();return;}const clone=content.cloneNode(true);clone.querySelectorAll('button,.no-print,input,select,textarea').forEach(el=>el.remove());const w=window.open('','_blank');if(!w){toast('Permita janelas de impressão no navegador.','warning');return;}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(currentModule)+' — Kanawa Soft</title><style>body{font:12px Arial;padding:18px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px;text-align:left}th{background:#e8eef5}.card{margin:10px 0;break-inside:avoid}@page{margin:12mm}</style></head><body>'+clone.innerHTML+'</body></html>');w.document.close();setTimeout(()=>{w.focus();w.print();},400);}
function exportarTabelaAtualExcel(){if(typeof XLSX==='undefined'){toast('Excel indisponível','warning');return;}const content=$('content'),tables=content?Array.from(content.querySelectorAll('table')):[];if(!tables.length){toast('Este ecrã não tem tabela para exportar. Use o relatório próprio do módulo.','warning');return;}const wb=XLSX.utils.book_new();tables.forEach((table,index)=>{const rows=Array.from(table.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('th,td')).map(td=>td.innerText.trim()));XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),('Tabela'+(index+1)).slice(0,31));});XLSX.writeFile(wb,'kanawa_'+String(currentModule).replace(/[^a-z0-9_-]/gi,'_')+'_'+Date.now()+'.xlsx');toast('Tabela(s) exportada(s) para Excel.','success');}
async function exportarTelaAtualPDF(){const content=$('content');if(!content)return toast('Conteúdo indisponível','warning');if(window.jspdf&&window.jspdf.jsPDF){const {jsPDF}=window.jspdf,doc=new jsPDF('p','pt','a4'),tables=content.querySelectorAll('table');if(tables.length&&typeof doc.autoTable==='function'){let y=36;doc.setFontSize(14);doc.text('Kanawa Soft — '+String(currentModule),36,y);y+=18;tables.forEach(table=>{const body=Array.from(table.querySelectorAll('tbody tr')).map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>td.innerText.trim())),head=Array.from(table.querySelectorAll('thead th')).map(th=>th.innerText.trim());doc.autoTable({head:[head],body,startY:y,styles:{fontSize:7,cellPadding:3}});y=(doc.lastAutoTable?.finalY||y)+18;});doc.save('kanawa_'+String(currentModule)+'_'+Date.now()+'.pdf');return;}if(typeof doc.html==='function'){doc.html(content,{callback:d=>d.save('kanawa_'+String(currentModule)+'_'+Date.now()+'.pdf'),x:24,y:24,width:548});return;}}toast('Biblioteca PDF indisponível. Use Imprimir e escolha Guardar como PDF.','warning');}
function header(title, subtitle, color, buttons, icon) {
  return '<div class="card" style="background:linear-gradient(135deg,' + (color || 'var(--primary)') + ',var(--primary-dark));color:#fff;border:none">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
    '<div><h2 style="font-size:1.3rem;font-weight:800"><i class="fas ' + (icon || 'fa-th') + '"></i> ' + esc(title) + '</h2>' +
    (subtitle ? '<p style="opacity:.85;font-size:.9rem;margin-top:4px">' + subtitle + '</p>' : '') + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (buttons || '') + '<button class="btn btn-sm" onclick="imprimirTelaAtual()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-print"></i> Imprimir</button><button class="btn btn-sm" onclick="exportarTabelaAtualExcel()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-file-excel"></i> Excel</button><button class="btn btn-sm" onclick="exportarTelaAtualPDF()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-file-pdf"></i> PDF</button></div></div></div>';
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


function calcularLucroBrutoVenda(venda) {
  if (venda && typeof venda.lucroBruto === 'number' && Number.isFinite(venda.lucroBruto)) return venda.lucroBruto;
  const itens = venda && (venda.itens || venda.carrinho);
  if (!Array.isArray(itens) || !itens.length || !itens.every(i => i.custoUnitario !== undefined && i.custoUnitario !== null)) return null;
  const custo = itens.reduce((sum,i)=>sum+(Number(i.custoUnitario)||0)*(Number(i.qty !== undefined ? i.qty : i.quantidade)||0),0);
  const subtotal = Number(venda.subtotal)||itens.reduce((sum,i)=>sum+Number(i.subtotal||0),0);
  return subtotal-(Number(venda.descontoValor)||0)-custo;
}
function criarGraficoKanawa(canvasId,type,labels,datasets,extraOptions) {
  const canvas=$(canvasId); if(!canvas||typeof Chart==='undefined')return null;
  try {
    window.kanawaCharts=window.kanawaCharts||{};
    if(window.kanawaCharts[canvasId])window.kanawaCharts[canvasId].destroy();
    const base={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom'},tooltip:{mode:'index',intersect:false}},scales:(type==='doughnut'||type==='pie'||type==='radar')?{}:{y:{beginAtZero:true},x:{grid:{display:false}}}};
    window.kanawaCharts[canvasId]=new Chart(canvas.getContext('2d'),{type,data:{labels,datasets},options:Object.assign(base,extraOptions||{})});
    return window.kanawaCharts[canvasId];
  } catch(error){console.warn('Gráfico Kanawa:',canvasId,error);return null;}
}
function renderDashboardCharts(data) {
  const months=[]; const monthKeys=[]; const nowDate=new Date();
  for(let offset=11;offset>=0;offset--){const d=new Date(nowDate.getFullYear(),nowDate.getMonth()-offset,1);months.push(d.toLocaleDateString('pt-AO',{month:'short',year:'2-digit'}));monthKeys.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
  const monthIndex=value=>{const d=new Date(value||'');return Number.isNaN(d.getTime())?-1:monthKeys.indexOf(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));};
  const sales=Array(12).fill(0),profit=Array(12).fill(0),purchases=Array(12).fill(0);
  (data.sales||[]).filter(v=>v.status==='finalizada'||v.status==='finalizado').forEach(v=>{const i=monthIndex(v.data||v.sold_at);if(i>=0){sales[i]+=Number(v.total)||0;const p=calcularLucroBrutoVenda(v);if(p!==null)profit[i]+=p;}});
  (data.purchases||[]).forEach(v=>{const i=monthIndex(v.data||v.dataCompra||v.created_at);if(i>=0)purchases[i]+=Number(v.total||v.valorTotal||v.valor)||0;});
  criarGraficoKanawa('dashChartSales','line',months,[{label:'Vendas (Kz)',data:sales,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.16)',fill:true,tension:.3,pointRadius:3}]);
  criarGraficoKanawa('dashChartProfit','bar',months,[{label:'Lucro bruto (Kz)',data:profit,backgroundColor:'#16a34a',borderRadius:5}]);
  criarGraficoKanawa('dashChartPurchases','bar',months,[{label:'Vendas (Kz)',data:sales,backgroundColor:'#2563eb'},{label:'Compras (Kz)',data:purchases,backgroundColor:'#f59e0b'}],{scales:{y:{beginAtZero:true},x:{stacked:false,grid:{display:false}}}});
  const payMap={};(data.sales||[]).filter(v=>v.status==='finalizada'||v.status==='finalizado').forEach(v=>{const k=v.pagamento||'Não indicado';payMap[k]=(payMap[k]||0)+(Number(v.total)||0);});
  criarGraficoKanawa('dashChartPayments','doughnut',Object.keys(payMap),[{label:'Valor por pagamento',data:Object.values(payMap),backgroundColor:['#2563eb','#16a34a','#f59e0b','#8b5cf6','#06b6d4','#ef4444']}]);
  const top={};(data.sales||[]).forEach(v=>(v.itens||v.carrinho||[]).forEach(i=>{const k=i.nome||i.product_name||'Artigo';top[k]=(top[k]||0)+(Number(i.subtotal)||Number(i.preco||i.unit_price||0)*Number(i.qty||i.quantidade||0));}));
  const topRows=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,8);
  criarGraficoKanawa('dashChartTopProducts','bar',topRows.map(x=>x[0]),[{label:'Vendas por produto (Kz)',data:topRows.map(x=>x[1]),backgroundColor:'#0ea5e9'}],{indexAxis:'y'});
  const stock={};(data.products||[]).forEach(p=>{const cost=p.precoCompra!==undefined?p.precoCompra:p.purchase_cost;if(cost===null||cost===undefined||cost==='')return;const category=p.categoria||'Geral';stock[category]=(stock[category]||0)+(Number(cost)||0)*(Number(p.estoque)||0);});
  const stockRows=Object.entries(stock).filter(x=>x[1]>0);
  criarGraficoKanawa('dashChartStock','doughnut',stockRows.map(x=>x[0]),[{label:'Valor de compra do stock (Kz)',data:stockRows.map(x=>x[1]),backgroundColor:['#1d4ed8','#059669','#d97706','#7c3aed','#0891b2','#dc2626','#64748b']}]);
  const activity={sales:Array(12).fill(0),purchases:Array(12).fill(0),movements:Array(12).fill(0),orders:Array(12).fill(0)};
  const countByMonth=(rows,key)=> (rows||[]).forEach(row=>{const i=monthIndex(row.data||row.created_at||row.sold_at);if(i>=0)activity[key][i]++;});
  countByMonth(data.sales,'sales');countByMonth(data.purchases,'purchases');countByMonth(data.movements,'movements');countByMonth(data.orders,'orders');
  const employeeSales={};
  (data.sales||[]).filter(v=>v.status==='finalizada'||v.status==='finalizado').forEach(v=>{
    const name=v.operador||v.cashierName||'Utilizador não identificado';
    employeeSales[name]=(employeeSales[name]||0)+(Number(v.total)||0);
  });
  const employeeRows=Object.entries(employeeSales).sort((a,b)=>b[1]-a[1]).slice(0,12);
  criarGraficoKanawa('dashChartEmployeeSales','bar',employeeRows.map(x=>x[0]),[{label:'Vendas por colaborador (Kz)',data:employeeRows.map(x=>x[1]),backgroundColor:'#0f766e'}],{indexAxis:'y'});
  criarGraficoKanawa('dashChartActivities','line',months,[
    {label:'Vendas',data:activity.sales,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.08)',tension:.3},
    {label:'Compras',data:activity.purchases,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,.08)',tension:.3},
    {label:'Movimentos de stock',data:activity.movements,borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,.08)',tension:.3},
    {label:'Ordens de serviço',data:activity.orders,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,.08)',tension:.3}
  ]);
}

function renderSalesModuleChart(sales) {
  const months=[],keys=[],today=new Date();
  for(let n=11;n>=0;n--){const d=new Date(today.getFullYear(),today.getMonth()-n,1);months.push(d.toLocaleDateString('pt-AO',{month:'short'}));keys.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
  const revenue=Array(12).fill(0),profit=Array(12).fill(0);
  (sales||[]).forEach(v=>{const d=new Date(v.data||v.sold_at||'');if(Number.isNaN(d.getTime()))return;const i=keys.indexOf(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));if(i<0)return;revenue[i]+=Number(v.total)||0;const p=calcularLucroBrutoVenda(v);if(p!==null)profit[i]+=p;});
  criarGraficoKanawa('salesModuleChart','line',months,[{label:'Vendas (Kz)',data:revenue,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.12)',fill:true,tension:.3},{label:'Lucro bruto (Kz)',data:profit,borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,.08)',fill:false,tension:.3}]);
}
function renderStockModuleChart(products) {
  const rows=(products||[]).slice().sort((a,b)=>(Number(b.estoque)||0)-(Number(a.estoque)||0)).slice(0,10);
  criarGraficoKanawa('stockModuleChart','bar',rows.map(p=>p.nome||'Produto'),[{label:'Quantidade em stock',data:rows.map(p=>Number(p.estoque)||0),backgroundColor:'#0ea5e9'}]);
}
function renderFinanceModuleChart(receivable,payable) {
  const sums=[(receivable||[]).filter(x=>x.status!=='pago').reduce((s,x)=>s+Number(x.valor||0),0),(payable||[]).filter(x=>x.status!=='pago').reduce((s,x)=>s+Number(x.valor||0),0),(receivable||[]).filter(x=>x.status==='pago').reduce((s,x)=>s+Number(x.valor||0),0),(payable||[]).filter(x=>x.status==='pago').reduce((s,x)=>s+Number(x.valor||0),0)];
  criarGraficoKanawa('financeModuleChart','doughnut',['A receber pendente','A pagar pendente','Recebido','Pago'],[{label:'Fluxo financeiro (Kz)',data:sums,backgroundColor:['#16a34a','#ef4444','#0ea5e9','#f59e0b']}]);
}
function renderPurchaseModuleChart(purchases) {
  const months=[],keys=[],today=new Date();for(let n=11;n>=0;n--){const d=new Date(today.getFullYear(),today.getMonth()-n,1);months.push(d.toLocaleDateString('pt-AO',{month:'short'}));keys.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
  const totals=Array(12).fill(0);(purchases||[]).forEach(p=>{const d=new Date(p.data||p.created_at||'');if(Number.isNaN(d.getTime()))return;const i=keys.indexOf(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));if(i>=0)totals[i]+=Number(p.valor||p.total||p.valorTotal||0);});
  criarGraficoKanawa('purchaseModuleChart','bar',months,[{label:'Compras (Kz)',data:totals,backgroundColor:'#f59e0b'}]);
}

function renderProductsMarginChart(products) {
  const groups={};(products||[]).forEach(p=>{const costRaw=p.precoCompra!==undefined?p.precoCompra:p.purchase_cost;if(costRaw===null||costRaw===undefined||costRaw==='')return;const key=p.categoria||'Geral';const cost=(Number(costRaw)||0)*(Number(p.estoque)||0);const revenue=(Number(p.precoVenda!==undefined?p.precoVenda:p.preco)||0)*(Number(p.estoque)||0);if(!groups[key])groups[key]={cost:0,revenue:0};groups[key].cost+=cost;groups[key].revenue+=revenue;});
  const rows=Object.entries(groups);
  criarGraficoKanawa('productsMarginChart','bar',rows.map(x=>x[0]),[{label:'Custo de stock (Kz)',data:rows.map(x=>x[1].cost),backgroundColor:'#f59e0b'},{label:'Valor potencial de venda (Kz)',data:rows.map(x=>x[1].revenue),backgroundColor:'#2563eb'}]);
}
async function renderModuleActivityChart(moduleId,renderToken) {
  const host=$('content');
  if(!host||currentModule!==moduleId||renderToken!==moduleRenderSequence)return;
  let audit=[];
  try {
    if(window.KanawaCloud&&KanawaCloud.ready&&typeof KanawaCloud.listAuditEvents==='function') {
      const cloudEvents=await KanawaCloud.listAuditEvents(500);
      audit=(cloudEvents||[]).map(row=>({
        id:row.id, modulo:row.resource_type, acao:row.action, data:row.created_at,
        usuario:row.actor&&row.actor.full_name||'', cargo:row.details&&row.details.role||'',
        detalhes:row.details||{}
      }));
    } else {
      audit=await getData('auditoria')||[];
    }
  } catch(error) {
    console.warn('Não foi possível carregar a actividade auditada:',error);
    try { audit=await getData('auditoria')||[]; } catch(fallbackError) { audit=[]; }
  }
  if(currentModule!==moduleId||renderToken!==moduleRenderSequence)return;
  const relevant=audit.filter(a=>String(a.modulo||'').toLowerCase()===String(moduleId).toLowerCase()||String(a.modulo||'').toLowerCase().includes(String(moduleId).toLowerCase()));
  const label=(MENU.find(m=>m.id===moduleId)||{}).label||moduleId;
  const card=document.createElement('section');card.className='card kanawa-module-activity';
  card.innerHTML='<div class="card-header"><h3 class="card-title"><i class="fas fa-chart-line"></i> Actividade — '+esc(label)+'</h3><span class="badge badge-info">'+relevant.length+' eventos auditados</span></div>'+(relevant.length?'<div class="kanawa-chart-wrap"><canvas id="moduleActivityChart"></canvas></div>':'<p class="text-muted">Ainda não existem eventos de auditoria registados para este módulo. O gráfico será preenchido à medida que as operações forem registadas.</p>');
  host.appendChild(card);
  if(relevant.length){
    const daily={};relevant.forEach(a=>{const d=new Date(a.data||a.created_at||'');if(Number.isNaN(d.getTime()))return;const k=d.toISOString().slice(0,10);daily[k]=(daily[k]||0)+1;});
    const rows=Object.entries(daily).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
    criarGraficoKanawa('moduleActivityChart','line',rows.map(x=>new Date(x[0]+'T12:00:00').toLocaleDateString('pt-AO',{day:'2-digit',month:'short'})),[{label:'Operações auditadas',data:rows.map(x=>x[1]),borderColor:'#7c3aed',backgroundColor:'rgba(124,58,237,.15)',fill:true,tension:.3}]);
  }
}

/* ====== DASHBOARD ====== */
async function renderDashboard() {
  const emp=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
  const context=window.KanawaCloud&&KanawaCloud.context||{};
  const rawRole=String(context.membership&&context.membership.role||context.role||'operator').trim().toLowerCase();
  const roleKey=context.isPlatformAdmin===true||['owner','admin'].includes(rawRole)?'admin':
    ({manager:'gerente',gerente:'gerente',accountant:'contabilista',contabilista:'contabilista',cashier:'caixa',caixa:'caixa',operator:'operador',operador:'operador'})[rawRole]||'operador';
  const roleInfo={
    admin:{title:'Painel do Administrador',description:'Gestão global, utilizadores, módulos, segurança e resultados.',shortcuts:['modulos','usuarios','contabilidade','fiscal','financeiro','vendas','estoque']},
    gerente:{title:'Painel do Gerente',description:'Acompanhamento das operações, equipa, compras, vendas e resultados.',shortcuts:['vendas','compras','financeiro','estoque','contabilidade','relatorios']},
    contabilista:{title:'Painel do Contabilista',description:'Contabilidade, fiscalidade, folha salarial, reconciliação e relatórios.',shortcuts:['contabilidade','fiscal','financeiro','folha-salarial','despesas-gerais','relatorios']},
    caixa:{title:'Painel do Caixa',description:'Ponto de venda, abertura e fecho de caixa e resultados pessoais.',shortcuts:['caixa','pdv','vendas']},
    operador:{title:'Painel do Operador',description:'Stock, produtos, compras e execução das operações técnicas.',shortcuts:['estoque','produtos','compras','os','producao','projetos-tarefas']}
  }[roleKey];
  const today=new Date().toLocaleDateString('pt-AO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const shortcutHtml=roleInfo.shortcuts.filter(id=>podeAcessar(id)).map(id=>{
    const item=MENU.find(m=>m.id===id);if(!item)return '';
    return '<button class="btn btn-light" onclick="openModule(\''+esc(id)+'\')"><i class="fas '+item.icon+'"></i> '+esc(item.label)+'</button>';
  }).join('');
  const metrics=[];
  if(podeAcessar('vendas'))metrics.push('<div class="metric-card" onclick="openModule(\'vendas\')"><div class="label">💰 Vendas</div><div class="value" id="dashVendas">...</div><div class="sub" id="dashVendasSub">...</div><i class="fas fa-money-bill-wave icon"></i></div>');
  if(podeAcessar('produtos'))metrics.push('<div class="metric-card" onclick="openModule(\'produtos\')" style="border-left-color:var(--info)"><div class="label">📦 Produtos</div><div class="value" id="dashProdutos">...</div><div class="sub" id="dashProdutosSub">...</div><i class="fas fa-boxes icon"></i></div>');
  if(podeAcessar('clientes'))metrics.push('<div class="metric-card" onclick="openModule(\'clientes\')" style="border-left-color:var(--warning)"><div class="label">👥 Clientes</div><div class="value" id="dashClientes">...</div><div class="sub" id="dashClientesSub">...</div><i class="fas fa-users icon"></i></div>');
  if(podeAcessar('pdv'))metrics.push('<div class="metric-card" onclick="openModule(\'pdv\')" style="border-left-color:var(--success)"><div class="label">🛒 PDV</div><div class="value">Abrir</div><div class="sub">Nova venda</div><i class="fas fa-cash-register icon"></i></div>');
  if(podeAcessar('financeiro')) {
    metrics.push('<div class="metric-card" onclick="openModule(\'financeiro\')" style="border-left-color:var(--success)"><div class="label">📥 A Receber</div><div class="value" style="color:var(--success)" id="dashReceber">...</div></div>');
    metrics.push('<div class="metric-card" onclick="openModule(\'financeiro\')" style="border-left-color:var(--danger)"><div class="label">📤 A Pagar</div><div class="value" style="color:var(--danger)" id="dashPagar">...</div></div>');
  }
  if(podeAcessar('notificacoes'))metrics.push('<div class="metric-card" onclick="openModule(\'notificacoes\')" style="border-left-color:var(--warning)"><div class="label">🔔 Não Lidas</div><div class="value" id="dashNotif">...</div></div>');
  const actionButtons=[];
  if(podeFazer('criar','vendas')&&podeAcessar('pdv'))actionButtons.push('<button class="btn btn-success btn-lg" onclick="openModule(\'pdv\')"><i class="fas fa-cash-register"></i> Nova Venda</button>');
  if(podeFazer('criar','produtos'))actionButtons.push('<button class="btn btn-primary btn-lg" onclick="abrirModalProduto()"><i class="fas fa-plus"></i> Novo Produto</button>');
  if(podeFazer('criar','clientes'))actionButtons.push('<button class="btn btn-info btn-lg" onclick="abrirModalCliente()"><i class="fas fa-user-plus"></i> Novo Cliente</button>');
  if(podeAcessar('estoque'))actionButtons.push('<button class="btn btn-warning btn-lg" onclick="openModule(\'estoque\')"><i class="fas fa-warehouse"></i> Estoque</button>');
  if(['admin','gerente','contabilista'].includes(roleKey) && podeAcessar('vendas')) metrics.push('<div class="metric-card" style="border-left-color:var(--success)"><div class="label">📈 Lucro bruto apurado</div><div class="value" id="dashLucroBruto">...</div><div class="sub" id="dashLucroSub">Com custo registado</div></div>');
  const chartsHtml = '<section class="kanawa-chart-grid">' +
    '<div class="card kanawa-chart-card"><h3>Vendas mensais</h3><div class="kanawa-chart-wrap"><canvas id="dashChartSales"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Lucro bruto mensal</h3><div class="kanawa-chart-wrap"><canvas id="dashChartProfit"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Compras e vendas</h3><div class="kanawa-chart-wrap"><canvas id="dashChartPurchases"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Vendas por pagamento</h3><div class="kanawa-chart-wrap"><canvas id="dashChartPayments"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Produtos mais vendidos</h3><div class="kanawa-chart-wrap"><canvas id="dashChartTopProducts"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Valor de stock por categoria</h3><div class="kanawa-chart-wrap"><canvas id="dashChartStock"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Actividade operacional mensal</h3><div class="kanawa-chart-wrap"><canvas id="dashChartActivities"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Vendas por colaborador</h3><div class="kanawa-chart-wrap"><canvas id="dashChartEmployeeSales"></canvas></div></div>' +
    '<div class="card kanawa-chart-card"><h3>Actividade por colaborador</h3><div class="kanawa-chart-wrap"><canvas id="dashChartEmployeeActivity"></canvas></div></div>' +
    (podeAcessar('tarefas')?'<div class="card kanawa-chart-card"><h3>Tarefas pendentes por colaborador</h3><div class="kanawa-chart-wrap"><canvas id="dashChartEmployeeTasks"></canvas></div></div>':'') +
    '</section>';
  let auditEvents=[];
  try { if(window.KanawaCloud&&KanawaCloud.ready&&typeof KanawaCloud.listAuditEvents==='function') auditEvents=await KanawaCloud.listAuditEvents(80); } catch(auditError) { console.warn('Painel de actividades:',auditError); }
  const activityRows=auditEvents.slice(0,20).map(event=>{
    const details=event.details||{}, actorName=event.actor&&event.actor.full_name||'Utilizador';
    const productSummary=(details.products||[]).slice(0,4).map(p=>(p.name||'Produto')+' × '+(p.quantity||0)).join(', ');
    const summary=details.invoice ? 'Fatura '+details.invoice+' · Cliente '+(details.customer||'—')+' · Morada '+(details.customer_address||'—')+' · Total '+fmt(details.total||0)+' · Lucro '+(details.gross_profit==null?'Não apurado':fmt(details.gross_profit))+' · '+(details.quantity||0)+' un. · '+productSummary :
      details.supplier ? 'Fornecedor: '+details.supplier : details.name||details.description||event.resource_type;
    return [fmtDT(event.created_at),esc(actorName),esc(details.role||'—'),badge(event.action,'info'),esc(event.resource_type||'—'),esc(summary)];
  });
  const activityHtml='<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-user-clock"></i> Monitorização de actividades</h3><span class="text-muted">'+auditEvents.length+' registos</span></div>'+
    (activityRows.length?table(['Data e hora','Colaborador','Função','Acção','Módulo','Resumo'],activityRows):emptyState('fa-history','Ainda não existem actividades registadas.'))+
    '<button class="btn btn-light" onclick="openModule(\'auditoria\')">Abrir auditoria completa</button></div>';
  setTimeout(()=>{
    const activityByUser={};auditEvents.forEach(event=>{const name=event.actor&&event.actor.full_name||'Utilizador';activityByUser[name]=(activityByUser[name]||0)+1;});
    const activityRowsByUser=Object.entries(activityByUser).sort((a,b)=>b[1]-a[1]).slice(0,12);
    criarGraficoKanawa('dashChartEmployeeActivity','bar',activityRowsByUser.map(x=>x[0]),[{label:'Actividades registadas',data:activityRowsByUser.map(x=>x[1]),backgroundColor:'#7c3aed'}],{indexAxis:'y'});
  },140);
  const taskPanelHtml=podeAcessar('tarefas')?'<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-clipboard-list"></i> Tarefas e responsabilidades da equipa</h3><button class="btn btn-sm btn-light" onclick="openModule(\'tarefas\')">Abrir tarefas</button></div><div id="dashTaskMonitoring">A carregar tarefas…</div></div>':'';
  const panelTitle=$('topbarEmpresa'),panelDescription=$('topbarPanelDescription'),panelMeta=$('topbarPanelMeta');
  if(panelTitle)panelTitle.textContent=roleInfo.title;
  if(panelDescription)panelDescription.textContent=roleInfo.description;
  if(panelMeta)panelMeta.textContent=today+' · NIF: '+(emp.nif||'5001588150');
  const roleLabel=roleKey==='contabilista'?'Contabilista':roleKey==='gerente'?'Gerente':roleKey==='caixa'?'Caixa':roleKey==='operador'?'Operador':'Administrador';
  const html='<div class="card dashboard-role-card"><div class="card-header"><h3 class="card-title"><i class="fas fa-briefcase"></i> Área de trabalho</h3><span class="badge badge-info">'+esc(roleLabel)+'</span></div>'+
    '<p>'+esc(roleInfo.description)+'</p>'+
    '<div class="dashboard-shortcuts"><span class="dashboard-section-label"><i class="fas fa-th-large"></i> Módulos frequentes</span>'+shortcutHtml+
    (actionButtons.length?'<span class="dashboard-section-label dashboard-quick-label"><i class="fas fa-bolt"></i> Ações rápidas</span>'+actionButtons.join(''):'')+
    '</div></div>'+
    (metrics.length?'<div class="metric-grid">'+metrics.join('')+'</div>':'')+
    chartsHtml+activityHtml+taskPanelHtml;
  const jobs=[];
  jobs.push(podeAcessar('produtos')?getData('produtos'):Promise.resolve([]));
  jobs.push(podeAcessar('clientes')?getData('clientes'):Promise.resolve([]));
  jobs.push(podeAcessar('vendas')?getOperationalSales():Promise.resolve([]));
  jobs.push(podeAcessar('financeiro')?getData('contasReceber'):Promise.resolve([]));
  jobs.push(podeAcessar('financeiro')?getData('contasPagar'):Promise.resolve([]));
  jobs.push(podeAcessar('notificacoes')?getData('notificacoes'):Promise.resolve([]));
  jobs.push(podeAcessar('compras')?getData('compras'):Promise.resolve([]));
  jobs.push(podeAcessar('estoque')?getData('movimentacoesEstoque'):Promise.resolve([]));
  jobs.push(podeAcessar('os')?getData('ordensServico'):Promise.resolve([]));
  jobs.push(podeAcessar('tarefas')?getData('tarefas'):Promise.resolve([]));
  Promise.all(jobs).then(([prod=[],cli=[],vend=[],cRec=[],cPag=[],notifs=[],purchases=[],movements=[],orders=[],tasks=[]])=>{
    setTimeout(()=>{
    const actor=kanawaCurrentActor();
    if(actor.role==='caixa') vend=vend.filter(v=>String(v.cashierUserId||v.operatorUserId||'')===String(actor.id||'')||(!v.cashierUserId&&!v.operatorUserId&&String(v.operador||'')===actor.name));
    const totalV=vend.filter(v=>v.status==='finalizada'||v.status==='finalizado').reduce((sum,v)=>sum+Number(v.total||0),0);
    const baixo=prod.filter(p=>Number(p.estoque||0)<Number(p.estoqueMin||10)).length;
    const totalR=cRec.filter(c=>c.status!=='pago').reduce((sum,c)=>sum+Number(c.valor||0),0);
    const totalP=cPag.filter(c=>c.status!=='pago').reduce((sum,c)=>sum+Number(c.valor||0),0);
    const naoLidas=notifs.filter(n=>!n.lida).length;
    const set=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
    const profitSales=vend.filter(v=>v.status==='finalizada'||v.status==='finalizado');
    const knownProfit=profitSales.map(calcularLucroBrutoVenda).filter(v=>v!==null);
    const grossProfit=knownProfit.reduce((sum,v)=>sum+v,0);
    const missingProfit=profitSales.length-knownProfit.length;
    set('dashVendas',fmt(totalV));set('dashVendasSub',profitSales.length+' vendas activas');
    set('dashLucroBruto',fmt(grossProfit));set('dashLucroSub',knownProfit.length+' vendas com custo · '+missingProfit+' sem custo histórico');
    renderDashboardCharts({products:prod,sales:profitSales,purchases,movements,orders});
    const pendingTasks=tasks.filter(task=>task.status!=='concluida');
    const taskGroups={};pendingTasks.forEach(task=>{const name=task.responsavelNome||'Por atribuir';taskGroups[name]=(taskGroups[name]||0)+1;});
    const taskEntries=Object.entries(taskGroups).sort((a,b)=>b[1]-a[1]).slice(0,12);
    criarGraficoKanawa('dashChartEmployeeTasks','bar',taskEntries.map(x=>x[0]),[{label:'Tarefas pendentes',data:taskEntries.map(x=>x[1]),backgroundColor:'#d97706'}],{indexAxis:'y'});
    const taskTarget=$('dashTaskMonitoring');
    if(taskTarget){
      const taskRows=tasks.slice().sort((a,b)=>String(a.prazo||'').localeCompare(String(b.prazo||''))).slice(0,20).map(task=>[
        esc(task.titulo||'Tarefa'),esc(task.departamento||'Geral'),esc(task.responsavelNome||'Por atribuir'),esc(task.responsavelRole||'—'),
        badge(task.status||'pendente',task.status==='concluida'?'success':'warning'),fmtD(task.prazo),esc(task.criadoPorNome||'—')
      ]);
      taskTarget.innerHTML=taskRows.length?table(['Tarefa','Departamento','Responsável','Função','Estado','Prazo','Atribuída por'],taskRows):emptyState('fa-clipboard-check','Não existem tarefas atribuídas neste âmbito.');
    }
    set('dashProdutos',prod.length);set('dashProdutosSub',baixo+' estoque baixo');
    set('dashClientes',cli.length);set('dashClientesSub','cadastrados');
    set('dashReceber',fmt(totalR));set('dashPagar',fmt(totalP));set('dashNotif',naoLidas);
    }, 100);
  }).catch(()=>{});
  return html;
}

async function renderIdioma() {
  const body = window.KanawaI18n
    ? window.KanawaI18n.renderLanguageSettings()
    : '<div class="card"><p>O módulo de idiomas ainda não foi carregado.</p></div>';
  return header('Idioma do Sistema','Escolha o idioma da sua conta','var(--primary)','','fa-language') + body;
}

/* ====== PERFIL ====== */
async function renderPerfil() {
  const user=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
  const context=window.KanawaCloud&&KanawaCloud.context||{};
  const role=String(context.membership&&context.membership.role||context.role||'operator').toLowerCase();
  const roleLabel=({owner:'Administrador',admin:'Administrador',manager:'Gerente',gerente:'Gerente',accountant:'Contabilista',contabilista:'Contabilista',cashier:'Caixa',caixa:'Caixa',operator:'Operador',operador:'Operador'})[role]||'Operador';
  const email=(context.user&&context.user.email)||user.email||'';
  const avatarSrc=user.avatar||'';
  return header('Meu Perfil','Editar dados pessoais','var(--primary)','','fa-user-circle')+
    '<div class="card"><div style="display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:start">'+
    '<div style="text-align:center"><div style="position:relative;display:inline-block">'+
    '<img id="perfilAvatarImg" src="'+(avatarSrc||'logo.png')+'" style="width:150px;height:150px;border-radius:50%;object-fit:cover;border:4px solid var(--primary);background:#f0f0f0" onerror="this.src=\'logo.png\'">'+
    '<label for="perfilAvatarInput" style="position:absolute;bottom:5px;right:5px;background:var(--primary);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:3px solid var(--bg-card)"><i class="fas fa-camera"></i></label>'+
    '<input type="file" id="perfilAvatarInput" accept="image/*" style="display:none" onchange="escolherAvatarPerfil(this)"></div>'+
    '<div style="margin-top:12px"><button class="btn btn-sm btn-danger" onclick="removerAvatarPerfil()"><i class="fas fa-trash"></i> Remover foto</button></div></div>'+
    '<div><div class="form-grid">'+
    '<div class="form-group full"><label>Nome Completo *</label><input id="perfilNome" value="'+esc(user.nome||'')+'"></div>'+
    '<div class="form-group"><label>Email de acesso (alteração exige confirmação)</label><input id="perfilEmail" type="email" value="'+esc(email)+'" readonly></div>'+
    '<div class="form-group"><label>Telefone</label><input id="perfilTel" value="'+esc(user.telefone||'')+'"></div>'+
    '<div class="form-group"><label>Perfil / Cargo (gerido pelo administrador)</label><input id="perfilRole" value="'+esc(roleLabel)+'" readonly></div>'+
    '<div class="form-group"><label>NIF</label><input id="perfilNif" value="'+esc(user.nif||'')+'"></div>'+
    '</div></div></div></div>'+
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-lock"></i> Alterar Senha</h3></div>'+
    '<div class="form-grid" style="max-width:500px">'+
    '<div class="form-group full"><label>Senha Atual</label><input type="password" id="perfilSenhaAtual"></div>'+
    '<div class="form-group"><label>Nova Senha</label><input type="password" id="perfilNovaSenha" minlength="6"></div>'+
    '<div class="form-group"><label>Confirmar Nova Senha</label><input type="password" id="perfilConfSenha" minlength="6"></div></div>'+
    '<button class="btn btn-warning" onclick="alterarSenhaPerfil()"><i class="fas fa-key"></i> Alterar Senha</button></div>'+
    '<div class="card" style="display:flex;gap:10px;flex-wrap:wrap">'+
    '<button class="btn btn-success btn-lg" onclick="salvarPerfil()"><i class="fas fa-save"></i> Salvar Alterações</button>'+
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
  const user=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
  const context=window.KanawaCloud&&KanawaCloud.context||{};
  const nome=$('perfilNome').value.trim(),email=(context.user&&context.user.email)||user.email||'';
  if(!nome||!email){toast('Preencha o nome do perfil.','warning');return;}
  user.nome=nome;user.email=email;user.telefone=$('perfilTel').value;user.nif=$('perfilNif').value;
  const role=String(context.membership&&context.membership.role||context.role||'operator').toLowerCase();
  user.role=role;
  if(localStorage.getItem('kanawa_avatar_temp')){user.avatar=localStorage.getItem('kanawa_avatar_temp');localStorage.removeItem('kanawa_avatar_temp');}
  if(localStorage.getItem('kanawa_avatar_remove')){delete user.avatar;localStorage.removeItem('kanawa_avatar_remove');}
  localStorage.setItem('kanawa_user',JSON.stringify(user));
  try {
    const users=await DB.getAll('usuarios');
    const match=users.find(u=>u.email===email||u.id===1);
    if(match){match.nome=nome;match.telefone=user.telefone;match.nif=user.nif;if(user.avatar)match.avatar=user.avatar;await DB.put('usuarios',match);}
  } catch(error) {}
  if($('userName'))$('userName').textContent=nome;
  if($('userRole'))$('userRole').textContent=({owner:'Administrador',admin:'Administrador',manager:'Gerente',gerente:'Gerente',accountant:'Contabilista',contabilista:'Contabilista',cashier:'Caixa',caixa:'Caixa',operator:'Operador',operador:'Operador'})[role]||'Operador';
  if($('userAvatar')){$('userAvatar').src=user.avatar||'logo.png';$('userAvatar').onerror=function(){this.src='logo.png';};}
  await registrarAuditoria('editar','perfil',{nome,email});
  toast('Perfil atualizado. O cargo e as permissões são geridos pelo administrador.','success');
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
    '<p><strong>⚖️ Balança eletrónica:</strong> a leitura automática depende do modelo e do protocolo (USB/Serial/Bluetooth); testar e configurar antes de ativar.</p><p><strong>🔫 Scanner:</strong> leitores USB HID funcionam como teclado; a câmara usa leitura ótica.</p><p><strong>💰 Gaveta de Dinheiro:</strong> normalmente liga à impressora térmica via RJ11 e exige comando ESC/POS compatível.</p></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Minhas Configurações</h3></div>' +
    (disps.length ? '<div style="display:grid;gap:12px">' + disps.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px;border:1px solid var(--border);border-radius:8px;gap:10px;flex-wrap:wrap"><div style="flex:1"><div style="font-weight:700">' + esc(d.nome) + ' ' + badge(d.padrao ? 'Padrão' : 'Secundária', d.padrao ? 'success' : 'secondary') + '</div><div style="font-size:.85rem;color:var(--text-muted);margin-top:4px">Tipo: ' + esc(d.tipo) + ' • Conexão: ' + esc(d.conexao) + '</div></div><div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="btn btn-sm btn-primary" onclick="testarImpressora(' + d.id + ')"><i class="fas fa-print"></i> Testar</button>' +
      (d.tipo !== 'gaveta' ? '<button class="btn btn-sm btn-warning" onclick="abrirGaveta(' + d.id + ')"><i class="fas fa-cash-register"></i> Gaveta</button>' : '') +
      '<button class="btn btn-sm btn-info" onclick="definirPadrao(' + d.id + ')"><i class="fas fa-star"></i></button>' +
      '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'dispositivos\',' + d.id + ',\'dispositivos\')"><i class="fas fa-trash"></i></button></div></div>').join('') + '</div>' : emptyState('fa-print', 'Nenhum dispositivo configurado')) + '</div>';
}
async function detectarImpressoras() {
  const det = [];
  const adicionar = item => { if (item && item.nome && !det.some(x => x.nome.toLowerCase() === String(item.nome).toLowerCase())) det.push(item); };
  // A listagem completa das impressoras do Windows só é disponibilizada pela ponte nativa autorizada.
  if (window.kanawaNative && typeof window.kanawaNative.listarImpressoras === 'function') {
    try { const lista = await window.kanawaNative.listarImpressoras(); (lista || []).forEach(i => adicionar({ nome: i.name || i.nome, tipo: 'Impressora', metodo: 'Sistema nativo', disponivel: i.isDefault === false ? true : true, padraoSistema: !!i.isDefault })); } catch (e) { console.warn('Detecção nativa de impressoras:', e.message); }
  }
  // WebUSB/WebSerial só enumeram equipamentos que o utilizador já autorizou no navegador.
  if (navigator.usb && typeof navigator.usb.getDevices === 'function') {
    try { const lista = await navigator.usb.getDevices(); lista.forEach(d => adicionar({ nome: d.productName || 'Dispositivo USB autorizado', tipo: 'USB', metodo: 'WebUSB (autorizado)', disponivel: true })); } catch (e) { }
  }
  if (navigator.serial && typeof navigator.serial.getPorts === 'function') {
    try { const portas = await navigator.serial.getPorts(); portas.forEach((p, i) => adicionar({ nome: 'Dispositivo Serial ' + (i + 1), tipo: 'Serial', metodo: 'Web Serial (autorizado)', disponivel: true })); } catch (e) { }
  }
  if (navigator.bluetooth && typeof navigator.bluetooth.getDevices === 'function') {
    try { const lista = await navigator.bluetooth.getDevices(); lista.forEach(d => adicionar({ nome: d.name || 'Dispositivo Bluetooth autorizado', tipo: 'Bluetooth', metodo: 'Bluetooth (autorizado)', disponivel: true })); } catch (e) { }
  }
  return det;
}
async function detectarEDetalhes() {
  toast('🔍 A procurar impressoras e periféricos autorizados...', 'info');
  await openModule('dispositivos');
  toast('Detecção atualizada. Para listar todas as impressoras do Windows, é necessária a ligação nativa do Kanawa Soft.', 'info');
}
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
  openModal('🖨️ ' + ((window.KanawaFiscalDocuments&&KanawaFiscalDocuments.label(venda.tipoDocumento))||'Documento') + ' — ' + venda.numeroFatura,
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
  if (!w) { toast('Permita janelas de impressão no navegador.','warning'); return; }
  const copia = '<section class="invoice-copy">' + el.innerHTML + '</section>';
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Fatura — 2 cópias</title><style>body{font-family:Arial;padding:0;margin:0;color:#111}.invoice-copy{padding:12mm 10mm;box-sizing:border-box;break-after:page;page-break-after:always}.invoice-copy:last-child{break-after:auto;page-break-after:auto}table{width:100%;border-collapse:collapse}th{background:#1a3a5c;color:#fff;padding:8px}td{padding:6px;border-bottom:1px solid #e2e8f0}@page{margin:5mm}</style></head><body>' + copia + copia + '</body></html>');
  w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 500);
}
function imprimirTermica() {
  const v = window._vendaAtual; if (!v) return;
  const emp = v.empresa || JSON.parse(localStorage.getItem('kanawa_empresa') || '{}');
  const texto = ['=================================', '   ' + (emp.firma || emp.nome || 'KANAWA SOFT').toUpperCase(), '   NIF: ' + (emp.nif || '-'), '   ' + (emp.endereco || 'Luanda, Angola'), '   Tel: ' + (emp.telefone || '-'), '=================================', (({FT:'FATURA: ',FR:'FATURA-RECIBO: ',RE:'RECIBO: ',PP:'FATURA PROFORMA: ',NC:'NOTA DE CRÉDITO: '}[v.tipoDocumento]||'DOCUMENTO: ') + v.numeroFatura), 'Data: ' + fmtDT(v.data), 'Cliente: ' + v.clienteNome, (v.clienteNif ? 'NIF: ' + v.clienteNif : ''), '=================================', ...(v.itens || []).map(it => it.nome.substring(0, 20).padEnd(20) + '\n  ' + it.qty + ' x ' + fmt(it.preco).padEnd(12) + fmt(it.subtotal)), '=================================', 'Subtotal:    ' + fmt(v.subtotal), (v.desconto > 0 ? 'Desconto:    -' + fmt(v.descontoValor) : ''), 'Imposto:     ' + fmt(v.iva), 'TOTAL:       ' + fmt(v.total), v.valorRecebido > 0 ? 'Recebido:    ' + fmt(v.valorRecebido) : '', v.valorRecebido > 0 ? 'Troco:       ' + fmt(v.troco) : '', '=================================', 'Valor: ' + numeroPorExtenso(v.total), '---------------------------------', (emp.banco ? 'Banco: ' + emp.banco : ''), (emp.iban ? 'IBAN: ' + emp.iban : ''), '---------------------------------', '    Obrigado pela preferência!', '   Modelo de teste — AGT não certificada', '   Kanawa Soft ERP 1.0', '================================='].filter(Boolean).join('\n');
  const w = window.open('', '_blank', 'width=300,height=600');
  if (!w) { toast('Permita janelas de impressão no navegador.','warning'); return; }
  const duasCopias = texto + '\n\n========== 2.ª VIA ==========\n\n' + texto;
  w.document.write('<!doctype html><html><head><title>Fatura-Recibo — 2 cópias</title><style>@media print{@page{margin:0;size:58mm auto}}body{font-family:"Courier New",monospace;font-size:11px;width:200px;margin:0 auto;padding:5px;white-space:pre-wrap;line-height:1.3}</style></head><body>' + duasCopias + '</body></html>');
  w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 500); abrirGavetaAutomatico();
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
  const allProducts=await getData('produtos',{force:true,waitForCloud:true}),actor=kanawaCurrentActor();
  pdvCache.produtos=actor.role==='admin'?allProducts:allProducts.filter(p=>p.precoAprovado!==false);
  pdvCache.ts=t;return pdvCache.produtos;
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

async function renderCaixa() {
  if(!window.KanawaCloud||!KanawaCloud.ready) return header('Caixa','Abertura e fecho com registo central','var(--success)','','fa-cash-register')+'<div class="card">Ligue a empresa à nuvem para abrir ou fechar uma caixa com segurança.</div>';
  const actor=kanawaCurrentActor(), cashier=['caixa','operador','operator'].includes(actor.role);
  let active=null,sessions=[],requests=[];
  try {
    const jobs=[KanawaCloud.listCashSessions(150),KanawaCloud.listSaleCancellationRequests()];
    if(cashier) jobs.push(KanawaCloud.getActiveCashSession());
    const result=await Promise.all(jobs); sessions=result[0]||[]; requests=result[1]||[]; active=cashier?result[2]:null;
  } catch(error) { return header('Caixa','Sessões e autorizações','var(--success)','','fa-cash-register')+'<div class="card"><p>'+esc(error.message||'Não foi possível carregar as caixas.')+'</p></div>'; }
  const activeBox=active
    ? '<div class="card" style="border-left:4px solid var(--success)"><h3>Caixa aberta</h3><div class="metric-grid"><div class="metric-card"><div class="label">Abertura</div><div class="value">'+fmtDT(active.opened_at)+'</div></div><div class="metric-card"><div class="label">Fundo inicial</div><div class="value">'+fmt(active.opening_float)+'</div></div><div class="metric-card"><div class="label">Meta de venda</div><div class="value">'+fmt(active.target_amount)+'</div></div></div><div class="form-grid"><div class="form-group"><label>Dinheiro contado no fecho (Kz)</label><input id="cashCounted" type="number" min="0" value="'+esc(active.opening_float||0)+'"></div></div><button class="btn btn-danger" onclick="fecharCaixaAgora(\''+esc(active.id)+'\')"><i class="fas fa-lock"></i> Fechar caixa e calcular resultado</button></div>'
    : cashier ? '<div class="card"><h3><i class="fas fa-unlock"></i> Abrir caixa</h3><p>Registe o fundo inicial e a meta de vendas antes de iniciar o atendimento.</p><div class="form-grid"><div class="form-group"><label>Fundo inicial (Kz)</label><input id="cashOpening" type="number" min="0" value="0"></div><div class="form-group"><label>Meta de vendas (Kz)</label><input id="cashTarget" type="number" min="0" value="0"></div><div class="form-group"><label>Identificação da caixa</label><input id="cashTerminal" maxlength="80" placeholder="Ex.: Caixa 01"></div></div><button class="btn btn-success" onclick="abrirCaixaAgora()"><i class="fas fa-unlock"></i> Abrir caixa</button></div>'
    : '<div class="card"><p>O perfil '+esc(actor.roleLabel)+' acompanha as sessões da equipa. A abertura é feita pelo utilizador com perfil Caixa.</p></div>';
  const sessionRows=sessions.map(s=>[esc(s.cashier_name),badge(s.status==='open'?'Aberta':'Fechada',s.status==='open'?'success':'secondary'),fmtDT(s.opened_at),fmtDT(s.closed_at),fmt(s.opening_float),fmt(s.sales_total),String(s.sales_count||0),fmt(s.target_amount),s.status==='closed'?(Number(s.sales_total)>=Number(s.target_amount)?badge('Meta atingida','success'):badge('Meta não atingida','warning')):'Em curso']);
  const pending=requests.filter(r=>r.status==='pending');
  const canReview=['admin','operador','operator'].includes(actor.role);
  const requestRows=requests.map(r=>[esc(r.invoice_number),esc(r.cashier_name),esc(r.reason),badge(r.status,r.status==='approved'?'success':r.status==='rejected'?'danger':'warning'),fmtDT(r.created_at),canReview&&r.status==='pending'&&!(['operador','operator'].includes(actor.role)&&r.cashier_user_id===KanawaCloud.context.user.id)?'<button class="btn btn-sm btn-success" onclick="decidirCancelamentoVenda(\''+esc(r.id)+'\',true)">Autorizar</button> <button class="btn btn-sm btn-danger" onclick="decidirCancelamentoVenda(\''+esc(r.id)+'\',false)">Rejeitar</button>':'—']);
  return header('Gestão de Caixa','Abertura, fecho, metas e cancelamentos · '+actor.roleLabel,'var(--success)','<button class="btn btn-light" onclick="imprimirTelaAtual()"><i class="fas fa-print"></i> Imprimir</button>','fa-cash-register')+
    activeBox+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Caixas abertas</div><div class="value">'+sessions.filter(s=>s.status==='open').length+'</div></div><div class="metric-card"><div class="label">Vendas registadas</div><div class="value">'+fmt(sessions.reduce((sum,s)=>sum+Number(s.sales_total||0),0))+'</div></div><div class="metric-card"><div class="label">Pedidos pendentes</div><div class="value">'+pending.length+'</div></div></div>'+
    '<div class="card"><h3>Sessões de caixa</h3>'+table(['Caixa','Estado','Abertura','Fecho','Fundo inicial','Vendas','Qtd. vendas','Meta','Avaliação'],sessionRows)+'</div>'+
    '<div class="card"><h3>Pedidos de cancelamento de venda</h3><p class="text-muted">Caixa ou operador solicita; operador, gerente ou administrador analisa e decide. O cancelamento fica registado no histórico.</p>'+(requestRows.length?table(['Fatura','Caixa','Motivo','Estado','Data','Decisão'],requestRows):emptyState('fa-check-circle','Sem pedidos de cancelamento.'))+'</div>';
}
async function abrirCaixaAgora() {
  const opening=num($('cashOpening')&&$('cashOpening').value,0),target=num($('cashTarget')&&$('cashTarget').value,0),terminal=$('cashTerminal')&&$('cashTerminal').value||'';
  if(opening<0||target<0){toast('Os valores não podem ser negativos.','warning');return;}
  try{await KanawaCloud.openCashSession(opening,target,terminal);toast('Caixa aberta com sucesso.','success');openModule('caixa');}
  catch(error){toast(error.message||'Não foi possível abrir a caixa.','error');}
}
async function fecharCaixaAgora(sessionId) {
  const counted=num($('cashCounted')&&$('cashCounted').value,-1);
  if(counted<0){toast('Informe o dinheiro contado no fecho.','warning');return;}
  try{const result=await KanawaCloud.closeCashSession(sessionId,counted);const achieved=Number(result.sales_total)>=Number(result.target_amount);openModal('Resultado do fecho de caixa','<div class="metric-grid"><div class="metric-card"><div class="label">Total vendido</div><div class="value">'+fmt(result.sales_total)+'</div></div><div class="metric-card"><div class="label">Esperado em caixa</div><div class="value">'+fmt(result.expected_cash)+'</div></div><div class="metric-card"><div class="label">Diferença</div><div class="value">'+fmt(result.difference)+'</div></div></div><p><strong>'+ (achieved?'Meta atingida':'Meta não atingida')+'</strong> · '+result.sales_count+' vendas</p><button class="btn btn-primary btn-block" onclick="closeModal();openModule(\'caixa\')">Concluir</button>');}
  catch(error){toast(error.message||'Não foi possível fechar a caixa.','error');}
}
async function decidirCancelamentoVenda(requestId,approve) {
  const note=window.prompt(approve?'Confirme o motivo/autorização do cancelamento:':'Motivo da rejeição:','');
  if(note===null)return;
  try{await KanawaCloud.reviewSaleCancellation(requestId,approve,note);toast(approve?'Venda cancelada e registada.':'Pedido de cancelamento rejeitado.','success');openModule('caixa');}
  catch(error){toast(error.message||'Não foi possível decidir o pedido.','error');}
}
async function solicitarCancelamentoVenda(saleId,invoice) {
  const role=kanawaCurrentActor().role;
  if(!['caixa','operador','operator'].includes(role)){toast('Apenas o Caixa ou Operador pode solicitar o cancelamento.','warning');return;}
  const reason=window.prompt('Indique o motivo para solicitar o cancelamento da fatura '+invoice+':','');
  if(reason===null)return;
  try{await KanawaCloud.requestSaleCancellation(String(saleId),reason);toast('Pedido enviado ao operador para análise.','success');openModule('vendas');}
  catch(error){toast(error.message||'Não foi possível enviar o pedido.','error');}
}

async function renderPDV() {
  const actor=kanawaCurrentActor();
  if(['caixa','operador','operator'].includes(actor.role)&&(!window.KanawaCloud||!KanawaCloud.ready))
    return header('PDV indisponível','Abertura de caixa exige ligação ao servidor','var(--warning)','','fa-cash-register')+
      '<div class="card"><h3><i class="fas fa-wifi"></i> Ligue o sistema à nuvem</h3><p>O perfil Caixa só pode iniciar vendas depois de abrir uma sessão confirmada no servidor. Restabeleça a ligação e abra a caixa.</p><button class="btn btn-success" onclick="openModule(\'caixa\')">Abrir / gerir caixa</button></div>';
  if(['caixa','operador','operator'].includes(actor.role)){
    try{
      const activeSession=await KanawaCloud.getActiveCashSession();
      if(!activeSession)return header('PDV — Caixa ainda não aberta','Abertura obrigatória antes de iniciar vendas','var(--warning)','', 'fa-cash-register')+
        '<div class="card"><h3><i class="fas fa-lock"></i> Abra a sua caixa primeiro</h3><p>O seu perfil é Caixa. Para iniciar vendas, registe o fundo inicial e a meta na sessão de caixa. Depois de abrir, volte ao PDV.</p><button class="btn btn-success" onclick="openModule(\'caixa\')"><i class="fas fa-unlock"></i> Abrir / gerir caixa</button></div>';
    }catch(error){return header('PDV indisponível','Não foi possível confirmar a sessão de caixa','var(--danger)','','fa-cash-register')+
      '<div class="card"><p>'+esc(error.message||'Confirme a ligação e o estado da caixa.')+'</p><button class="btn btn-light" onclick="openModule(\'caixa\')">Ver gestão de caixa</button></div>';}
  }
  const produtos = await carregarCachePDV();
  kanawaCommercialPolicy=null;
  if(window.KanawaCloud&&KanawaCloud.ready&&typeof KanawaCloud.getCommercialPolicy==='function') {
    try { kanawaCommercialPolicy=await KanawaCloud.getCommercialPolicy(); } catch(policyError) { console.warn('Limites comerciais:',policyError); }
  }
  const favs=pdvCache.favoritos;
  if(!pdvState.cliente) pdvState.cliente={nome:'Cliente Anônimo',nif:'',telefone:'',endereco:''};
  const subtotal=pdvState.carrinho.reduce((sum,item)=>sum+Number(item.subtotal||0),0);
  const totalEstimado=pdvCalcularTotalEstimado(subtotal);
  return header('PDV — Ponto de Venda',produtos.length+' produtos disponíveis','var(--success)',
    '<button class="btn btn-sm" onclick="abrirScanner()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-barcode"></i> Scanner</button>'+
    '<button class="btn btn-sm" onclick="imprimirEtiquetasLote()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-tags"></i> Etiquetas</button>'+
    '<button class="btn btn-sm" onclick="openModule(\'vendas\')" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-history"></i> Histórico</button>'+
    '<button class="btn btn-sm" onclick="abrirModalAprovacaoComercial()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-stamp"></i> Pedir autorização</button>','fa-cash-register')+
    '<div class="pdv-workspace">'+
      '<section class="pdv-products-panel card">'+
        '<div class="pdv-panel-heading"><div><h3 class="card-title"><i class="fas fa-boxes"></i> Produtos</h3><small>Pesquise, leia o código ou seleccione um artigo</small></div><span class="badge badge-info">'+produtos.length+' artigos</span></div>'+
        '<div class="pdv-search-row">'+
          '<input type="search" id="pdvBusca" aria-label="Pesquisar produtos" placeholder="Pesquisar produto (F2)" oninput="filtrarPDV(this.value)">'+
          '<input type="text" id="pdvCodigoBarras" aria-label="Código de barras" placeholder="Código de barras ou QR Code" onkeydown="if(event.key===\'Enter\'){event.preventDefault();buscarPorCodigo(this.value);this.value=\'\'}">'+
          '<button class="btn btn-info" type="button" onclick="abrirScanner()" title="Ler código com a câmara"><i class="fas fa-camera"></i></button>'+
        '</div>'+
        '<div class="pdv-products-grid" id="pdvProductsGrid">'+renderGridProdutos(produtos,favs)+'</div>'+
      '</section>'+
      '<aside class="pdv-cart-panel card" aria-label="Carrinho de compras">'+
        '<div class="pdv-panel-heading"><div><h3 class="card-title"><i class="fas fa-shopping-cart"></i> Carrinho</h3><small><span id="pdvCartCount">'+pdvState.carrinho.length+'</span> artigos na venda</small></div><button class="btn btn-sm btn-secondary" id="pdvClearCart" onclick="pdvLimparCarrinho()" '+(pdvState.carrinho.length?'':'disabled')+'><i class="fas fa-trash"></i> Limpar</button></div>'+
        '<div class="pdv-cart-client">'+
          '<div class="pdv-client-heading"><strong><i class="fas fa-user"></i> Cliente</strong><button class="btn btn-sm btn-secondary" onclick="pdvClienteAnonimo()">Consumidor final</button></div>'+
          '<input id="pdvClienteNome" aria-label="Nome do cliente" value="'+esc(pdvState.cliente.nome||'Cliente Anônimo')+'" placeholder="Nome do cliente" oninput="pdvAtualizarClienteCampo(\'nome\',this.value)">'+
          '<div class="pdv-client-fields"><input id="pdvClienteNif" aria-label="NIF do cliente" value="'+esc(pdvState.cliente.nif||'')+'" placeholder="NIF (opcional)" maxlength="20" oninput="pdvAtualizarClienteCampo(\'nif\',this.value)"><input id="pdvClienteTel" aria-label="Telefone do cliente" value="'+esc(pdvState.cliente.telefone||'')+'" placeholder="Telefone" oninput="pdvAtualizarClienteCampo(\'telefone\',this.value)"></div>'+
          '<div class="pdv-nif-hint" id="pdvNifHint">Consumidor final seleccionado por defeito. NIF pode ficar em branco quando não for exigido.</div>'+
        '</div>'+
        '<div class="pdv-cart-list" id="pdvCarrinhoFull">'+pdvCarrinhoHTML()+'</div>'+
        '<div class="pdv-cart-footer">'+
          '<div class="pdv-cart-subtotal"><span>Subtotal dos artigos</span><strong id="pdvSidebarSubtotal">'+fmt(subtotal)+'</strong></div>'+
          '<div class="pdv-cart-total"><span>Total estimado</span><strong id="pdvSidebarTotal">'+fmt(totalEstimado)+'</strong></div>'+
          '<button class="btn btn-info btn-block" id="pdvProformaButton" type="button" onclick="pdvSalvarOrcamento()" '+(pdvState.carrinho.length?'':'disabled')+'><i class="fas fa-file-invoice"></i> Guardar / emitir pró-forma</button>'+
          '<button class="btn btn-success btn-lg btn-block" id="pdvPayButton" onclick="pdvAbrirFechoVenda()" '+(pdvState.carrinho.length?'':'disabled')+'><i class="fas fa-cash-register"></i> Pagar <kbd>F8</kbd></button>'+
          '<div class="pdv-shortcuts-hint"><span><kbd>F2</kbd> Pesquisar</span><span><kbd>F8</kbd> Pagar</span><span><kbd>+</kbd>/<kbd>−</kbd> Quantidade</span></div>'+
        '</div>'+
      '</aside>'+
    '</div>';
}
function pdvCalcularTotalEstimado(subtotal) {
  const value=Math.max(0,Number(subtotal)||0);
  const discount=Math.max(0,Math.min(100,Number(pdvState.desconto)||0));
  const base=value*(1-discount/100);
  const rate=!pdvState.aplicarIVA?0:(pdvState.regime==='geral'?0.14:(pdvState.regime==='simplificado'?0.07:0));
  return base+(base*rate);
}
function pdvCarrinhoHTML() {
  if(!pdvState.carrinho.length) return emptyState('fa-shopping-cart','Carrinho vazio — seleccione produtos para começar');
  return pdvState.carrinho.map(function(item){
    const selected=Number(pdvSelectedItemId)===Number(item.id);
    return '<div class="pdv-cart-item '+(selected?'selected':'')+'" data-cart-item="'+esc(item.id)+'" onclick="pdvSelecionarItemCarrinho('+Number(item.id)+')">'+
      '<div class="pdv-cart-item-main"><strong>'+esc(item.nome)+'</strong><small>'+fmt(item.preco)+' × '+Number(item.qty||0)+'</small></div>'+
      '<div class="pdv-qty-control">'+
        '<button type="button" aria-label="Diminuir quantidade" onclick="event.stopPropagation();pdvAltQty('+Number(item.id)+',-1)">−</button>'+
        '<strong>'+Number(item.qty||0)+'</strong>'+
        '<button type="button" aria-label="Aumentar quantidade" onclick="event.stopPropagation();pdvAltQty('+Number(item.id)+',1)">+</button>'+
      '</div>'+
      '<strong class="pdv-line-total">'+fmt(item.subtotal)+'</strong>'+
      '<button type="button" class="pdv-remove-item" aria-label="Remover artigo" onclick="event.stopPropagation();pdvRemoverItem('+Number(item.id)+')"><i class="fas fa-times"></i></button>'+
    '</div>';
  }).join('');
}
function pdvAtualizarClienteCampo(campo,valor) {
  if(!pdvState.cliente) pdvState.cliente={nome:'Cliente Anônimo',nif:'',telefone:'',endereco:''};
  pdvState.cliente[campo]=String(valor||'').trim();
}
function pdvValidarNif(nif,clienteAnonimo) {
  const value=String(nif||'').trim().toUpperCase().replace(/[ .-]/g,'');
  if(!value) return {valid:true,value:'',message:''};
  if(clienteAnonimo&&value==='999999999') return {valid:true,value:value,message:'NIF genérico introduzido; confirme a configuração fiscal da empresa.'};
  // NIF de cidadão nacional corresponde ao BI; entidades colectivas usam numeração sequencial.
  // A AGT também atribui números sequenciais a outros contribuintes; não existe dígito de controlo público universal.
  const bilhete=/^\d{9}[A-Z]{2}\d{3}$/.test(value);
  const sequencial=/^\d{10}$/.test(value);
  const legacy=/^\d{9}$/.test(value);
  const other=/^[A-Z0-9]{8,20}$/.test(value);
  if(bilhete||sequencial||legacy||other) return {valid:true,value:value,message:''};
  return {valid:false,value:value,message:'Formato de NIF não reconhecido. Confirme o número no documento fiscal do cliente.'};
}
function pdvSincronizarCliente() {
  const name=$('pdvClienteNome'),nif=$('pdvClienteNif'),phone=$('pdvClienteTel'),address=$('pdvClienteEndereco');
  if(name) pdvState.cliente.nome=name.value.trim()||'Cliente Anônimo';
  if(nif) pdvState.cliente.nif=nif.value.trim().toUpperCase();
  if(phone) pdvState.cliente.telefone=phone.value.trim();
  if(address) pdvState.cliente.endereco=address.value.trim();
  const anon=!pdvState.cliente.nome||pdvState.cliente.nome.toLowerCase()==='cliente anônimo';
  const validation=pdvValidarNif(pdvState.cliente.nif,anon);
  const hint=$('pdvNifHint');
  if(hint) hint.textContent=validation.message||'NIF conferido apenas quanto à estrutura; a validade deve ser confirmada junto da AGT.';
  if(!validation.valid){toast(validation.message,'warning');if(nif)nif.focus();return false;}
  return true;
}
function pdvSelecionarItemCarrinho(id) {
  pdvSelectedItemId=id;
  pdvRenderCarrinhoFull();
}
function pdvLimparCarrinho() {
  if(!pdvState.carrinho.length) return;
  if(!confirm('Remover todos os artigos do carrinho?')) return;
  pdvState.carrinho=[];
  pdvSelectedItemId=null;
  pdvRenderCarrinhoFull();
}
function pdvAtualizarTipoDocumento() {
  const credit=pdvState.pagamento==='credito';
  const label=credit?'FT — Factura (crédito)':'FR — Factura-Recibo (pagamento imediato)';
  const el=$('pdvTipoDocumento');
  if(el) el.textContent=label;
  const note=$('pdvTipoDocumentoNota');
  if(note) note.textContent=credit?'Pagamento a prazo: confirmar condições e vencimento.':'Pagamento imediato: confirmar recebimento antes de emitir.';
}
function pdvAbrirFechoVenda() {
  if(!pdvState.carrinho.length){toast('Adicione pelo menos um artigo antes de pagar.','warning');return;}
  if(!pdvSincronizarCliente()) return;
  const methods=[
    {v:'dinheiro',i:'fa-money-bill-wave',l:'Dinheiro'},
    {v:'cartao',i:'fa-credit-card',l:'Cartão'},
    {v:'transferencia',i:'fa-university',l:'Transferência'},
    {v:'multicaixa',i:'fa-mobile-alt',l:'Multicaixa'},
    {v:'misto',i:'fa-random',l:'Misto'},
    {v:'credito',i:'fa-file-invoice',l:'Crédito'}
  ];
  openModal('Fechar venda — pagamento e documento',
    '<div id="pdvPaymentModal" class="pdv-payment-modal">'+
      '<div class="pdv-payment-top"><div><small>Documento previsto</small><strong id="pdvTipoDocumento">FR — Factura-Recibo (pagamento imediato)</strong><p id="pdvTipoDocumentoNota">Pagamento imediato: confirmar recebimento antes de emitir.</p></div><div class="pdv-payment-total"><small>Total a pagar</small><strong id="pdvCalcTotal">'+fmt(pdvState.carrinho.reduce((s,x)=>s+Number(x.subtotal||0),0))+'</strong></div></div>'+
      '<div class="pdv-payment-columns">'+
        '<section><h4>Forma de pagamento</h4><div class="payment-methods-grid">'+methods.map(function(p){return '<button type="button" class="payment-method-card '+(pdvState.pagamento===p.v?'selected':'')+'" data-payment="'+p.v+'" onclick="pdvSelecionarPagamento(\''+p.v+'\')"><i class="fas '+p.i+'"></i><span>'+p.l+'</span></button>';}).join('')+'</div>'+
          '<div class="form-grid pdv-payment-fields">'+
            '<div class="form-group"><label for="pdvDescontoInput">Desconto (%) — limite '+kanawaMaxDiscount()+'%</label><input type="number" id="pdvDescontoInput" value="'+Number(pdvState.desconto||0)+'" min="0" max="'+kanawaMaxDiscount()+'" step="0.01" oninput="pdvAtualizarValores()"></div>'+
            '<div class="form-group"><label for="pdvValorRecebidoInput">Valor recebido (Kz)</label><input type="number" id="pdvValorRecebidoInput" value="'+Number(pdvState.valorRecebido||0)+'" min="0" step="0.01" oninput="pdvAtualizarValores()"></div>'+
            '<div class="form-group"><label for="pdvRegimeInput">Regime fiscal</label><select id="pdvRegimeInput" onchange="pdvAtualizarValores()"><option value="geral" '+(pdvState.regime==='geral'?'selected':'')+'>Regime Geral</option><option value="simplificado" '+(pdvState.regime==='simplificado'?'selected':'')+'>Regime Simplificado</option><option value="isento" '+(pdvState.regime==='isento'?'selected':'')+'>Isento</option></select></div>'+
            '<div class="form-group"><label>IVA</label><label class="pdv-iva-toggle"><input type="checkbox" id="pdvAplicarIVA" '+(pdvState.aplicarIVA?'checked':'')+' onchange="pdvAtualizarValores()"> Aplicar IVA configurado</label></div>'+
          '</div>'+
        '</section>'+
        '<section class="pdv-payment-summary"><h4>Resumo da venda</h4>'+
          '<div class="pdv-summary-row"><span>Subtotal</span><strong id="pdvCalcSubtotal">'+fmt(0)+'</strong></div>'+
          '<div class="pdv-summary-row"><span>Desconto</span><strong id="pdvCalcDesconto">-'+fmt(0)+'</strong></div>'+
          '<div class="pdv-summary-row"><span>Matéria colectável</span><strong id="pdvCalcBase">'+fmt(0)+'</strong></div>'+
          '<div class="pdv-summary-row"><span>IVA</span><strong id="pdvCalcIVA">'+fmt(0)+'</strong></div>'+
          '<div class="pdv-summary-row pdv-summary-grand"><span>Total</span><strong id="pdvTotalFinalTela5">'+fmt(0)+'</strong></div>'+
          '<div class="pdv-change-box" id="pdvTrocoBox" style="display:none"><small id="pdvTrocoLabel">Troco</small><strong id="pdvTrocoValue">'+fmt(0)+'</strong></div>'+
          '<p class="pdv-customer-summary" id="pdvFechoClienteResumo">Cliente: '+esc(pdvState.cliente.nome||'Cliente Anônimo')+' · NIF: '+esc(pdvState.cliente.nif||'não indicado')+'</p>'+
        '</section>'+
      '</div>'+
      '<div class="pdv-payment-actions"><button type="button" class="btn btn-secondary" onclick="closeModal()">Voltar ao carrinho</button><button type="button" class="btn btn-success btn-lg" id="pdvConfirmarPagamento" onclick="pdvFinalizarVenda()"><i class="fas fa-check-circle"></i> Confirmar e emitir</button></div>'+
    '</div>',true);
  pdvSelecionarPagamento(pdvState.pagamento);
  pdvAtualizarValores();
  pdvAtualizarTipoDocumento();
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
  else { const precoVenda = Number(p.precoVenda !== undefined ? p.precoVenda : p.preco) || 0; const custoRaw = p.precoCompra !== undefined ? p.precoCompra : p.purchase_cost; const custoUnitario = custoRaw === null || custoRaw === undefined || custoRaw === '' ? null : Number(custoRaw); pdvState.carrinho.push({ id: p.id, nome: p.nome, preco: precoVenda, custoUnitario, qty: 1, subtotal: precoVenda, imagem: p.imagem, codigoBarras: p.codigoBarras, codigo: p.codigo || p.sku || '', unidade: p.unidade || p.unit || 'UN', taxRate: p.taxaIVA !== undefined ? p.taxaIVA : (p.taxRate !== undefined ? p.taxRate : undefined), taxExempt: p.taxExempt === true || p.isentoIVA === true, exemptionReason: p.motivoIsencaoIVA || p.exemptionReason || '' }); }
  pdvSelectedItemId=p.id;
  pdvRenderCarrinhoFull();
  toast('Adicionado: '+p.nome,'success');
}
function pdvRenderCarrinhoFull() {
  const box=$('pdvCarrinhoFull'); if(!box)return;
  box.innerHTML=pdvCarrinhoHTML();
  const count=pdvState.carrinho.reduce((sum,item)=>sum+Number(item.qty||0),0);
  const subtotal=pdvState.carrinho.reduce((sum,item)=>sum+Number(item.subtotal||0),0);
  const totalEstimado=pdvCalcularTotalEstimado(subtotal);
  const set=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
  set('pdvCartCount',count+'');
  set('pdvScreen1Total',count+' itens');
  set('pdvSubtotalTela2',fmt(subtotal));
  set('pdvSidebarSubtotal',fmt(subtotal));
  set('pdvSidebarTotal',fmt(totalEstimado));
  const pay=$('pdvPayButton');if(pay)pay.disabled=!pdvState.carrinho.length;
  const proforma=$('pdvProformaButton');if(proforma)proforma.disabled=!pdvState.carrinho.length;
  const clear=$('pdvClearCart');if(clear)clear.disabled=!pdvState.carrinho.length;
}
function pdvAltQty(id,d) {
  const item=pdvState.carrinho.find(row=>Number(row.id)===Number(id));
  if(!item)return;
  const product=pdvCache.produtos.find(row=>Number(row.id)===Number(id));
  const next=Number(item.qty||0)+Number(d||0);
  if(next>0&&product&&next>Number(product.estoque||0)){
    toast('Quantidade superior ao stock disponível ('+Number(product.estoque||0)+').','warning');
    return;
  }
  if(next<=0){
    pdvState.carrinho=pdvState.carrinho.filter(row=>Number(row.id)!==Number(id));
    pdvSelectedItemId=pdvState.carrinho.length?pdvState.carrinho[pdvState.carrinho.length-1].id:null;
  }else{
    item.qty=next;
    item.subtotal=Number(item.preco||0)*next;
    pdvSelectedItemId=item.id;
  }
  pdvRenderCarrinhoFull();
}
function pdvRemoverItem(id) {
  pdvState.carrinho=pdvState.carrinho.filter(row=>Number(row.id)!==Number(id));
  if(Number(pdvSelectedItemId)===Number(id))pdvSelectedItemId=pdvState.carrinho.length?pdvState.carrinho[pdvState.carrinho.length-1].id:null;
  pdvRenderCarrinhoFull();
  toast('Artigo removido','info');
}
function pdvSalvarCliente() { return pdvSincronizarCliente(); }
function pdvClienteAnonimo() {
  pdvState.cliente={nome:'Cliente Anônimo',nif:'',telefone:'',endereco:''};
  const fields={pdvClienteNome:'Cliente Anônimo',pdvClienteNif:'',pdvClienteTel:'',pdvClienteEndereco:''};
  Object.keys(fields).forEach(id=>{const el=$(id);if(el)el.value=fields[id];});
  const hint=$('pdvNifHint');if(hint)hint.textContent='Consumidor final seleccionado. Não foi atribuído um NIF fictício.';
  toast('Consumidor final seleccionado','info');
}
function pdvSelecionarPagamento(t) {
  pdvState.pagamento=t;
  if(t!=='dinheiro'&&t!=='misto'){
    pdvState.valorRecebido=0;
    const received=$('pdvValorRecebidoInput');if(received)received.value='0';
  }
  $$('.payment-method-card').forEach(el=>el.classList.toggle('selected',el.dataset.payment===t));
  const map={dinheiro:'Dinheiro',cartao:'Cartão',transferencia:'Transferência',multicaixa:'Multicaixa',misto:'Misto',credito:'Crédito'};
  const el=$('pdvPagamentoResumo');if(el)el.textContent=map[t]||t;
  pdvAtualizarTipoDocumento();
  pdvAtualizarValores();
}
function kanawaMaxDiscount() {
  const actor=kanawaCurrentActor();
  if(actor.role==='admin') return 100;
  const approved=kanawaCommercialPolicy&&kanawaCommercialPolicy.max_discount_percent;
  return approved===null||approved===undefined?getPerms().descontoMax:Math.max(0,Math.min(100,Number(approved)||0));
}
function pdvAtualizarValores() {
  const dEl=$('pdvDescontoInput'),vEl=$('pdvValorRecebidoInput'),rEl=$('pdvRegimeInput'),iEl=$('pdvAplicarIVA');
  if(!dEl)return {subtotal:0,descontoValor:0,base:0,iva:0,total:0,troco:0};
  const maxD=kanawaMaxDiscount();let desc=num(dEl.value,0);if(desc>maxD){desc=maxD;dEl.value=maxD;}if(desc<0){desc=0;dEl.value=0;}
  const vRec=Math.max(0,num(vEl&&vEl.value,0)),regime=rEl?rEl.value:pdvState.regime,aplicarIVA=iEl?iEl.checked:pdvState.aplicarIVA;
  pdvState.desconto = desc; pdvState.valorRecebido = vRec; pdvState.regime = regime; pdvState.aplicarIVA = aplicarIVA;
  const taxaPadrao = regime === 'geral' ? 0.14 : (regime === 'simplificado' ? 0.07 : 0);
  const subtotal = pdvState.carrinho.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  let fiscal = null;
  if (window.KanawaFiscalDocuments && pdvState.carrinho.length) {
    fiscal = KanawaFiscalDocuments.calculateLines(pdvState.carrinho.map(i => Object.assign({}, i, {
      unitPrice: i.preco, quantity: i.qty,
      taxRate: i.taxRate !== undefined ? i.taxRate : (i.taxaIVA !== undefined ? i.taxaIVA : taxaPadrao),
      exemptionReason: i.exemptionReason || i.motivoIsencaoIVA || '',
      taxExempt: i.taxExempt === true
    })), { discountPercent: desc, defaultRate: taxaPadrao, applyTax: aplicarIVA });
  }
  const descVal = fiscal ? fiscal.discountValue : subtotal * (desc / 100);
  const base = fiscal ? fiscal.taxableBase : subtotal - descVal;
  const iva = fiscal ? fiscal.taxAmount : base * (aplicarIVA ? taxaPadrao : 0);
  const total = fiscal ? fiscal.total : base + iva, troco = vRec - total;
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('pdvCalcSubtotal', fmt(subtotal)); set('pdvCalcDesconto', '-' + fmt(descVal)); set('pdvCalcBase', fmt(base)); set('pdvCalcIVA', fmt(iva)); set('pdvCalcTotal', fmt(total)); set('pdvTotalFinalTela5', fmt(total));
  const tb=$('pdvTrocoBox'),tv=$('pdvTrocoValue'),tl=$('pdvTrocoLabel');
  if(tb&&tv){if(vRec>0&&pdvState.pagamento==='dinheiro'){tb.style.display='block';tv.textContent=troco>=0?fmt(troco):'Faltam '+fmt(Math.abs(troco));if(tl)tl.textContent=troco>=0?'Troco a entregar':'Valor ainda em falta';}else tb.style.display='none';}
  const confirmButton=$('pdvConfirmarPagamento');if(confirmButton)confirmButton.disabled=!(pdvState.carrinho.length>0&&total>0&&(!pdvState.pagamento||pdvState.pagamento!=='dinheiro'||vRec>=total));
  return {subtotal,descontoValor:descVal,base,iva,total,troco,linhasFiscais:fiscal?fiscal.lines:[],taxaPadrao};
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
  if(!pdvState.carrinho.length){toast('Adicione pelo menos um produto antes de criar a pró-forma.','warning');return;}
  if(!pdvSincronizarCliente())return;
  const c=pdvAtualizarValores(),user=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
  const quote=Object.assign(copy(pdvState),{tipoDocumento:'PP',numeroProforma:'PP-'+new Date().getFullYear()+'-'+generateUuid().slice(0,8).toUpperCase(),documentoFiscal:false,movimentaStock:false,movimentaFinanceiro:false,subtotal:c.subtotal,descontoValor:c.descontoValor,baseIncidencia:c.base,iva:c.iva,itens:(c.linhasFiscais||[]).map(line=>({id:line.id,nome:line.nome,qty:line.quantity,preco:line.unitPrice,subtotal:line.lineGross,taxRate:line.taxRate,taxAmount:line.taxAmount,unidade:line.unitOfMeasure,codigo:line.productCode,exemptionReason:line.exemptionReason})),total:c.total,status:'rascunho',empresaCliente:pdvState.cliente.nome||'Consumidor Final',responsavel:user.nome||'Admin',data:now(),dataEnvio:null,dataValidade:null,historico:[{evento:'Proforma comercial criada; sem movimentos fiscais, de stock ou financeiros',data:now(),responsavel:user.nome||'Admin'}]});
  try { await saveData('orcamentos',quote); const saved=(await DB.getAll('orcamentos')).find(item=>item.numeroProforma===quote.numeroProforma); toast('Pró-forma '+quote.numeroProforma+' guardada. Não é factura fiscal e não movimenta stock nem caixa.','success'); if(saved) await imprimirProforma(saved.id); else openModule('orcamentos'); } catch(error) { toast(error.message||'Não foi possível guardar a pró-forma.','error'); }
}
async function pdvFinalizarVenda(modo) {
  modo=modo||'finalizada';
  if(pdvFinalizing)return;
  if(!pdvState.carrinho.length){toast('Carrinho vazio','warning');return;}
  if(!pdvSincronizarCliente())return;
  pdvFinalizing=true;
  try{
    const c=pdvAtualizarValores();
    if(!Number.isFinite(c.total)||c.total<=0)throw new Error('A venda não pode ser finalizada com total igual a zero.');
    if(modo==='finalizada'&&pdvState.pagamento==='dinheiro'&&pdvState.valorRecebido<c.total)throw new Error('O valor recebido é inferior ao total da venda.');
    const emp=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
    const user=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
    const actor=kanawaCurrentActor();
    const saleLimit=Number(kanawaCommercialPolicy&&kanawaCommercialPolicy.max_sale_amount)||0;
    if(modo==='finalizada'&&saleLimit>0&&c.total>saleLimit&&actor.role!=='admin')throw new Error('O Financeiro definiu o limite de venda em '+fmt(saleLimit)+'. Solicite autorização para este valor.');
    let cashSession=null,onlineAtStart=false;
    if(modo==='finalizada'){
      if(!['admin','caixa','operador','operator'].includes(actor.role))throw new Error('Apenas o Caixa, Operador ou Administrador pode registar vendas.');
      if(!window.KanawaCloud||!KanawaCloud.ready||!KanawaCloud.context||!KanawaCloud.context.company||!KanawaCloud.context.user)throw new Error('Inicie sessão e sincronize a empresa online pelo menos uma vez antes de usar vendas offline.');
      onlineAtStart=!!(navigator.onLine&&await API.checkHealth());
      if(['caixa','operador','operator'].includes(actor.role)){
        cashSession=await KanawaCloud.getActiveCashSession();
        if(!cashSession)throw new Error('Abra a caixa enquanto estiver online. Uma sessão de caixa aberta e sincronizada é necessária para vender offline.');
      }
      for(const line of pdvState.carrinho){
        const product=await DB.get('produtos',line.id),quantity=Number(line.qty)||0;
        if(!product||quantity<=0)throw new Error('Verifique os produtos e as quantidades da venda.');
        if(Number(product.estoque||0)<quantity)throw new Error('Stock insuficiente para '+(product.nome||line.nome)+'. Disponível: '+(product.estoque||0)+'.');
      }
      if(!pdvPendingFinalSale){
        const tipoDocumento=pdvState.pagamento==='credito'?'FT':'FR';
        if(!emp.nif)throw new Error('Configure o NIF da empresa antes de emitir um documento de venda.');
        if(tipoDocumento==='FT'&&(pdvState.cliente.tipo==='empresa'||pdvState.cliente.isCompany===true||pdvState.cliente.tipoCliente==='colectivo')&&!String(pdvState.cliente.endereco||'').trim())throw new Error('A morada do cliente empresarial é obrigatória para a Fatura (FT).');
        if(window.KanawaFiscalDocuments)KanawaFiscalDocuments.validateTaxLines(c.linhasFiscais||[]);
        const venda={
          id:generateUuid(),numeroFatura:null,tipoDocumento,estadoCertificacao:'nao_certificado',baseIncidencia:c.base,taxaIVAAplicada:c.taxaPadrao,
          detalheFiscal:(c.linhasFiscais||[]).map(line=>({produtoId:line.id,codigo:line.productCode,quantidade:line.quantity,unidade:line.unitOfMeasure,precoUnitario:line.unitPrice,baseTributavel:line.taxableBase,taxaIVA:line.taxRate,valorIVA:line.taxAmount,motivoIsencao:line.exemptionReason})),
          clienteNome:pdvState.cliente.nome||'Consumidor Final',clienteNif:pdvState.cliente.nif||'999999999',clienteTelefone:pdvState.cliente.telefone,clienteEndereco:pdvState.cliente.endereco||'',
          operatorUserId:actor.id,operatorRole:actor.role,cashierUserId:['caixa','operador','operator'].includes(actor.role)?actor.id:null,cashSessionId:cashSession?cashSession.id:null,
          itens:pdvState.carrinho.map((i,index)=>{const fiscalLine=(c.linhasFiscais||[])[index]||{};return{id:i.id,nome:i.nome,preco:i.preco,custoUnitario:i.custoUnitario===null||i.custoUnitario===undefined?null:Number(i.custoUnitario),qty:i.qty,subtotal:i.subtotal,codigo:i.codigo||'',codigoBarras:i.codigoBarras||'',unidade:i.unidade||'UN',taxRate:fiscalLine.taxRate??(pdvState.aplicarIVA?c.taxaPadrao*100:0),taxAmount:fiscalLine.taxAmount??0,taxableBase:fiscalLine.taxableBase??i.subtotal,exemptionReason:fiscalLine.exemptionReason||''};}),
          subtotal:c.subtotal,desconto:pdvState.desconto,descontoValor:c.descontoValor,
          custoTotal:pdvState.carrinho.every(i=>i.custoUnitario!==null&&i.custoUnitario!==undefined)?pdvState.carrinho.reduce((sum,i)=>sum+Number(i.custoUnitario)*Number(i.qty||0),0):null,
          lucroBruto:pdvState.carrinho.every(i=>i.custoUnitario!==null&&i.custoUnitario!==undefined)?c.subtotal-c.descontoValor-pdvState.carrinho.reduce((sum,i)=>sum+Number(i.custoUnitario)*Number(i.qty||0),0):null,
          iva:c.iva,total:c.total,valorRecebido:pdvState.valorRecebido,troco:c.troco,pagamento:pdvState.pagamento,
          tipoDocumentoPrevisto:pdvState.pagamento==='credito'?'FT':'FR',regime:pdvState.regime,aplicarIVA:pdvState.aplicarIVA,observacoes:pdvState.observacoes,
          status:onlineAtStart?'finalizada':'pendente_sincronizacao',data:now(),clientEventId:generateUuid(),clientCreatedAt:now(),
          hash:gerarHash({total:c.total,data:Date.now()}),operador:actor.name||user.nome||'Utilizador',empresa:emp,orcamentoOrigem:pdvState.orcamentoOrigem||null
        };
        venda.assinatura=gerarAssinatura(venda);
        pdvPendingFinalSale=venda;
      }else{
        const pending=pdvPendingFinalSale;
        const sameCart=JSON.stringify(pending.itens.map(i=>[i.id,i.qty,i.preco,i.subtotal,i.custoUnitario]))===JSON.stringify(pdvState.carrinho.map(i=>[i.id,i.qty,i.preco,i.subtotal,i.custoUnitario]))&&
          Number(pending.total)===Number(c.total)&&Number(pending.desconto)===Number(pdvState.desconto)&&Number(pending.valorRecebido)===Number(pdvState.valorRecebido)&&
          String(pending.clienteNome||'')===String(pdvState.cliente.nome||'')&&String(pending.clienteNif||'')===String(pdvState.cliente.nif||'')&&
          String(pending.clienteTelefone||'')===String(pdvState.cliente.telefone||'')&&String(pending.pagamento||'')===String(pdvState.pagamento||'')&&
          String(pending.regime||'')===String(pdvState.regime||'')&&String(pending.observacoes||'')===String(pdvState.observacoes||'');
        if(!sameCart)throw new Error('Existe uma venda pendente de sincronização ('+(pending.numeroFatura||pending.id)+'). Restaure os mesmos dados antes de tentar novamente.');
        pending.status=onlineAtStart?'finalizada':'pendente_sincronizacao';
        if(typeof gerarAssinatura==='function')pending.assinatura=gerarAssinatura(pending);
      }
      const venda=pdvPendingFinalSale;
      try{venda.id=await saveData('vendas',venda);}
      catch(saleError){throw new Error('Não foi possível guardar a venda. '+(saleError.message||'Verifique os dados e tente novamente.'));}
      const offlinePending=venda.status==='pendente_sincronizacao';
      pdvPendingFinalSale=null;
      closeModal();
      if(!offlinePending&&venda.cashSessionId&&window.KanawaCloud&&KanawaCloud.ready){
        try{await KanawaCloud.attachSaleContext(String(venda.id),venda.cashSessionId,venda.clienteEndereco||'');}
        catch(contextError){console.warn('Venda gravada, mas não foi possível associar os dados de caixa:',contextError);}
      }
      if(venda.orcamentoOrigem){
        const quote=await DB.get('orcamentos',venda.orcamentoOrigem);
        if(quote){quote.status='convertida';quote.vendaId=venda.id||null;quote.dataCompra=now();quote.historico=Array.isArray(quote.historico)?quote.historico:[];
          quote.historico.push({evento:'Convertida em venda '+(venda.numeroFatura||'pendente de sincronização'),data:now(),responsavel:user.nome||'Admin'});await saveData('orcamentos',quote);}
      }
      for(const item of venda.itens){
        const product=await DB.get('produtos',item.id);
        if(product){product.estoque=Math.max(0,(product.estoque||0)-item.qty);if(offlinePending)await DB.put('produtos',product);else await saveData('produtos',product,{skipStockSync:true});}
      }
      await saveData('movimentacoesEstoque',{tipo:'saida',saleId:String(venda.id),numeroFatura:venda.numeroFatura||null,
        descricao:offlinePending?'Venda pendente de sincronização':'Venda '+venda.numeroFatura,itens:venda.itens.map(i=>({id:i.id,nome:i.nome,qtd:i.qty})),data:now()});
      if(venda.pagamento==='credito'){
        await saveData('contasReceber',{cliente:venda.clienteNome,valor:c.total,valorPago:0,saldo:c.total,saleId:String(venda.id),numeroFatura:venda.numeroFatura||null,
          tipoDocumento:'FT',descricao:offlinePending?'Venda pendente de sincronização':'Venda '+venda.numeroFatura,vencimento:new Date(Date.now()+30*86400000).toISOString(),
          status:offlinePending?'pendente_sincronizacao':'pendente',recibos:[],data:now()});
      }
      await criarNotificacao(offlinePending?'Venda offline pendente':'Nova Venda',(venda.numeroFatura||'Referência local '+venda.id)+' - '+fmt(c.total),offlinePending?'warning':'success','vendas');
      if(offlinePending){
        toast('Venda guardada neste dispositivo. Será sincronizada quando a internet voltar. Ainda não é factura fiscal.','warning');
        openModal('Venda guardada offline','<p><strong>Venda registada localmente.</strong></p><p>Total: '+fmt(c.total)+' Kz · Cliente: '+esc(venda.clienteNome||'Consumidor Final')+'</p>'+
          '<p class="text-muted">A venda está pendente de sincronização. O número fiscal e a factura serão emitidos pelo servidor quando a ligação ao Supabase for restabelecida. Não registe a mesma venda novamente.</p>'+
          '<p><strong>Referência local:</strong> '+esc(venda.id)+'</p><button class="btn btn-primary btn-block" onclick="closeModal()">Fechar</button>');
      }else{
        toast('Venda '+venda.numeroFatura+' confirmada no servidor: '+fmt(c.total),'success');
        await abrirFatura(venda);abrirGavetaAutomatico();
      }
      pdvCache.ts=0;pdvState.carrinho=[];pdvSelectedItemId=null;pdvState.cliente={nome:'Cliente Anônimo',nif:'',telefone:''};
      pdvState.desconto=0;pdvState.valorRecebido=0;pdvState.orcamentoOrigem=null;
      return;
    }
    const numeroFatura='RASCUNHO-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-6);
    const rascunho=Object.assign(copy(pdvState),{numeroFatura,status:modo,data:now(),total:c.total});
    await saveData('vendas',rascunho);toast('Rascunho guardado','success');
  }catch(error){toast(error.message||'Não foi possível concluir a faturação.','error');}
  finally{pdvFinalizing=false;}
}
function filtrarPDV(termo) {
  const t = (termo || '').toLowerCase().trim(); const grid = $('pdvProductsGrid'); if (!grid) return;
  const filt = pdvCache.produtos.filter(p => (p.nome || '').toLowerCase().indexOf(t) !== -1 || (p.codigoBarras || '').indexOf(t) !== -1 || (p.codigo || '').toLowerCase().indexOf(t) !== -1);
  grid.innerHTML = renderGridProdutos(filt, pdvCache.favoritos);
}
function toggleFavorito(id, el) { const favs = pdvCache.favoritos; const i = favs.indexOf(id); if (i > -1) { favs.splice(i, 1); el.classList.remove('active'); } else { favs.push(id); el.classList.add('active'); } localStorage.setItem('kanawa_favoritos', JSON.stringify(favs)); }

/* ====== SCANNER ====== */
async function abrirScanner(cb) {
  scannerCallback = cb || null; scannerProcessing = false;
  const modal = $('scannerModal'); if (modal) modal.classList.add('active');
  const el = $('scannerReader');
  if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#fff"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem"></i><p style="margin-top:12px">A iniciar leitura de código de barras e QR Code...</p></div>';
  if (scannerActive) return;
  if (typeof Html5Qrcode === 'undefined') {
    if (el) el.innerHTML = '<div style="text-align:center;padding:30px;color:#fff"><p>Scanner indisponível. Digite ou cole o código:</p><input type="text" id="codigoManual" placeholder="Código de barras ou QR Code" style="padding:10px;border-radius:8px;border:none;margin-top:10px;width:80%;max-width:300px" onkeypress="if(event.key===\'Enter\'){processarCodigoLido(this.value);this.value=\'\'}"></div>';
    return;
  }
  try {
    const supported = window.Html5QrcodeSupportedFormats || {};
    const formats = ['QR_CODE','EAN_13','EAN_8','UPC_A','UPC_E','CODE_39','CODE_93','CODE_128','ITF','CODABAR','DATA_MATRIX','PDF_417','AZTEC'].map(name => supported[name]).filter(value => value !== undefined);
    scanner = new Html5Qrcode('scannerReader', { verbose: false, formatsToSupport: formats.length ? formats : undefined });
    await scanner.start({ facingMode: 'environment' }, { fps: 12, qrbox: (w,h)=>{const edge=Math.floor(Math.min(w*.92,h*.72,420));return {width:edge,height:Math.max(120,Math.floor(edge*.55))};} },
      async (txt, decodedResult) => { await processarCodigoLido(txt,decodedResult); }, () => { });
    scannerActive = true; toast('📷 Leitura de código de barras e QR Code activa', 'info');
  } catch (err) {
    if (el) el.innerHTML = '<div style="text-align:center;padding:30px;color:#fff"><i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:#f59e0b"></i><p style="margin-top:12px">Câmera indisponível. Verifique a permissão da câmera ou introduza o código manualmente.</p></div>';
  }
}
async function processarCodigoLido(codigo,decodedResult) {
  const normalized = String(codigo || '').trim();
  if (!normalized || scannerProcessing) return false;
  const nowMs = Date.now();
  if (normalized === scannerLastCode && nowMs - scannerLastAt < 1400) return false;
  scannerProcessing = true; scannerLastCode = normalized; scannerLastAt = nowMs;
  try {
    try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 1200; g.gain.value = 0.1; o.start(); setTimeout(() => { o.stop(); c.close(); }, 100); } catch (e) { }
    if (navigator.vibrate) navigator.vibrate(100);
    const produtos = await carregarCachePDV();
    const prod = produtos.find(p => [p.codigoBarras,p.codigo,p.codigoQr,p.codigoQR,p.qrCode,p.sku,String(p.id)].some(value => String(value || '').trim() === normalized));
    if (prod) {
      toast('Produto encontrado: '+prod.nome+' | Compra: '+fmt(prod.precoCompra!==undefined?prod.precoCompra:prod.purchase_cost)+' | Venda: '+fmt(prod.precoVenda!==undefined?prod.precoVenda:prod.preco),'success');
      if (scannerCallback) { scannerCallback(prod); fecharScanner(); return true; }
      await pdvSelecionarProduto(prod.id); fecharScanner(); return true;
    }
    const formatName = decodedResult && decodedResult.result && decodedResult.result.format && decodedResult.result.format.formatName;
    const isQr = String(formatName || '').toUpperCase().includes('QR');
    if (scannerCallback) {
      const cb=scannerCallback; cb({codigoBarras:isQr?'':normalized,codigoQr:isQr?normalized:'',codigo:normalized,naoEncontrado:true});
      fecharScanner(); toast('Código ainda não cadastrado. Preencha os dados do novo produto.','info');
    } else {
      toast('⚠️ Código não cadastrado: '+normalized,'warning'); fecharScanner(); cadastroRapidoProduto(normalized,isQr?'qr':'barcode');
    }
    return false;
  } finally { scannerProcessing = false; }
}
function fecharScanner() {
  const modal = $('scannerModal'); if (modal) modal.classList.remove('active');
  if (scanner && scannerActive) scanner.stop().then(() => { scannerActive=false; scanner=null; scannerCallback=null; scannerProcessing=false; })
    .catch(() => { scannerActive=false; scanner=null; scannerCallback=null; scannerProcessing=false; });
  else { scannerCallback=null; scannerProcessing=false; }
}
async function buscarPorCodigo(c) { if (c) await processarCodigoLido(c); }

async function cadastroRapidoProduto(codigo,codeType) {
  const isQr=codeType==='qr';
  openModal('⚡ Cadastro Rápido',
    '<div class="form-group"><label>'+(isQr?'Código QR':'Código de Barras')+'</label><input id="rcCodigo" value="' + esc(codigo) + '" readonly style="background:var(--bg-hover)"><input type="hidden" id="rcCodeType" value="'+(isQr?'qr':'barcode')+'"></div>' +
    '<div class="form-group"><label>Nome *</label><input id="rcNome" autofocus></div>' +
    '<div class="form-group"><label>Preço de Compra (Kz) — se conhecido</label><input id="rcPrecoCompra" type="number" min="0" step="0.01" placeholder="Deixe vazio se ainda não souber"></div>' +
    '<div class="form-group"><label>Preço de Venda (Kz) *</label><input id="rcPrecoVenda" type="number" min="0" step="0.01"></div>' +
    '<div class="form-group"><label>Estoque Inicial</label><input id="rcEstoque" type="number" min="0" value="0"></div>' +
    '<div class="form-group"><label>Categoria</label><input id="rcCategoria" value="Geral"></div>' +
    '<button class="btn btn-success btn-block" onclick="salvarCadastroRapido()"><i class="fas fa-save"></i> Cadastrar e Adicionar</button>');
}
async function salvarCadastroRapido() {
  const nome = $('rcNome').value.trim();
  const precoCompra = $('rcPrecoCompra').value.trim() === '' ? null : num($('rcPrecoCompra').value, 0), precoVenda = num($('rcPrecoVenda').value, 0);
  if (!nome || precoVenda <= 0 || (precoCompra !== null && precoCompra < 0)) { toast('Informe nome, preço de venda válido e um custo de compra válido, se conhecido.', 'warning'); return; }
  const actor=kanawaCurrentActor(),priceApproved=['admin','contabilista'].includes(actor.role);
  const scannedCode=$('rcCodigo').value, isQr=$('rcCodeType')&&$('rcCodeType').value==='qr';
  const novo = { codigo: 'P' + Date.now().toString().slice(-6), codigoBarras:isQr?'':scannedCode, codigoQr:isQr?scannedCode:'', nome, preco:precoVenda, precoVenda, precoCompra, precoAprovado:priceApproved, estoque: int($('rcEstoque').value, 0), categoria: $('rcCategoria').value || 'Geral', dataCadastro: now() };
  const id = await saveData('produtos', novo); novo.id = id;pdvCache.ts=0;
  closeModal();
  if(!priceApproved){toast('Produto criado. O preço aguarda autorização do Financeiro antes de poder ser vendido.','warning');openModule('produtos');return;}
  pdvCache.produtos.push(novo);
  toast('✅ ' + nome + ' cadastrado', 'success');pdvSelecionarProduto(id);
}
/* ====== PRODUTOS ====== */
async function renderProdutos() {
  const produtos = await getData('produtos',{force:true,waitForCloud:true,includeMedia:true});
  const rows = produtos.map(p => {
    const custoRaw = p.precoCompra !== undefined ? p.precoCompra : p.purchase_cost;
    const custoConhecido = custoRaw !== null && custoRaw !== undefined && custoRaw !== '';
    const custo = custoConhecido ? Number(custoRaw) : null;
    const venda = Number(p.precoVenda !== undefined ? p.precoVenda : p.preco) || 0;
    const margem = custoConhecido ? venda - custo : null;
    return [
      '<div style="width:44px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="' + imgSrc(p) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div>',
      '<small style="font-family:monospace">' + esc(p.id) + '</small>',
      esc(p.codigo || '-') + '<br><small style="color:var(--text-muted);font-family:monospace">' + esc(p.codigoBarras || '') + '</small>',
      '<strong>' + esc(p.nome) + '</strong>', esc(p.categoria || '-'), custoConhecido ? fmt(custo) : '<span class="text-muted">Não informado</span>', fmt(venda),
      badge(p.precoAprovado===false?'Pendente de aprovação':'Autorizado',p.precoAprovado===false?'warning':'success'),
      margem===null?'<span class="text-muted">Não apurada</span>':'<strong style="color:' + (margem >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + fmt(margem) + '</strong>',
      badge(p.estoque || 0, (p.estoque || 0) > 0 ? 'success' : 'danger'),
      '<button class="btn btn-sm btn-primary" onclick="abrirModalProduto(' + p.id + ')"><i class="fas fa-edit"></i></button> ' +
      '<button class="btn btn-sm btn-info" onclick="imprimirEtiquetaIndividual(' + p.id + ')"><i class="fas fa-tag"></i></button> ' +
      (podeFazer('excluir') ? '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'produtos\',' + p.id + ')"><i class="fas fa-trash"></i></button>' : '')
    ];
  });
  setTimeout(() => renderProductsMarginChart(produtos), 80);
  return header('Produtos', produtos.length + ' produtos', 'var(--primary)',
    '<button class="btn btn-sm" onclick="abrirModalImportar()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-file-import"></i> Importar Excel</button>' +
    '<button class="btn btn-sm" onclick="exportarProdutos()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-file-export"></i> Exportar Excel</button>' +
    '<button class="btn btn-sm" onclick="imprimirEtiquetasLote()" style="background:rgba(255,255,255,.2);color:#fff"><i class="fas fa-tags"></i> Etiquetas</button>' +
    '<button class="btn btn-success" onclick="abrirModalProduto()"><i class="fas fa-plus"></i> Novo</button>', 'fa-boxes') +
    '<div class="card">' + table(['Img', 'ID', 'Código', 'Nome', 'Categoria', 'Compra', 'Venda', 'Preço autorizado', 'Margem unitária', 'Estoque', 'Ações'], rows) + '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-chart-column"></i> Valor e margem do catálogo</h3></div><div class="kanawa-chart-wrap"><canvas id="productsMarginChart"></canvas></div></div>';
}
async function abrirModalProduto(id) {
  const cats = await getData('categorias');
  const p = id ? (await DB.get('produtos', id)) || {} : {};
  const custoRaw = p.precoCompra !== undefined ? p.precoCompra : p.purchase_cost;
  const custo = custoRaw === null || custoRaw === undefined ? '' : custoRaw;
  const venda = p.precoVenda !== undefined ? p.precoVenda : p.preco || 0;
  openModal(id ? 'Editar Produto' : 'Novo Produto',
    '<div class="form-grid">' +
    '<div class="form-group"><label>Código Interno</label><input id="pCodigo" value="' + esc(p.codigo || '') + '"></div>' +
    '<div class="form-group"><label>📷 Código de Barras</label><div style="display:flex;gap:6px"><input id="pCodigoBarras" value="' + esc(p.codigoBarras || '') + '" style="flex:1"><button class="btn btn-sm btn-info" onclick="abrirScanner(function(prod){if(prod.codigoQr){document.getElementById(\'pCodigoQr\').value=prod.codigoQr;}else{document.getElementById(\'pCodigoBarras\').value=prod.codigoBarras||prod.codigo||\'\';}})"><i class="fas fa-camera"></i></button></div></div>' +
    '<div class="form-group"><label>▦ Código QR</label><input id="pCodigoQr" value="' + esc(p.codigoQr || p.codigoQR || p.qrCode || '') + '" placeholder="Conteúdo do QR Code"></div>' +
    '<div class="form-group full"><label>Nome *</label><input id="pNome" value="' + esc(p.nome || '') + '"></div>' +
    '<div class="form-group"><label>Categoria</label><select id="pCategoria"><option value="">Selecione...</option>' + cats.map(c => '<option value="' + esc(c.nome) + '" ' + (p.categoria === c.nome ? 'selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '<option value="Geral" ' + (p.categoria === 'Geral' ? 'selected' : '') + '>Geral</option></select></div>' +
    '<div class="form-group"><label>Preço de Compra (Kz) *</label><input id="pPrecoCompra" type="number" min="0" step="0.01" required value="' + custo + '"></div>' +
    '<div class="form-group"><label>Preço de Venda (Kz) *</label><input id="pPrecoVenda" type="number" min="0" step="0.01" required value="' + venda + '"></div>' +
    '<div class="form-group"><label>Taxa de IVA do produto (%)</label><input id="pTaxaIVA" type="number" min="0" max="100" step="0.01" placeholder="Usar taxa do regime" value="' + (p.taxaIVA!==undefined&&p.taxaIVA!==null?p.taxaIVA:'') + '"></div>' +
    '<div class="form-group"><label><input id="pIsentoIVA" type="checkbox" ' + (p.taxExempt===true||p.isentoIVA===true?'checked':'') + '> Produto legalmente isento de IVA</label></div>' +
    '<div class="form-group full"><label>Fundamento legal da isenção</label><input id="pMotivoIsencaoIVA" maxlength="300" value="' + esc(p.motivoIsencaoIVA||'') + '" placeholder="Artigo, alínea e diploma aplicável"></div>' +
    '<div class="form-group"><label>Estoque / Quantidade</label><input id="pEstoque" type="number" min="0" value="' + (p.estoque || 0) + '"></div>' +
    '<div class="form-group"><label>Estoque Mínimo</label><input id="pEstoqueMin" type="number" min="0" value="' + (p.estoqueMin || 10) + '"></div>' +
    '<div class="form-group"><label>Unidade</label><select id="pUnidade">' + ['UN','KG','G','L','ML','M','CM','M2','M3','CX','PCT','PAR','DZ','TON'].map(u => '<option value="' + u + '" ' + (p.unidade === u ? 'selected' : '') + '>' + u + '</option>').join('') + '</select></div>' +
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
function preencherFormularioProdutoEscaneado(prod){if(!prod)return;const set=(id,value)=>{const el=$(id);if(el&&value!==undefined&&value!==null)el.value=value;};set('pCodigoBarras',prod.codigoBarras||'');if(prod.naoEncontrado){toast('Código lido. Produto ainda não existe: preencha os restantes campos e grave.','info');return;}set('pCodigo',prod.codigo||'');set('pNome',prod.nome||'');set('pCategoria',prod.categoria||'');set('pPrecoCompra',prod.precoCompra!==undefined?prod.precoCompra:prod.purchase_cost);set('pPrecoVenda',prod.precoVenda!==undefined?prod.precoVenda:prod.preco);set('pEstoque',prod.estoque??0);set('pEstoqueMin',prod.estoqueMin??0);set('pUnidade',prod.unidade||'UN');set('pDesc',prod.descricao||'');toast('Produto identificado e campos preenchidos: '+prod.nome,'success');}
function escolherImagemProduto(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Imagem muito grande (máx 3MB)', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = (e) => { const url = e.target.result; const inp = $('pImagem'); if (inp) inp.value = url; const prev = $('pImagemPreview'); const ph = $('pImagemPlaceholder'); if (prev) { prev.src = url; prev.style.display = 'block'; } if (ph) ph.style.display = 'none'; toast('✅ Imagem carregada', 'success'); };
  reader.readAsDataURL(file);
}
function removerImagemProduto() { const inp = $('pImagem'); if (inp) inp.value = ''; const prev = $('pImagemPreview'); const ph = $('pImagemPlaceholder'); if (prev) { prev.src = ''; prev.style.display = 'none'; } if (ph) ph.style.display = 'block'; }
function validarCamposProduto(input) {
  const nome = String(input.nome || '').trim();
  if (!nome) return { field: 'pNome', message: 'Informe o nome do produto.' };

  const precoCompraRaw = String(input.precoCompra == null ? '' : input.precoCompra).trim();
  const precoVendaRaw = String(input.precoVenda == null ? '' : input.precoVenda).trim();
  if (precoCompraRaw === '') return { field: 'pPrecoCompra', message: 'Informe o preço de compra do produto.' };
  if (precoVendaRaw === '') return { field: 'pPrecoVenda', message: 'Informe o preço de venda do produto.' };

  const precoCompra = Number(precoCompraRaw);
  const precoVenda = Number(precoVendaRaw);
  if (!Number.isFinite(precoCompra) || precoCompra < 0) return { field: 'pPrecoCompra', message: 'O preço de compra deve ser um valor válido e não negativo.' };
  if (!Number.isFinite(precoVenda) || precoVenda < 0) return { field: 'pPrecoVenda', message: 'O preço de venda deve ser um valor válido e não negativo.' };

  const estoqueRaw = String(input.estoque == null ? '' : input.estoque).trim();
  const estoqueMinRaw = String(input.estoqueMin == null ? '' : input.estoqueMin).trim();
  const estoque = estoqueRaw === '' ? 0 : Number(estoqueRaw);
  const estoqueMin = estoqueMinRaw === '' ? 10 : Number(estoqueMinRaw);
  if (!Number.isSafeInteger(estoque) || estoque < 0) return { field: 'pEstoque', message: 'A quantidade em stock deve ser um número inteiro igual ou superior a zero.' };
  if (!Number.isSafeInteger(estoqueMin) || estoqueMin < 0) return { field: 'pEstoqueMin', message: 'O stock mínimo deve ser um número inteiro igual ou superior a zero.' };
  return null;
}

async function salvarProduto(id) {
  const nome = $('pNome').value.trim();
  const validacao = validarCamposProduto({
    nome,
    precoCompra: $('pPrecoCompra').value,
    precoVenda: $('pPrecoVenda').value,
    estoque: $('pEstoque').value,
    estoqueMin: $('pEstoqueMin').value
  });
  if (validacao) {
    toast(validacao.message, 'warning');
    const campo = $(validacao.field);
    if (campo) campo.focus();
    return;
  }
  const precoCompra = num($('pPrecoCompra').value, 0);
  const precoVenda = num($('pPrecoVenda').value, 0);
  const actor=kanawaCurrentActor(),current=id?await DB.get('produtos',id):null;
  const oldPrice=Number(current&&(current.precoVenda!==undefined?current.precoVenda:current.preco))||0;
  const financeAuthorized=['admin','contabilista'].includes(actor.role);
  const priceApproved=financeAuthorized?true:(current&&oldPrice===precoVenda?current.precoAprovado!==false:false);
  const taxRaw=$('pTaxaIVA').value.trim(),taxaIVA=taxRaw===''?null:num(taxRaw,0),taxExempt=$('pIsentoIVA').checked,motivoIsencaoIVA=$('pMotivoIsencaoIVA').value.trim();
  if(taxaIVA!==null&&(taxaIVA<0||taxaIVA>100)){toast('A taxa de IVA deve estar entre 0 e 100%.','warning');return;}
  if(taxExempt&&taxaIVA!==0){toast('Um produto marcado como isento deve ter taxa de IVA igual a 0%.','warning');return;}
  if(taxExempt&&!motivoIsencaoIVA){toast('Indique o fundamento legal da isenção de IVA.','warning');return;}
  const data = { codigo: $('pCodigo').value, codigoBarras: $('pCodigoBarras').value.trim(), codigoQr: $('pCodigoQr') ? $('pCodigoQr').value.trim() : '', nome, categoria: $('pCategoria').value, preco: precoVenda, precoVenda, precoCompra, precoAprovado:priceApproved, taxaIVA, taxRate:taxaIVA, taxExempt, isentoIVA:taxExempt, motivoIsencaoIVA, estoque: int($('pEstoque').value, 0), estoqueMin: int($('pEstoqueMin').value, 10), unidade: $('pUnidade').value, imagem: $('pImagem').value, descricao: $('pDesc').value };
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
  const fields = ['codigo','codigoBarras','nome','categoria','precoCompra','precoVenda','taxaIVA','taxExempt','motivoIsencaoIVA','estoque','estoqueMin','unidade','descricao','imagem'];
  const rows = data.map(p => ({codigo:p.codigo||'',codigoBarras:p.codigoBarras||'',nome:p.nome||'',categoria:p.categoria||'',precoCompra:p.precoCompra!==undefined?p.precoCompra:p.purchase_cost,precoVenda:p.precoVenda!==undefined?p.precoVenda:p.preco,estoque:p.estoque??0,estoqueMin:p.estoqueMin??0,unidade:p.unidade||'UN',descricao:p.descricao||'',imagem:p.imagem||''}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows,{header:fields}),'Produtos');XLSX.writeFile(wb,'kanawa_produtos_'+Date.now()+'.xlsx');toast('Excel de produtos exportado','success');
}
function baixarModeloProdutosExcel() {
  if(typeof XLSX==='undefined'){toast('Excel indisponível','warning');return;}
  const fields=['codigo','codigoBarras','nome','categoria','precoCompra','precoVenda','estoque','estoqueMin','unidade','descricao','imagem'];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{codigo:'PRD-0001',codigoBarras:'7891234567890',nome:'Produto de Exemplo',categoria:'Geral',precoCompra:1000,precoVenda:1500,estoque:20,estoqueMin:5,unidade:'UN',descricao:'Descrição opcional',imagem:''}],{header:fields}),'Produtos');XLSX.writeFile(wb,'modelo_importacao_produtos_kanawa.xlsx');
}
function normalizarCabecalhoExcel(value){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[ _-]/g,'');}
function validarLinhasProdutosExcel(rows,existentes){
  const errors=[],prepared=[],skipped=[],seenCodes=new Set(),seenBars=new Set(),seenNames=new Set();
  const existingCodes=new Set(existentes.map(p=>String(p.codigo||'').trim().toLowerCase()).filter(Boolean)),existingBars=new Set(existentes.map(p=>String(p.codigoBarras||'').trim()).filter(Boolean)),existingNames=new Set(existentes.map(p=>String(p.nome||'').trim().toLowerCase()).filter(Boolean));
  const aliases={codigo:'codigo',codigointerno:'codigo',codigodebarras:'codigoBarras',codigobarras:'codigoBarras',nome:'nome',produto:'nome',categoria:'categoria',precocompra:'precoCompra',custo:'precoCompra',precovenda:'precoVenda',preco:'precoVenda',estoque:'estoque',quantidade:'estoque',estoquemin:'estoqueMin',unidade:'unidade',unidadedemedida:'unidade',descricao:'descricao',imagem:'imagem'};
  rows.forEach((raw,index)=>{
    const row={};Object.keys(raw||{}).forEach(k=>{const key=aliases[normalizarCabecalhoExcel(k)];if(key)row[key]=raw[k];});
    const line=index+2,code=String(row.codigo??'').trim(),barcode=String(row.codigoBarras??'').trim(),name=String(row.nome??'').trim(),category=String(row.categoria??'').trim(),purchase=row.precoCompra===''||row.precoCompra==null?NaN:Number(row.precoCompra),sale=row.precoVenda===''||row.precoVenda==null?NaN:Number(row.precoVenda),stock=row.estoque===''||row.estoque==null?NaN:Number(row.estoque),min=row.estoqueMin===''||row.estoqueMin==null?0:Number(row.estoqueMin),unit=String(row.unidade??'').trim().toUpperCase(),issues=[];
    if(!code)issues.push('falta código interno');else if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/.test(code))issues.push('código inválido: use 2 a 40 caracteres alfanuméricos, hífen, ponto, barra ou underscore');if(!name)issues.push('falta nome do produto');if(!category)issues.push('falta categoria');
    if(!Number.isFinite(purchase)||purchase<0)issues.push('preço de compra inválido ou em falta');if(!Number.isFinite(sale)||sale<=0)issues.push('preço de venda inválido ou em falta');if(!Number.isFinite(stock)||stock<0)issues.push('quantidade em stock inválida ou em falta');if(!Number.isFinite(min)||min<0)issues.push('stock mínimo inválido');
    if(!['UN','KG','G','L','ML','M','CM','M2','M3','CX','PCT','PAR','DZ','TON'].includes(unit))issues.push('unidade inválida ou em falta');
    const ck=code.toLowerCase(),nk=name.toLowerCase(),duplicateCode=!!(code&&existingCodes.has(ck)),duplicateBarcode=!!(barcode&&existingBars.has(barcode)),duplicateName=!!(name&&existingNames.has(nk));
    if(code&&seenCodes.has(ck))issues.push('código repetido dentro do Excel');if(barcode&&seenBars.has(barcode))issues.push('código de barras repetido dentro do Excel');if(name&&seenNames.has(nk))issues.push('nome repetido dentro do Excel');
    if(duplicateCode)issues.push('código já pertence a um produto cadastrado');if(duplicateBarcode)issues.push('código de barras já pertence a um produto cadastrado');if(duplicateName)issues.push('nome já pertence a um produto cadastrado');
    if(code)seenCodes.add(ck);if(barcode)seenBars.add(barcode);if(name)seenNames.add(nk);
    if(issues.length){errors.push({line,code:code||'—',name:name||'—',issues});return;}
    prepared.push({codigo:code,codigoBarras:barcode,nome, categoria:category,preco:sale,precoVenda:sale,precoCompra:purchase,estoque:stock,estoqueMin:min,unidade:unit,descricao:String(row.descricao||''),imagem:String(row.imagem||''),dataCadastro:now()});
  });
  return {errors,prepared,skipped};
}
function abrirModalImportar(){
  openModal('Importar produtos do Excel','<p>Preencha o modelo Excel com todos os campos obrigatórios. O sistema valida o ficheiro inteiro antes de gravar qualquer produto.</p><p style="margin:10px 0"><strong>Obrigatórios:</strong> código, nome, categoria, preço de compra, preço de venda, stock e unidade. Código de barras, stock mínimo, descrição e imagem são opcionais.</p><button class="btn btn-info" onclick="baixarModeloProdutosExcel()">Descarregar modelo Excel</button><input type="file" id="importFile" accept=".xlsx,.xls,.csv" style="padding:10px;width:100%;margin-top:10px"><button class="btn btn-primary btn-block" style="margin-top:12px" onclick="validarImportacaoProdutosExcel()">Validar ficheiro</button><div id="importValidationResults" style="margin-top:12px"></div>');
}
async function validarImportacaoProdutosExcel(){
  if(typeof XLSX==='undefined'){toast('Excel indisponível','warning');return;}const file=$('importFile')?.files?.[0];if(!file){toast('Selecione um ficheiro Excel','warning');return;}
  try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]];if(!sheet)throw new Error('O ficheiro não contém uma folha.');const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});if(!rows.length)throw new Error('A folha Excel não contém produtos.');
    const result=validarLinhasProdutosExcel(rows,await getData('produtos'));window.kanawaProductImportPreview=result;const target=$('importValidationResults');
    if(result.errors.length){target.innerHTML='<div class="alert alert-danger"><strong>Importação bloqueada — '+result.errors.length+' linha(s) com problemas.</strong><p>Nenhum produto foi gravado. Corrija o Excel e valide novamente.</p><div style="max-height:260px;overflow:auto">'+result.errors.map(e=>'<div style="padding:8px;border-bottom:1px solid var(--border)"><strong>Linha '+e.line+' — '+esc(e.code)+' / '+esc(e.name)+'</strong><ul>'+e.issues.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul></div>').join('')+'</div></div>';toast('Foram encontrados erros. Nenhum produto foi gravado.','error');return;}
    target.innerHTML='<div class="alert alert-success"><strong>Validação concluída.</strong><p>'+result.prepared.length+' produtos novos prontos para importar. Não há duplicados; qualquer erro bloqueia o lote inteiro. Custo e preço de venda identificados.</p>'+(result.prepared.length?'<button class="btn btn-success btn-block" onclick="confirmarImportacaoProdutosExcel()">Confirmar e gravar produtos novos</button>':'<p>Não há produtos novos para gravar.</p>')+'</div>';toast('Ficheiro validado. Confirme para gravar.','success');
  }catch(error){$('importValidationResults').innerHTML='<div class="alert alert-danger">'+esc(error.message)+'</div>';toast('Erro ao ler Excel: '+error.message,'error');}
}
async function commitImportProdutosAtomico(products){
  if(!DB.db)throw new Error('Base de dados local ainda não está inicializada.');
  const actor=kanawaCurrentActor(),priceApproved=['admin','contabilista'].includes(actor.role);
  const records=products.map(product=>Object.assign({},product,{id:nextGeneratedRecordId(),precoAprovado:priceApproved}));
  await new Promise((resolve,reject)=>{
    const tx=DB.db.transaction(['produtos'],'readwrite'),store=tx.objectStore('produtos');
    records.forEach(record=>store.put(record));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Falha ao gravar o lote de produtos.'));tx.onabort=()=>reject(tx.error||new Error('Importação cancelada; nenhum produto foi gravado.'));
  });
  // Stable IDs make cloud retries idempotent after the atomic local commit.
  for(const record of records){
    if(window.KanawaCloud&&!KanawaCloud.isLocalOnly('produtos')){
      if(KanawaCloud.ready){try{await KanawaCloud.upsertRecord('produtos',record,{});}catch(error){await queueSync('produtos','create',record,{});}}
      else await queueSync('produtos','create',record,{});
    }
  }
  return records.length;
}
async function confirmarImportacaoProdutosExcel(){
  const preview=window.kanawaProductImportPreview;if(!preview||preview.errors.length||!preview.prepared.length){toast('Valide novamente o ficheiro antes de importar.','warning');return;}
  const fresh=validarLinhasProdutosExcel(preview.prepared,await getData('produtos'));if(fresh.errors.length){window.kanawaProductImportPreview=fresh;$('importValidationResults').innerHTML='<div class="alert alert-danger"><strong>Importação bloqueada:</strong> surgiram duplicados desde a validação. Nenhum produto foi gravado. Valide novamente.</div>';return;}
  if(!fresh.prepared.length){toast('Todos os produtos deste ficheiro já existem. Nenhum duplicado foi gravado.','info');closeModal();return;}let saved=0;try{saved=await commitImportProdutosAtomico(fresh.prepared);}catch(error){toast('Falha na transação. Nenhum produto foi confirmado localmente: '+error.message,'error');return;}
  window.kanawaProductImportPreview=null;pdvCache.ts=0;toast(saved+' produtos novos importados sem duplicações.','success');closeModal();openModule('produtos');
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
  const cli = await getData('clientes') || [];
  const activos = cli.filter(c => c.estado !== 'inactivo');
  const empresas = cli.filter(c => c.tipo === 'empresa');
  const comNif = cli.filter(c => String(c.nif || '').trim());
  const rows = cli.slice().sort((a,b) => String(a.nome||'').localeCompare(String(b.nome||''), 'pt-AO')).map(c => [
    c.id,
    '<strong>' + esc(c.nome || 'Sem nome') + '</strong><div class="text-muted" style="font-size:.75rem">' + esc(c.tipo === 'empresa' ? 'Empresa' : 'Particular') + ' · ' + esc(c.municipio || c.provincia || 'Localização não indicada') + '</div>',
    esc(c.nif || '-'),
    esc(c.telefone || '-'),
    esc(c.email || '-'),
    badge(c.estado === 'inactivo' ? 'Inactivo' : 'Activo', c.estado === 'inactivo' ? 'secondary' : 'success'),
    '<div class="table-actions"><button class="btn btn-sm btn-light" title="Ver ficha" onclick="verDetalheCliente(' + Number(c.id) + ')"><i class="fas fa-eye"></i></button> ' +
    '<button class="btn btn-sm btn-primary" title="Editar" onclick="abrirModalCliente(' + Number(c.id) + ')"><i class="fas fa-edit"></i></button> ' +
    (podeFazer('excluir') ? '<button class="btn btn-sm btn-danger" title="Excluir" onclick="excluirItem(\'clientes\',' + Number(c.id) + ')"><i class="fas fa-trash"></i></button>' : '') + '</div>'
  ]);
  const actions = (podeFazer('criar') ? '<button class="btn btn-success" onclick="abrirModalCliente()"><i class="fas fa-plus"></i> Novo Cliente</button>' : '') +
    ' <button class="btn btn-light" onclick="exportarClientesCSV()"><i class="fas fa-file-csv"></i> Exportar CSV</button>';
  return header('Clientes', cli.length + ' clientes registados', 'var(--info)', actions, 'fa-users') +
    '<div class="metric-grid">' +
      '<div class="metric-card"><div class="label">Total de clientes</div><div class="value">' + fmtN(cli.length) + '</div></div>' +
      '<div class="metric-card"><div class="label">Activos</div><div class="value">' + fmtN(activos.length) + '</div></div>' +
      '<div class="metric-card"><div class="label">Empresas</div><div class="value">' + fmtN(empresas.length) + '</div></div>' +
      '<div class="metric-card"><div class="label">Com NIF registado</div><div class="value">' + fmtN(comNif.length) + '</div></div>' +
    '</div>' +
    '<div class="card"><div class="form-grid" style="align-items:end">' +
      '<div class="form-group"><label for="clientesPesquisa">Pesquisar clientes</label><input id="clientesPesquisa" type="search" placeholder="Nome, NIF, telefone, email ou município..." oninput="filtrarClientesTabela()"></div>' +
      '<div class="form-group"><label for="clientesEstadoFiltro">Estado</label><select id="clientesEstadoFiltro" onchange="filtrarClientesTabela()"><option value="">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></div>' +
      '<div class="form-group"><label for="clientesTipoFiltro">Tipo</label><select id="clientesTipoFiltro" onchange="filtrarClientesTabela()"><option value="">Todos</option><option value="empresa">Empresas</option><option value="particular">Particulares</option></select></div>' +
    '</div>' +
    (rows.length ? '<div id="clientesTabelaWrap">' + table(['ID','Cliente','NIF','Telefone','Email','Estado','Ações'], rows) + '</div>' : emptyState('fa-users','Ainda não existem clientes. Registe o primeiro cliente para começar a criar oportunidades, propostas e encomendas.','<button class="btn btn-primary" onclick="abrirModalCliente()">Registar primeiro cliente</button>')) +
    '</div>';
}
function filtrarClientesTabela() {
  const q = String(($('clientesPesquisa') || {}).value || '').trim().toLocaleLowerCase('pt-AO');
  const estado = String(($('clientesEstadoFiltro') || {}).value || '');
  const tipo = String(($('clientesTipoFiltro') || {}).value || '');
  const wrap = $('clientesTabelaWrap');
  if (!wrap) return;
  wrap.querySelectorAll('tbody tr').forEach(function(row) {
    const text = String(row.textContent || '').toLocaleLowerCase('pt-AO');
    const rowStatus = row.textContent.includes('Inactivo') ? 'inactivo' : 'activo';
    const rowType = row.textContent.includes('Empresa') ? 'empresa' : 'particular';
    row.style.display = (!q || text.includes(q)) && (!estado || rowStatus === estado) && (!tipo || rowType === tipo) ? '' : 'none';
  });
}
async function abrirModalCliente(id) {
  let c = null;
  if (id != null) c = await DB.get('clientes', id);
  if (id != null && !c) { toast('Não foi possível localizar este cliente.', 'warning'); return; }
  const v = (key, fallback) => esc(c && c[key] != null ? c[key] : (fallback || ''));
  const title = c ? 'Editar ficha do cliente' : 'Registar novo cliente';
  openModal(title,
    '<input type="hidden" id="cliId" value="' + v('id') + '">' +
    '<div class="form-grid">' +
      '<div class="form-group"><label for="cliTipo">Tipo de cliente *</label><select id="cliTipo"><option value="particular" ' + (c && c.tipo === 'empresa' ? '' : 'selected') + '>Particular</option><option value="empresa" ' + (c && c.tipo === 'empresa' ? 'selected' : '') + '>Empresa</option></select></div>' +
      '<div class="form-group"><label for="cliEstado">Estado</label><select id="cliEstado"><option value="activo" ' + (c && c.estado === 'inactivo' ? '' : 'selected') + '>Activo</option><option value="inactivo" ' + (c && c.estado === 'inactivo' ? 'selected' : '') + '>Inactivo</option></select></div>' +
      '<div class="form-group full"><label for="cliNome">Nome / Razão social *</label><input id="cliNome" maxlength="180" value="' + v('nome') + '" required></div>' +
      '<div class="form-group"><label for="cliNif">NIF</label><input id="cliNif" maxlength="30" value="' + v('nif') + '" placeholder="NIF do cliente"></div>' +
      '<div class="form-group"><label for="cliTel">Telefone / WhatsApp</label><input id="cliTel" maxlength="40" value="' + v('telefone') + '" placeholder="+244 9XX XXX XXX"></div>' +
      '<div class="form-group"><label for="cliEmail">Email</label><input id="cliEmail" type="email" maxlength="160" value="' + v('email') + '"></div>' +
      '<div class="form-group"><label for="cliContacto">Pessoa de contacto</label><input id="cliContacto" maxlength="120" value="' + v('pessoaContacto') + '"></div>' +
      '<div class="form-group full"><label for="cliEndereco">Morada</label><input id="cliEndereco" maxlength="240" value="' + v('endereco') + '" placeholder="Rua, avenida, bairro, edifício..."></div>' +
      '<div class="form-group"><label for="cliProvincia">Província</label><input id="cliProvincia" maxlength="80" value="' + v('provincia') + '"></div>' +
      '<div class="form-group"><label for="cliMunicipio">Município</label><input id="cliMunicipio" maxlength="80" value="' + v('municipio') + '"></div>' +
      '<div class="form-group"><label for="cliPagamento">Condição de pagamento</label><select id="cliPagamento">' +
        '<option value="pronto" ' + (c && c.condicaoPagamento === 'pronto' ? 'selected' : '') + '>Pronto pagamento</option>' +
        '<option value="7_dias" ' + (c && c.condicaoPagamento === '7_dias' ? 'selected' : '') + '>7 dias</option>' +
        '<option value="15_dias" ' + (c && c.condicaoPagamento === '15_dias' ? 'selected' : '') + '>15 dias</option>' +
        '<option value="30_dias" ' + (c && c.condicaoPagamento === '30_dias' ? 'selected' : '') + '>30 dias</option>' +
        '<option value="personalizada" ' + (c && c.condicaoPagamento === 'personalizada' ? 'selected' : '') + '>Personalizada / Acordo</option>' +
      '</select></div>' +
      '<div class="form-group"><label for="cliLimiteCredito">Limite de crédito (Kz)</label><input id="cliLimiteCredito" type="number" min="0" step="0.01" value="' + v('limiteCredito', '0') + '"></div>' +
      '<div class="form-group full"><label for="cliObs">Observações internas</label><textarea id="cliObs" rows="3" maxlength="1200">' + v('observacoes') + '</textarea></div>' +
    '</div>' +
    '<div class="form-actions"><button class="btn btn-light" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarClienteModal()"><i class="fas fa-save"></i> Guardar cliente</button></div>');
}
async function salvarClienteModal() {
  const rawId = String(($('cliId') || {}).value || '').trim();
  const id = rawId ? (/^\d+$/.test(rawId) ? Number(rawId) : rawId) : null;
  const nome = String($('cliNome').value || '').trim();
  const nif = String($('cliNif').value || '').trim();
  const email = String($('cliEmail').value || '').trim();
  const telefone = String($('cliTel').value || '').trim();
  const limiteCredito = Number($('cliLimiteCredito').value || 0);
  if (!nome) { toast('Informe o nome ou a razão social do cliente.', 'warning'); $('cliNome').focus(); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Introduza um email válido.', 'warning'); $('cliEmail').focus(); return; }
  if (!Number.isFinite(limiteCredito) || limiteCredito < 0) { toast('O limite de crédito não pode ser negativo.', 'warning'); $('cliLimiteCredito').focus(); return; }
  const clientes = await getData('clientes') || [];
  const nifNormalizado = nif.replace(/[.\s/-]/g, '').toUpperCase();
  if (nifNormalizado && clientes.some(x => String(x.nif || '').replace(/[.\s/-]/g, '').toUpperCase() === nifNormalizado && String(x.id) !== String(id))) {
    toast('Já existe um cliente registado com este NIF. Verifique a ficha antes de guardar.', 'warning'); $('cliNif').focus(); return;
  }
  const existente = id != null ? await DB.get('clientes', id) : null;
  const cliente = Object.assign({}, existente || {}, {
    id: id != null ? id : undefined,
    tipo: $('cliTipo').value,
    estado: $('cliEstado').value,
    nome: nome,
    nif: nif,
    telefone: telefone,
    email: email,
    pessoaContacto: String($('cliContacto').value || '').trim(),
    endereco: String($('cliEndereco').value || '').trim(),
    provincia: String($('cliProvincia').value || '').trim(),
    municipio: String($('cliMunicipio').value || '').trim(),
    condicaoPagamento: $('cliPagamento').value,
    limiteCredito: limiteCredito,
    observacoes: String($('cliObs').value || '').trim(),
    dataCadastro: existente && existente.dataCadastro ? existente.dataCadastro : now(),
    atualizadoEm: now()
  });
  if (id == null) delete cliente.id;
  await saveData('clientes', cliente);
  toast(id == null ? 'Cliente registado com sucesso.' : 'Ficha do cliente actualizada.', 'success');
  closeModal();
  openModule('clientes');
}
async function verDetalheCliente(id) {
  const c = await DB.get('clientes', id);
  if (!c) { toast('Cliente não encontrado.', 'warning'); return; }
  const field = (label, value) => '<div class="form-group"><label>' + label + '</label><div>' + esc(value || '-') + '</div></div>';
  openModal('Ficha do cliente · ' + esc(c.nome || ''), '<div class="form-grid">' +
    field('Tipo', c.tipo === 'empresa' ? 'Empresa' : 'Particular') +
    field('NIF', c.nif) + field('Telefone', c.telefone) + field('Email', c.email) +
    field('Pessoa de contacto', c.pessoaContacto) + field('Morada', c.endereco) +
    field('Província', c.provincia) + field('Município', c.municipio) +
    field('Condição de pagamento', c.condicaoPagamento || 'Pronto pagamento') +
    field('Limite de crédito', fmt(c.limiteCredito || 0)) +
    field('Estado', c.estado === 'inactivo' ? 'Inactivo' : 'Activo') +
    field('Data de registo', fmtD(c.dataCadastro)) +
    '<div class="form-group full"><label>Observações</label><div>' + esc(c.observacoes || '-') + '</div></div></div>' +
    '<div class="form-actions"><button class="btn btn-light" onclick="closeModal()">Fechar</button><button class="btn btn-primary" onclick="abrirModalCliente(' + Number(c.id) + ')"><i class="fas fa-edit"></i> Editar ficha</button></div>');
}
async function exportarClientesCSV() {
  const clientes = await getData('clientes') || [];
  const headers = ['Nome','Tipo','NIF','Telefone','Email','Pessoa de contacto','Morada','Província','Município','Condição de pagamento','Limite de crédito','Estado'];
  const values = clientes.map(c => [c.nome,c.tipo,c.nif,c.telefone,c.email,c.pessoaContacto,c.endereco,c.provincia,c.municipio,c.condicaoPagamento,c.limiteCredito,c.estado]);
  const csv = [headers].concat(values).map(row => row.map(value => '"' + String(value == null ? '' : value).replace(/"/g,'""') + '"').join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='kanawa-clientes.csv'; a.click();
  URL.revokeObjectURL(url);
}
function abrirModalPDVCliente() { openModal('Novo Cliente', '<div class="form-group"><label>Nome *</label><input id="novoCliNome" autofocus></div><div class="form-group"><label>NIF</label><input id="novoCliNif"></div><div class="form-group"><label>Telefone</label><input id="novoCliTel"></div><button class="btn btn-primary btn-block" onclick="salvarNovoClientePDV()">Salvar</button>'); }
async function salvarNovoClientePDV() {
  const n = $('novoCliNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; }
  const c = { nome: n, nif: $('novoCliNif').value, telefone: $('novoCliTel').value, tipo: 'particular', estado: 'activo', condicaoPagamento: 'pronto', dataCadastro: now() };
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
function abrirModalFornecedor() { openModal('Novo Fornecedor', '<div class="form-grid"><div class="form-group full"><label for="fNome">Nome *</label><input id="fNome" maxlength="180" required></div><div class="form-group"><label for="fNif">NIF</label><input id="fNif" maxlength="30"></div><div class="form-group"><label for="fTel">Telefone</label><input id="fTel" maxlength="40" placeholder="+244 9XX XXX XXX"></div><div class="form-group full"><label for="fEmail">Email</label><input id="fEmail" type="email" maxlength="160"></div></div><div class="form-actions"><button type="button" class="btn btn-light" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="salvarFornecedor()">Guardar fornecedor</button></div>'); }
async function salvarFornecedor() {
  const nome = String($('fNome').value || '').trim();
  const nif = String($('fNif').value || '').trim();
  const email = String($('fEmail').value || '').trim();
  if (!nome) { toast('Informe o nome do fornecedor.', 'warning'); $('fNome').focus(); return; }
  if (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { toast('Introduza um email válido.', 'warning'); $('fEmail').focus(); return; }
  const fornecedores = await getData('fornecedores') || [];
  const nifNormalizado = nif.replace(/[.\\s/-]/g, '').toUpperCase();
  if (nifNormalizado && fornecedores.some(x => String(x.nif || '').replace(/[.\\s/-]/g, '').toUpperCase() === nifNormalizado)) {
    toast('Já existe um fornecedor registado com este NIF.', 'warning'); $('fNif').focus(); return;
  }
  await saveData('fornecedores', { nome, nif, telefone: String($('fTel').value || '').trim(), email });
  toast('Fornecedor cadastrado com sucesso.', 'success'); closeModal(); openModule('fornecedores');
}

/* ====== TRANSPORTADORAS ====== */
async function renderTransportadoras() {
  const t = await getData('transportadoras');
  const rows = t.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', esc(x.telefone || '-'), fmt(x.custoBase), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'transportadoras\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Transportadoras', t.length + ' transportadoras', 'var(--info)', '<button class="btn btn-success" onclick="abrirModalTransportadora()"><i class="fas fa-plus"></i> Nova</button>', 'fa-shipping-fast') + '<div class="card">' + table(['#', 'Nome', 'Telefone', 'Custo Base', 'Ações'], rows) + '</div>';
}
function abrirModalTransportadora() { openModal('Nova Transportadora', '<div class="form-grid"><div class="form-group full"><label for="tNome">Nome *</label><input id="tNome" maxlength="180" required></div><div class="form-group"><label for="tTel">Telefone</label><input id="tTel" maxlength="40" placeholder="+244 9XX XXX XXX"></div><div class="form-group"><label for="tCusto">Custo Base (Kz)</label><input id="tCusto" type="number" min="0" step="0.01" value="0" required></div></div><div class="form-actions"><button type="button" class="btn btn-light" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="salvarTransportadora()">Guardar transportadora</button></div>'); }
async function salvarTransportadora() {
  const nome = String($('tNome').value || '').trim();
  const custoRaw = String($('tCusto').value || '').trim();
  const custoBase = custoRaw === '' ? NaN : Number(custoRaw);
  if (!nome) { toast('Informe o nome da transportadora.', 'warning'); $('tNome').focus(); return; }
  if (!Number.isFinite(custoBase) || custoBase < 0) { toast('O custo base deve ser um valor válido e não negativo.', 'warning'); $('tCusto').focus(); return; }
  await saveData('transportadoras', { nome, telefone: String($('tTel').value || '').trim(), custoBase });
  toast('Transportadora cadastrada com sucesso.', 'success'); closeModal(); openModule('transportadoras');
}

/* ====== ESTOQUE ====== */
async function renderEstoque() {
  const p = await getData('produtos'); const m = await getData('movimentacoesEstoque');
  const total = p.reduce((s, x) => s + (x.estoque || 0), 0);
  const baixo = p.filter(x => (x.estoque || 0) < (x.estoqueMin || 10));
  const prodRows = p.map(x => ['<strong>' + esc(x.nome) + '</strong>', '<strong>' + (x.estoque || 0) + '</strong>', x.estoqueMin || 10,
    badge((x.estoque || 0) >= (x.estoqueMin || 10) ? 'OK' : ((x.estoque || 0) > 0 ? 'Baixo' : 'Esgotado'), (x.estoque || 0) >= (x.estoqueMin || 10) ? 'success' : ((x.estoque || 0) > 0 ? 'warning' : 'danger')),
    '<button class="btn btn-sm btn-success" onclick="ajustarEstoque(' + x.id + ',1)"><i class="fas fa-plus"></i></button> <button class="btn btn-sm btn-danger" onclick="ajustarEstoque(' + x.id + ',-1)"><i class="fas fa-minus"></i></button>']);
  const movRows = m.slice(-30).reverse().map(x => [fmtDT(x.data), badge(x.tipo, x.tipo === 'entrada' ? 'success' : (x.tipo === 'saida' ? 'danger' : 'info')), esc(x.descricao)]);
  setTimeout(()=>renderStockModuleChart(p),80);
  return header('Estoque', fmtN(total) + ' unidades em ' + p.length + ' produtos', 'var(--info)',
    '<button class="btn btn-sm btn-success" onclick="abrirMovEstoque(\'entrada\')"><i class="fas fa-arrow-down"></i> Entrada</button>' +
    '<button class="btn btn-sm btn-danger" onclick="abrirMovEstoque(\'saida\')"><i class="fas fa-arrow-up"></i> Saída</button>' +
    '<button class="btn btn-sm btn-warning" onclick="abrirMovEstoque(\'ajuste\')"><i class="fas fa-edit"></i> Ajuste</button>', 'fa-warehouse') +
    '<div class="metric-grid"><div class="metric-card"><div class="label">Total Itens</div><div class="value">' + fmtN(total) + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--success)"><div class="label">OK</div><div class="value">' + (p.length - baixo.length) + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--danger)"><div class="label">Baixo</div><div class="value">' + baixo.length + '</div></div>' +
    '<div class="metric-card" style="border-left-color:var(--info)"><div class="label">Movimentações</div><div class="value">' + m.length + '</div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-chart-bar"></i> Níveis de stock</h3></div><div class="kanawa-chart-wrap"><canvas id="stockModuleChart"></canvas></div></div>' +
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
    if (!ps.length) { toast('Cadastre pelo menos um produto antes de movimentar o stock.', 'warning'); return; }
    openModal(tipo.charAt(0).toUpperCase() + tipo.slice(1) + ' de Estoque',
      '<div class="form-grid"><div class="form-group full"><label for="movProd">Produto *</label><select id="movProd" required>' + ps.map(p => '<option value="' + p.id + '">' + esc(p.nome) + ' (Est: ' + (p.estoque || 0) + ')</option>').join('') + '</select></div>' +
      '<div class="form-group full"><label for="movQtd">Quantidade *</label><input id="movQtd" type="number" value="1" min="' + (tipo === 'ajuste' ? '0' : '1') + '" step="1" required></div>' +
      '<div class="form-group full"><label for="movObs">Motivo / Observação</label><input id="movObs" maxlength="240" placeholder="Indique o motivo da movimentação"></div></div>' +
      '<div class="form-actions"><button type="button" class="btn btn-light" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="salvarMov(\'' + tipo + '\')">Confirmar movimentação</button></div>');
  });
}
async function salvarMov(tipo) {
  if (!['entrada','saida','ajuste'].includes(tipo)) { toast('Tipo de movimento inválido.', 'error'); return; }
  const pid = Number($('movProd').value);
  const qtdRaw = String($('movQtd').value || '').trim();
  const qtd = qtdRaw === '' ? NaN : Number(qtdRaw);
  const obs = String($('movObs').value || '').trim();
  if (!Number.isSafeInteger(pid) || pid <= 0) { toast('Seleccione um produto válido.', 'warning'); $('movProd').focus(); return; }
  if (!Number.isSafeInteger(qtd) || qtd < (tipo === 'ajuste' ? 0 : 1)) {
    toast(tipo === 'ajuste' ? 'A quantidade do ajuste deve ser um inteiro igual ou superior a zero.' : 'A quantidade deve ser um número inteiro superior a zero.', 'warning');
    $('movQtd').focus(); return;
  }
  const p = await DB.get('produtos', pid);
  if (!p) { toast('O produto seleccionado já não existe. Actualize a lista e tente novamente.', 'error'); return; }
  if (tipo === 'entrada') p.estoque = (p.estoque || 0) + qtd;
  else if (tipo === 'saida') { if ((p.estoque || 0) < qtd) { toast('Stock insuficiente. Disponível: ' + (p.estoque || 0), 'error'); $('movQtd').focus(); return; } p.estoque -= qtd; }
  else if (tipo === 'ajuste') p.estoque = qtd;
  await saveData('produtos', p);
  await saveData('movimentacoesEstoque', { tipo, descricao: (obs || tipo) + ': ' + qtd + ' ' + p.nome, produtoId: pid, qtd, data: now() });
  pdvCache.ts = 0; toast('✅ ' + tipo + ' registada', 'success'); closeModal(); openModule('estoque');
}

/* ====== COMPRAS ====== */
async function renderCompras() {
  const c = await getData('compras');
  setTimeout(()=>renderPurchaseModuleChart(c),80);
  const rows = c.slice().reverse().map(x => ['#' + x.id, esc(x.fornecedor || '-'), esc(x.produto || '-'), x.quantidade || 0, '<strong>' + fmt(x.valor) + '</strong>', fmtDT(x.data),
    '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'compras\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('Compras', c.length + ' compras', 'var(--warning)', '<button class="btn btn-success" onclick="abrirModalCompra()"><i class="fas fa-plus"></i> Nova</button>', 'fa-shopping-bag') + '<div class="card"><div class="card-header"><h3 class="card-title">Evolução mensal das compras</h3></div><div class="kanawa-chart-wrap"><canvas id="purchaseModuleChart"></canvas></div></div><div class="card">' + table(['#', 'Fornecedor', 'Produto', 'Qtd', 'Valor', 'Data', 'Ações'], rows) + '</div>';
}
function abrirModalCompra() {
  DB.getAll('fornecedores').then(fs => {
    openModal('Nova Compra',
      '<div class="form-grid"><div class="form-group full"><label for="cForn">Fornecedor</label><select id="cForn"><option value="">Selecione...</option>' + fs.map(f => '<option value="' + esc(f.nome) + '">' + esc(f.nome) + '</option>').join('') + '</select></div>' +
      '<div class="form-group full"><label for="cProd">Produto *</label><input id="cProd" maxlength="180" required></div>' +
      '<div class="form-group"><label for="cQtd">Quantidade *</label><input id="cQtd" type="number" value="1" min="1" step="1" required></div>' +
      '<div class="form-group"><label for="cValor">Valor total (Kz) *</label><input id="cValor" type="number" value="0" min="0" step="0.01" required></div></div>' +
      '<div class="form-actions"><button type="button" class="btn btn-light" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="salvarCompra()">Guardar compra</button></div>');
  });
}
async function salvarCompra() {
  const f = $('cForn').value; const p = String($('cProd').value || '').trim();
  const qRaw = String($('cQtd').value || '').trim(), vRaw = String($('cValor').value || '').trim();
  const q = qRaw === '' ? NaN : Number(qRaw), v = vRaw === '' ? NaN : Number(vRaw);
  if (!p) { toast('Informe o produto da compra.', 'warning'); $('cProd').focus(); return; }
  if (!Number.isSafeInteger(q) || q <= 0) { toast('A quantidade deve ser um número inteiro superior a zero.', 'warning'); $('cQtd').focus(); return; }
  if (!Number.isFinite(v) || v < 0) { toast('O valor total deve ser válido e não negativo.', 'warning'); $('cValor').focus(); return; }
  await saveData('compras', { fornecedor: f, produto: p, quantidade: q, valor: v, data: now(), status: 'pendente' });
  const prods = await getData('produtos'); const match = prods.find(x => String(x.nome || '').toLowerCase() === p.toLowerCase());
  if (match) { match.estoque = (match.estoque || 0) + q; await saveData('produtos', match); pdvCache.ts = 0; }
  toast('Compra registrada', 'success'); closeModal(); openModule('compras');
}

/* ====== CRM ====== */
async function renderCRM() {
  const l = await getData('leads');
  const rows = l.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', esc(x.telefone || '-'), esc(x.origem || '-'), badge(x.status || 'novo', 'info'), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'leads\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return header('CRM', l.length + ' leads', 'var(--purple)', '<button class="btn btn-success" onclick="abrirModalLead()"><i class="fas fa-plus"></i> Novo Lead</button>', 'fa-handshake') + '<div class="card">' + table(['#', 'Nome', 'Telefone', 'Origem', 'Status', 'Ações'], rows) + '</div>';
}
function abrirModalLead() {
  openModal('Novo Lead', '<div class="form-grid"><div class="form-group"><label>Nome *</label><input id="lNome" required></div><div class="form-group"><label>Empresa</label><input id="lEmpresa"></div><div class="form-group"><label>Telefone</label><input id="lTel"></div><div class="form-group"><label>Email</label><input id="lEmail" type="email"></div><div class="form-group"><label>Cargo</label><select id="lCargo"><option value="">Não informado</option><option>CEO</option><option>Director</option><option>Gerente</option><option>Estagiário</option><option>Outro</option></select></div><div class="form-group"><label>Dimensão da empresa</label><select id="lTamanho"><option value="">Não informado</option><option>Pequena</option><option>Média</option><option>Grande</option></select></div><div class="form-group"><label>Setor de actividade</label><select id="lSetor"><option value="">Não informado</option><option>Tecnologia</option><option>Comércio</option><option>Indústria</option><option>Construção</option><option>Serviços</option><option>Outro</option></select></div><div class="form-group"><label>Província</label><input id="lProvincia" placeholder="Ex.: Luanda"></div><div class="form-group"><label>Origem</label><select id="lOrigem"><option>Site</option><option>WhatsApp</option><option>Facebook</option><option>Indicação</option><option>Inserção manual</option></select></div></div><button class="btn btn-primary btn-block" onclick="salvarLead()">Guardar lead</button>');
}
async function salvarLead() {
  const n = $('lNome').value.trim();
  if (!n) { toast('Informe o nome do lead.', 'warning'); return; }
  const email = $('lEmail').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('O endereço de email não é válido.', 'warning'); return; }
  const lead = {
    nome: n, empresa: $('lEmpresa').value.trim(), telefone: $('lTel').value.trim(), email,
    cargo: $('lCargo').value, tamanhoEmpresa: $('lTamanho').value, setor: $('lSetor').value,
    provincia: $('lProvincia').value.trim(), origem: $('lOrigem').value,
    status: 'novo', data: new Date().toISOString()
  };
  const id = await saveData('leads', lead);
  await aplicarRoteamentoLead(id);
  toast('Lead cadastrado. A pontuação inicial foi calculada.', 'success');
  closeModal(); openModule('crm-score');
}

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
  const actions='<button class="btn btn-primary" onclick="exportarSaftContabilidade()"><i class="fas fa-file-code"></i> Exportar SAF-T (AO)</button>'+
    '<button class="btn btn-light" onclick="exportarRelatorioContabilCSV()"><i class="fas fa-file-excel"></i> Exportar relatório CSV/Excel</button>'+
    '<button class="btn btn-light" onclick="imprimirRelatorioContabil()"><i class="fas fa-print"></i> Imprimir / PDF</button>'+
    '<button class="btn btn-light" onclick="abrirContaContabilistica()"><i class="fas fa-plus"></i> Nova conta</button>'+
    '<button class="btn btn-success" onclick="abrirLancamentoContabilistico()"><i class="fas fa-plus-circle"></i> Novo lançamento</button>'+
    '<button class="btn btn-outline" onclick="importarPGCAngola()"><i class="fas fa-file-import"></i> Importar PGC</button>';
  return header('Contabilidade','Área de trabalho do contabilista · Angola','var(--primary)',actions,'fa-book')+tabBar+content;
}
function abrirContaContabilistica() {
  openModal('Nova conta contabilística',
    '<div class="form-grid"><div class="form-group"><label>Código *</label><input id="caCodigo" maxlength="20"></div><div class="form-group"><label>Nome *</label><input id="caNome"></div>' +
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
  const [rec,pag]=await Promise.all([getData('contasReceber'),getData('contasPagar')]);
  let approvals=[];
  try{if(window.KanawaCloud&&KanawaCloud.ready)approvals=await KanawaCloud.listCommercialApprovals();}catch(error){console.warn('Autorizações comerciais:',error);}
  const tR=rec.reduce((s,c)=>s+(c.valor||0),0),tP=pag.reduce((s,c)=>s+(c.valor||0),0),actor=kanawaCurrentActor();
  setTimeout(()=>renderFinanceModuleChart(rec,pag),80);
  const recRows=rec.slice().reverse().map(c=>[esc(c.cliente),'<strong>'+fmt(c.valor)+'</strong>',fmtD(c.vencimento),badge(c.status,c.status==='pago'?'success':c.status==='parcial'?'info':'warning'),
    (c.status!=='pago'?'<button class="btn btn-sm btn-success" onclick="marcarPago('+c.id+',\'receber\')"><i class="fas fa-receipt"></i> '+(c.numeroFatura?'Emitir RE':'Pagar')+'</button> ':'')+(c.numeroFatura?'':'<button class="btn btn-sm btn-danger" onclick="excluirItem(\'contasReceber\','+c.id+')"><i class="fas fa-trash"></i></button>')]);
  const pagRows=pag.slice().reverse().map(c=>[esc(c.fornecedor),'<strong>'+fmt(c.valor)+'</strong>',fmtD(c.vencimento),badge(c.status,c.status==='pago'?'success':'warning'),
    (c.status!=='pago'?'<button class="btn btn-sm btn-success" onclick="marcarPago('+c.id+',\'pagar\')"><i class="fas fa-check"></i></button> ':'')+'<button class="btn btn-sm btn-danger" onclick="excluirItem(\'contasPagar\','+c.id+')"><i class="fas fa-trash"></i></button>']);
  const canDecide=['admin','contabilista'].includes(actor.role);
  const approvalRows=approvals.map(a=>[badge(a.request_type,'info'),esc(a.description),esc(a.reference_id||'—'),fmt(a.requested_amount),a.approved_amount==null?'—':fmt(a.approved_amount),badge(a.status,a.status==='approved'?'success':a.status==='rejected'?'danger':'warning'),fmtDT(a.created_at),
    canDecide&&a.status==='pending'?'<button class="btn btn-sm btn-success" onclick="decidirAprovacaoComercial(\''+esc(a.id)+'\',true,'+Number(a.requested_amount||0)+')">Aprovar</button> <button class="btn btn-sm btn-danger" onclick="decidirAprovacaoComercial(\''+esc(a.id)+'\',false)">Rejeitar</button>':'—']);
  return header('Financeiro','Contas, metas e autorizações comerciais','var(--success)','<button class="btn btn-light" onclick="imprimirTelaAtual()"><i class="fas fa-print"></i> Imprimir</button>','fa-coins')+
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-chart-pie"></i> Fluxo financeiro</h3></div><div class="kanawa-chart-wrap"><canvas id="financeModuleChart"></canvas></div></div>'+
    '<div class="metric-grid"><div class="metric-card" style="border-left-color:var(--success)"><div class="label">📥 A Receber</div><div class="value" style="color:var(--success)">'+fmt(tR)+'</div><div class="sub">'+rec.length+' contas</div></div><div class="metric-card" style="border-left-color:var(--danger)"><div class="label">📤 A Pagar</div><div class="value" style="color:var(--danger)">'+fmt(tP)+'</div><div class="sub">'+pag.length+' contas</div></div><div class="metric-card"><div class="label">📊 Saldo</div><div class="value">'+fmt(tR-tP)+'</div></div></div>'+
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-hand-holding-heart"></i> A Receber</h3><button class="btn btn-sm btn-success" onclick="abrirModalConta(\'receber\')"><i class="fas fa-plus"></i> Nova</button></div>'+table(['Cliente','Valor','Vencimento','Status','Ações'],recRows)+'</div>'+
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-file-invoice-dollar"></i> A Pagar</h3><button class="btn btn-sm btn-success" onclick="abrirModalConta(\'pagar\')"><i class="fas fa-plus"></i> Nova</button></div>'+table(['Fornecedor','Valor','Vencimento','Status','Ações'],pagRows)+'</div>'+
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-stamp"></i> Autorizações de preços, descontos e orçamentos</h3><button class="btn btn-sm btn-primary" onclick="abrirModalAprovacaoComercial()">Nova autorização</button></div><p class="text-muted">O Financeiro, gerente ou administrador analisa e aprova valores. A aprovação de preço de produto actualiza o preço autorizado no catálogo.</p>'+
    (approvalRows.length?table(['Tipo','Descrição','Referência','Solicitado','Aprovado','Estado','Data','Decisão'],approvalRows):emptyState('fa-clipboard-check','Ainda não existem pedidos de autorização.'))+'</div>';
}
function abrirModalAprovacaoComercial(){
  openModal('Solicitar autorização comercial','<div class="form-group"><label>Tipo</label><select id="approvalType"><option value="price_override">Alteração de preço de produto</option><option value="service_price">Preço de serviço</option><option value="quotation">Orçamento</option><option value="sales_limit">Limite de venda</option><option value="discount">Desconto especial</option></select></div><div class="form-group"><label>ID interno do produto/serviço (coluna ID do catálogo)</label><input id="approvalReference" placeholder="Código interno do registo"></div><div class="form-group"><label>Descrição e motivo *</label><textarea id="approvalDescription" rows="3"></textarea></div><div class="form-group"><label>Valor solicitado (Kz)</label><input id="approvalAmount" type="number" min="0" value="0"></div><button class="btn btn-primary btn-block" onclick="salvarAprovacaoComercial()">Enviar para aprovação</button>');
}
async function salvarAprovacaoComercial(){
  const description=$('approvalDescription').value.trim(),amount=num($('approvalAmount').value,-1);
  if(description.length<4||amount<0){toast('Informe uma descrição e um valor válido.','warning');return;}
  try{await KanawaCloud.createCommercialApproval({requestType:$('approvalType').value,referenceId:$('approvalReference').value.trim(),description,requestedAmount:amount});toast('Pedido enviado ao Financeiro.','success');closeModal();openModule('financeiro');}
  catch(error){toast(error.message||'Não foi possível enviar o pedido.','error');}
}
async function decidirAprovacaoComercial(id,approve,requestedAmount){
  const amount=approve?num(window.prompt('Valor final autorizado (Kz; desconto em %):',String(requestedAmount||0)),-1):null;
  if(approve&&amount<0){toast('Valor autorizado inválido.','warning');return;}
  try{await KanawaCloud.decideCommercialApproval(id,approve,amount);pdvCache.ts=0;toast(approve?'Valor autorizado e catálogo actualizado.':'Pedido rejeitado.','success');openModule('financeiro');}
  catch(error){toast(error.message||'Não foi possível decidir a autorização.','error');}
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
  const c = await DB.get(s, id); if (!c) return;
  if (tipo === 'receber' && c.numeroFatura && c.saleId) { abrirModalReciboConta(id); return; }
  c.status = 'pago'; c.dataPagamento = now(); await saveData(s, c);
  toast('Marcado pago', 'success'); openModule('financeiro');
}
async function abrirModalReciboConta(id) {
  const c=await DB.get('contasReceber',id);if(!c||!c.saleId||!c.numeroFatura)return;
  const saldo=Math.max(0,Number(c.saldo!==undefined?c.saldo:Number(c.valor||0)-Number(c.valorPago||0)));
  openModal('Emitir Recibo (RE) — '+esc(c.numeroFatura),
    '<p class="text-muted">O recebimento será registado no servidor, ligado à FT original e numerado como RE. A factura original não será alterada.</p>'+
    '<div class="form-group"><label>Valor recebido (Kz) *</label><input id="reAmount" type="number" min="0.01" max="'+saldo+'" step="0.01" value="'+saldo+'"></div>'+
    '<div class="form-group"><label>Meio de pagamento *</label><select id="reMethod"><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="multicaixa">Multicaixa</option><option value="cartao">Cartão</option><option value="deposito">Depósito</option></select></div>'+
    '<div class="form-group"><label>Referência / comprovativo</label><input id="reReference" maxlength="120" placeholder="Referência da operação (opcional)"></div>'+
    '<p><strong>Saldo em dívida:</strong> '+fmt(saldo)+'</p>'+
    '<button class="btn btn-success btn-block" onclick="confirmarReciboConta('+id+')">Confirmar recebimento e emitir RE</button>');
}
async function confirmarReciboConta(id) {
  const c=await DB.get('contasReceber',id);if(!c||!c.saleId)return;
  const amount=Number($('reAmount')&&$('reAmount').value),method=$('reMethod')&&$('reMethod').value;
  const saldo=Math.max(0,Number(c.saldo!==undefined?c.saldo:Number(c.valor||0)-Number(c.valorPago||0)));
  if(!Number.isFinite(amount)||amount<=0||amount>saldo+0.001){toast('O valor deve ser positivo e não pode exceder o saldo em dívida.','warning');return;}
  const reference=$('reReference')&&$('reReference').value.trim();
  try{
    const receiptChanged=c.pendingReceiptAmount!==amount||c.pendingReceiptMethod!==method||c.pendingReceiptReference!==reference;
    const idempotencyKey=(!c.pendingReceiptKey||receiptChanged)?generateUuid():c.pendingReceiptKey;
    if(!c.pendingReceiptKey||receiptChanged){
      c.pendingReceiptKey=idempotencyKey;c.pendingReceiptAmount=amount;c.pendingReceiptMethod=method;c.pendingReceiptReference=reference;
      await saveData('contasReceber',c);
    }
    const result=await KanawaCloud.issueInvoiceReceipt({saleExternalId:c.saleId,amount,paymentMethod:method,providerReference:reference,idempotencyKey});
    c.valorPago=Number(c.valorPago||0)+amount;c.saldo=Number(result.balance_after||Math.max(0,saldo-amount));
    c.status=c.saldo<=0.01?'pago':'parcial';c.dataPagamento=now();
    c.recibos=Array.isArray(c.recibos)?c.recibos:[];
    if(!c.recibos.some(receipt=>receipt.numero===result.document_number))c.recibos.push({numero:result.document_number,valor:amount,data:now(),meio:method,referencia:reference});
    delete c.pendingReceiptKey;delete c.pendingReceiptAmount;delete c.pendingReceiptMethod;delete c.pendingReceiptReference;
    await saveData('contasReceber',c);
    const sale=(await DB.getAll('vendas')).find(v=>String(v.id)===String(c.saleId))||{};
    const receipt=Object.assign({},sale,{id:result.id,numeroFatura:result.document_number,tipoDocumento:'RE',status:'emitido',data:now(),itens:[{nome:'Recebimento da '+c.numeroFatura,qty:1,preco:amount,subtotal:amount,taxRate:0,taxAmount:0,unidade:'UN'}],subtotal:0,baseIncidencia:0,descontoValor:0,iva:0,total:amount,valorRecebido:amount,troco:0,pagamento:method,observacoes:'Recibo referente à '+c.numeroFatura});
    closeModal();toast('Recibo '+result.document_number+' registado. Saldo restante: '+fmt(c.saldo),'success');
    await abrirFatura(receipt);
  }catch(error){toast(error.message||'Não foi possível emitir o recibo.','error');}
}

/* ====== FISCAL ====== */
async function renderFiscal() {
  const salesSummary=await getFiscalSalesSummary(),compras=await getData('compras');
  const tV=moneyCentsToNumber(salesSummary.netTotalCents);
  const tC=moneyCentsToNumber(sumMoneyCents(compras,c=>c.valor!==undefined&&c.valor!==null?c.valor:(c.total||0)));
  const hasSalesVat=salesSummary.hasSalesVat;
  const ivaV=hasSalesVat?moneyCentsToNumber(salesSummary.netTaxCents):null;
  const hasPurchaseVat=compras.some(c=>c.iva!==undefined&&c.iva!==null||c.ivaTotal!==undefined&&c.ivaTotal!==null||c.valorIVA!==undefined&&c.valorIVA!==null);
  const ivaCCents=compras.reduce((sum,c)=>sum+moneyToCents(c.iva!==undefined&&c.iva!==null?c.iva:(c.ivaTotal!==undefined&&c.ivaTotal!==null?c.ivaTotal:(c.valorIVA||0))),0n);
  const ivaC=hasPurchaseVat?moneyCentsToNumber(ivaCCents):null;
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
    'IVA liquidado menos IVA dedutível: '+fmt(moneyCentsToNumber(salesSummary.netTaxCents-ivaCCents));
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
    '<div class="card"><h3><i class="fas fa-percent"></i> IRT — Grupo B/C e retenções</h3>'+
    '<p>Lei n.º 28/20: 6,5% para rendimentos dos Grupos B/C sujeitos a retenção na fonte; 25% para matéria colectável não sujeita a retenção. Na auto-facturação, a lei prevê retenção de 2% para Grupo B e 6,5% para Grupo C.</p>'+
    '<div class="form-grid"><div class="form-group"><label>Matéria colectável (Kz)</label><input type="number" id="irtBCBase" min="0" step="0.01" placeholder="Ex.: 250000"></div>'+
    '<div class="form-group"><label>Enquadramento</label><select id="irtBCMode"><option value="withholding">Grupo B/C — sujeito a retenção (6,5%)</option><option value="non_withholding">Grupo B/C — sem retenção (25%)</option><option value="self_billing_b">Auto-facturação — Grupo B (2%)</option><option value="self_billing_c">Auto-facturação — Grupo C (6,5%)</option></select></div></div>'+
    '<div class="quick-links"><button class="btn btn-primary" onclick="calcularRetencaoIRTB()">Calcular retenção</button><button class="btn btn-light" onclick="guardarRascunhoIRTBC()">Guardar rascunho</button></div><div id="irtBCResult" class="metric-card" style="margin-top:12px">Introduza o valor para simular.</div>'+
    '<p class="text-muted">O cálculo não substitui a classificação do contribuinte nem a validação da matéria colectável. Para contribuintes com contabilidade simplificada podem existir regras de dedução de custos.</p></div>'+
    '<div class="card"><h3><i class="fas fa-shield-alt"></i> Integração AGT — Facturação Electrónica</h3>'+
    '<p><strong>Estado:</strong> '+esc(statusLabel)+'</p><p><strong>Ambiente:</strong> '+esc(agtStatus.environment||'Não definido')+
    ' · <strong>API:</strong> Schema 2.0</p><p class="text-muted">Antes de produção, o produtor deve registar-se no Quiosque AGT, registar o software e a versão, entregar as declarações exigidas, registar a chave pública e obter o número de validação. A integração utiliza assinaturas digitais; as chaves privadas ficam protegidas no servidor ou cifradas por empresa.</p>'+
    '<ol class=\"agt-certification-steps\"><li>Registar produtor e representante no Portal do Parceiro.</li><li>Registar Kanawa Soft ERP e a versão a certificar.</li><li>Preparar os anexos PDF: declaração do software, declaração do produtor e, quando aplicável, declaração do representante.</li><li>Registar a chave pública, a versão e todos os tipos de documentos emitidos; alterações posteriores podem exigir nova certificação.</li><li>Obter o número de validação AGT e configurar as chaves do software no servidor.</li><li>Testar em homologação antes de activar produção.</li></ol>'+
    '<a href=\"https://quiosqueagt.minfin.gov.ao/\" target=\"_blank\" rel=\"noopener\">Portal do Parceiro / Quiosque AGT</a> · <a href=\"https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2\" target=\"_blank\" rel=\"noopener\">Documentação técnica da API</a></p>'+
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
  const emp=JSON.parse(localStorage.getItem('kanawa_empresa')||'{}');
  const period=new Date().toISOString().slice(0,7),parts=period.split('-').map(Number);
  const fromDate=period+'-01',toDate=new Date(Date.UTC(parts[0],parts[1],0)).toISOString().slice(0,10);
  const summary=await getFiscalSalesSummary({fromDate,toDate});
  const compras=(await getData('compras')).filter(c=>dateIsInRange(c.data||c.dataCompra||c.date||c.created_at,{fromDate,toDate}));
  const hasSalesVat=summary.hasSalesVat,ivaV=hasSalesVat?moneyCentsToNumber(summary.netTaxCents):null;
  const hasPurchaseVat=compras.some(c=>c.iva!==undefined&&c.iva!==null||c.ivaTotal!==undefined&&c.ivaTotal!==null||c.valorIVA!==undefined&&c.valorIVA!==null);
  const ivaCCents=compras.reduce((sum,c)=>sum+moneyToCents(c.iva!==undefined&&c.iva!==null?c.iva:(c.ivaTotal!==undefined&&c.ivaTotal!==null?c.ivaTotal:(c.valorIVA||0))),0n);
  const ivaC=hasPurchaseVat?moneyCentsToNumber(ivaCCents):null;
  const baseV=moneyCentsToNumber(summary.netBaseCents),saldoCents=summary.netTaxCents-ivaCCents;
  let txt='RASCUNHO DE APURAMENTO IVA — ANGOLA\\nEmpresa: '+(emp.nome||'')+'\\nNIF: '+(emp.nif||'')+'\\nPeríodo: '+period+'\\n\\n';
  txt+='Base tributável líquida: '+fmt(baseV)+'\\nIVA liquidado líquido: '+(ivaV===null?'NÃO APURADO — documentos sem IVA discriminado':fmt(ivaV))+'\\n';
  txt+='Notas de crédito consideradas: '+summary.creditNotesCount+'\\nIVA dedutível: '+(ivaC===null?'NÃO APURADO — falta IVA discriminado nas compras':fmt(ivaC))+'\\n';
  txt+='Saldo preliminar: '+(ivaV===null||ivaC===null?'NÃO CALCULADO':fmt(moneyCentsToNumber(saldoCents)))+'\\n\\n';
  txt+='Cálculo por cêntimos inteiros, sem arredondamento para Kz inteiros. Vendas anuladas sem Nota de Crédito são excluídas; notas de crédito emitidas são deduzidas no período de emissão.\\n';
  txt+='Prévia de conferência, não é formulário oficial nem comprovativo de submissão à AGT. Confirme regime, isenções e dedutibilidade.';
  const blob=new Blob([txt],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='RASCUNHO_IVA_'+period+'.txt';a.click();URL.revokeObjectURL(url);
  toast('Prévia de IVA gerada com vendas anuladas filtradas e Notas de Crédito deduzidas.','success');
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
function renderProjectsViewsNav(){return '';}
async function renderProjetos() {
  const p = await getData('projetos');
  const rows = p.map(x => [x.id, '<strong>' + esc(x.nome) + '</strong>', badge(x.status || 'ativo', 'info'), '<div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden;width:100px;display:inline-block;vertical-align:middle"><div style="background:var(--success);height:100%;width:' + (x.progresso || 0) + '%"></div></div> ' + (x.progresso || 0) + '%', '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'projetos\',' + x.id + ')"><i class="fas fa-trash"></i></button>']);
  return renderProjectsViewsNav('projetos')+header('Projetos', p.length + ' projetos', 'var(--primary)', '<button class="btn btn-success" onclick="abrirModalProjeto()"><i class="fas fa-plus"></i> Novo</button>', 'fa-project-diagram') + '<div class="card">' + table(['#', 'Nome', 'Status', 'Progresso', 'Ações'], rows) + '</div>';
}
function abrirModalProjeto() { openModal('Novo Projeto', '<div class="form-group"><label>Nome *</label><input id="pjNome"></div><div class="form-group"><label>Descrição</label><textarea id="pjDesc" rows="2"></textarea></div><div class="form-group"><label>Progresso (%)</label><input id="pjProg" type="number" value="0" min="0" max="100"></div><button class="btn btn-primary btn-block" onclick="salvarProjeto()">Salvar</button>'); }
async function salvarProjeto() { const n = $('pjNome').value.trim(); if (!n) { toast('Informe nome', 'warning'); return; } await saveData('projetos', { nome: n, descricao: $('pjDesc').value, progresso: int($('pjProg').value, 0), status: 'ativo', dataInicio: now() }); toast('Criado', 'success'); closeModal(); openModule('projetos'); }

/* ====== TAREFAS ====== */
async function renderTarefas() {
  const t=await getData('tarefas'),actor=kanawaCurrentActor();
  const rows=t.slice().sort((a,b)=>String(a.prazo||'').localeCompare(String(b.prazo||''))).map(x=>{
    const canComplete=x.status!=='concluida'&&(x.responsavelId===actor.id||['admin','gerente','operador','contabilista'].includes(actor.role));
    const actions=(canComplete?'<button class="btn btn-sm btn-success" onclick="concluirTarefa('+x.id+')"><i class="fas fa-check"></i> Concluir</button> ':'')+
      (podeFazer('excluir','tarefas')?'<button class="btn btn-sm btn-danger" onclick="excluirItem(\'tarefas\','+x.id+')"><i class="fas fa-trash"></i></button>':'');
    return [x.id,'<strong>'+esc(x.titulo)+'</strong>',esc(x.departamento||'Geral'),esc(x.responsavelNome||'Por atribuir')+' · '+esc(x.responsavelRole||'—'),esc(x.prioridade||'média'),badge(x.status||'pendente',x.status==='concluida'?'success':'warning'),fmtD(x.prazo),esc(x.criadoPorNome||'—'),actions||'—'];
  });
  return renderProjectsViewsNav('tarefas')+header('Tarefas',t.length+' tarefas atribuídas à equipa','var(--purple)','<button class="btn btn-light" onclick="imprimirTelaAtual()"><i class="fas fa-print"></i> Imprimir</button> <button class="btn btn-success" onclick="abrirModalTarefa()"><i class="fas fa-plus"></i> Nova tarefa</button>','fa-tasks')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Total de tarefas</div><div class="value">'+t.length+'</div></div><div class="metric-card"><div class="label">Pendentes</div><div class="value">'+t.filter(x=>x.status!=='concluida').length+'</div></div><div class="metric-card"><div class="label">Concluídas</div><div class="value">'+t.filter(x=>x.status==='concluida').length+'</div></div></div>'+
    '<div class="card"><h3>Responsáveis e actividades por departamento</h3>'+table(['#','Tarefa','Departamento','Responsável','Prioridade','Estado','Prazo','Criada por','Ações'],rows)+'</div>';
}
let kanawaTaskAssignees=[];
async function abrirModalTarefa() {
  const actor=kanawaCurrentActor();
  let members=[];
  try{if(window.KanawaCloud&&KanawaCloud.ready)members=await KanawaCloud.listTeamMembers();}catch(error){console.warn('Equipa de tarefas:',error);}
  kanawaTaskAssignees=[{user_id:actor.id,full_name:actor.name,role:actor.role}].concat(members.filter(m=>m.user_id!==actor.id));
  const roleNames={owner:'Administrador',admin:'Administrador',manager:'Gerente',gerente:'Gerente',operator:'Operador',operador:'Operador',cashier:'Caixa',caixa:'Caixa',accountant:'Contabilista',contabilista:'Contabilista'};
  const options=kanawaTaskAssignees.map(m=>'<option value="'+esc(m.user_id)+'">'+esc(m.full_name||m.name||'Colaborador')+' · '+esc(roleNames[m.role]||m.role||'Colaborador')+'</option>').join('');
  openModal('Nova tarefa e atribuição','<div class="form-group"><label>Título *</label><input id="tkTitulo" maxlength="160"></div>'+
    '<div class="form-grid"><div class="form-group"><label>Departamento</label><select id="tkDept"><option>Operações</option><option>Vendas</option><option>Caixa</option><option>Financeiro</option><option>Contabilidade</option><option>Técnico</option><option>Recursos Humanos</option><option>Logística</option><option>Administração</option></select></div>'+
    '<div class="form-group"><label>Responsável</label><select id="tkAssignee">'+options+'</select></div>'+
    '<div class="form-group"><label>Prioridade</label><select id="tkPrior"><option>baixa</option><option selected>média</option><option>alta</option><option>urgente</option></select></div>'+
    '<div class="form-group"><label>Prazo</label><input id="tkPrazo" type="date" value="'+new Date(Date.now()+7*86400000).toISOString().slice(0,10)+'"></div></div>'+
    '<button class="btn btn-primary btn-block" onclick="salvarTarefa()">Guardar e atribuir tarefa</button>');
}
async function salvarTarefa() {
  const n=$('tkTitulo').value.trim(),actor=kanawaCurrentActor(),assigneeId=$('tkAssignee').value;
  if(!n){toast('Informe o título da tarefa.','warning');return;}
  const assignee=kanawaTaskAssignees.find(m=>m.user_id===assigneeId)||kanawaTaskAssignees[0]||{user_id:actor.id,full_name:actor.name,role:actor.role};
  const roleNames={owner:'Administrador',admin:'Administrador',manager:'Gerente',gerente:'Gerente',operator:'Operador',operador:'Operador',cashier:'Caixa',caixa:'Caixa',accountant:'Contabilista',contabilista:'Contabilista'};
  await saveData('tarefas',{titulo:n,departamento:$('tkDept').value,responsavelId:assignee.user_id,responsavelNome:assignee.full_name||assignee.name||'Colaborador',responsavelRole:roleNames[assignee.role]||assignee.role,criadoPorId:actor.id,criadoPorNome:actor.name,criadoPorRole:actor.roleLabel,prioridade:$('tkPrior').value,prazo:$('tkPrazo').value,status:'pendente',data:now()});
  toast('Tarefa atribuída a '+(assignee.full_name||assignee.name||'colaborador')+'.','success');closeModal();openModule('tarefas');
}
async function concluirTarefa(id) { const t=await DB.get('tarefas',id); if(t){t.status='concluida';t.dataConclusao=now();await saveData('tarefas',t);toast('Tarefa concluída.','success');openModule('tarefas');} }

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
  const allSales=await getOperationalSales(), d=await getData('devolucoes'), actor=kanawaCurrentActor();
  const visibleSales=allSales.filter(x=>!isCancelledSaleRecord(x));
  const v=actor.role==='caixa'?visibleSales.filter(x=>String(x.cashierUserId||x.operatorUserId||'')===String(actor.id||'')||(!x.cashierUserId&&!x.operatorUserId&&String(x.operador||'')===actor.name)):visibleSales;
  const finalized=v.filter(x=>x.status==='finalizada'||x.status==='finalizado');
  const total=finalized.reduce((sum,x)=>sum+Number(x.total||0),0);
  const profitRows=finalized.map(calcularLucroBrutoVenda).filter(x=>x!==null);
  const grossProfit=profitRows.reduce((sum,x)=>sum+x,0),uncosted=finalized.length-profitRows.length;
  const rows=v.slice().reverse().map(x=>{
    const profit=calcularLucroBrutoVenda(x),quantity=(x.itens||[]).reduce((sum,line)=>sum+(Number(line.qty)||0),0);
    const products=(x.itens||[]).map(line=>(line.nome||'Produto')+' × '+(line.qty||0)).join(', ');
    const actions='<button class="btn btn-sm btn-info" onclick="verFatura('+x.id+')"><i class="fas fa-eye"></i></button>'+
      (['caixa','operador','operator'].includes(actor.role)&&(x.status==='finalizada'||x.status==='finalizado')?' <button class="btn btn-sm btn-warning" onclick="solicitarCancelamentoVenda(\''+esc(x.id)+'\',\''+esc(x.numeroFatura||x.id)+'\')">Solicitar cancelamento</button>':'')+
      (['admin','gerente'].includes(actor.role)&&(x.status==='finalizada'||x.status==='finalizado')?' <button class="btn btn-sm btn-danger" onclick="abrirModalNotaCredito(\''+esc(x.id)+'\')" title="Registar devolução e emitir Nota de Crédito"><i class="fas fa-undo-alt"></i> Devolução / NC</button>':'')+
      (['admin','owner'].includes(actor.role)&&(x.status==='finalizada'||x.status==='finalizado')?' <button class="btn btn-sm btn-outline-danger" onclick="cancelarVendaComoAdmin(\''+esc(x.id)+'\')" title="Cancelar a venda e emitir uma Nota de Crédito integral"><i class="fas fa-ban"></i> Cancelar venda</button>':'');
    return ['<strong>'+esc(x.numeroFatura||'#'+x.id)+'</strong>',esc(x.operador||'—'),esc(x.clienteNome||'-'),esc(x.clienteEndereco||'—'),'<small>'+esc(products||'—')+'</small>',quantity,'<strong>'+fmt(x.total)+'</strong>',
      profit===null?'<span class="text-muted">Não apurado</span>':'<strong style="color:'+(profit>=0?'var(--success)':'var(--danger)')+'">'+fmt(profit)+'</strong>',esc(x.pagamento||'-'),badge(x.status==='pendente_sincronizacao'?'Pendente de sincronização':(x.status||'-'),x.status==='pendente_sincronizacao'?'warning':(isCancelledSaleRecord(x)?'danger':'success')),fmtDT(x.data),actions];
  });
  const devRows=d.slice().reverse().map(x=>[esc(x.vendaNumero||'-'),esc(x.notaCredito||'-'),esc(x.cliente||'-'),esc(x.motivo||'-'),fmt(x.total),badge(x.stockAdjustmentStatus==='pending_manual_review'?'Revisão de stock pendente':(x.status||'Registada'),'warning'),fmtDT(x.data)]);
  setTimeout(()=>renderSalesModuleChart(finalized),80);
  return header(actor.role==='caixa'?'As minhas vendas':'Vendas da empresa',v.length+' vendas visíveis | '+d.length+' devoluções','var(--primary)','<button class="btn btn-light" onclick="imprimirTelaAtual()"><i class="fas fa-print"></i> Imprimir resultado</button>','fa-receipt')+
    '<div class="metric-grid"><div class="metric-card"><div class="label">Vendas confirmadas</div><div class="value">'+finalized.length+'</div></div><div class="metric-card"><div class="label">Faturamento</div><div class="value">'+fmt(total)+'</div></div><div class="metric-card"><div class="label">Lucro bruto apurado</div><div class="value" style="color:var(--success)">'+fmt(grossProfit)+'</div><div class="sub">'+uncosted+' vendas sem custo histórico</div></div></div>'+
    '<div class="card"><h3 class="card-title">Evolução de vendas e lucro bruto</h3><div class="kanawa-chart-wrap"><canvas id="salesModuleChart"></canvas></div></div>'+
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-list"></i> Vendas, colaboradores e clientes</h3></div>'+table(['Fatura','Caixa/Vendedor','Cliente','Endereço','Produtos','Qtd.','Total','Lucro','Pagamento','Estado','Data','Ações'],rows)+'</div>'+
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-undo-alt"></i> Devoluções</h3></div>'+table(['Venda','Nota de Crédito','Cliente','Motivo','Total','Stock','Data'],devRows)+'</div>';
}
async function verFatura(id) { const v = await DB.get('vendas', id); if (v) abrirFatura(v); }

async function getSaleCreditBalance(sale) {
  const issued=(await getIssuedCreditNotes()).filter(note=>String(note.vendaId||note.saleId||'')===String(sale.id));
  const creditedTotalCents=issued.reduce((sum,note)=>sum+creditNoteTotalCents(note),0n);
  const creditedTaxCents=issued.reduce((sum,note)=>sum+creditNoteTaxCents(note),0n);
  return {issued,creditedTotalCents,creditedTaxCents,remainingTotalCents:moneyToCents(sale.total||0)-creditedTotalCents,remainingTaxCents:saleTaxCents(sale)-creditedTaxCents};
}
async function emitirNotaCreditoVenda(sale,amountCents,taxCents,reason) {
  const balance=await getSaleCreditBalance(sale);
  if(amountCents<=0n||amountCents>balance.remainingTotalCents||taxCents<0n||taxCents>balance.remainingTaxCents||taxCents>amountCents)throw new Error('O valor ultrapassa o saldo ainda não rectificado da factura.');
  const baseCents=amountCents-taxCents,amount=moneyCentsToNumber(amountCents),tax=moneyCentsToNumber(taxCents),base=moneyCentsToNumber(baseCents);
  const lines=[{description:'Rectificação / devolução referente à '+sale.numeroFatura,product_name:'Rectificação da factura',quantity:1,unit_price:base,taxable_base:base,tax_rate:base?tax/base*100:0,tax_amount:tax,line_total:amount,reason}];
  const allReturns=await DB.getAll('devolucoes');
  let draft=allReturns.find(entry=>String(entry.vendaId)===String(sale.id)&&entry.status==='pending_issue'&&moneyToCents(entry.total)===amountCents&&moneyToCents(entry.taxAmount||0)===taxCents&&entry.motivo===reason);
  if(!draft){draft={id:generateUuid(),vendaId:sale.id,vendaNumero:sale.numeroFatura,cliente:sale.clienteNome,motivo:reason,total:amount,taxAmount:tax,taxableBase:base,status:'pending_issue',idempotencyKey:generateUuid(),data:now()};await saveData('devolucoes',draft);}
  const result=await KanawaCloud.issueCreditNote({saleExternalId:String(sale.id),amount,taxableBase:base,taxAmount:tax,reason,lines,idempotencyKey:draft.idempotencyKey});
  Object.assign(draft,{notaCredito:result.document_number,status:'credit_note_issued',stockAdjustmentStatus:'pending_manual_review',data:now()});
  await saveData('devolucoes',draft);
  const fullyCredited=balance.creditedTotalCents+amountCents>=moneyToCents(sale.total||0);
  if(fullyCredited){sale.status='cancelada';sale.cancellationReason=reason;sale.cancelledAt=now();await DB.put('vendas',sale);}
  const note=Object.assign({},sale,{numeroFatura:result.document_number,tipoDocumento:'NC',status:'emitida',data:now(),subtotal:base,baseIncidencia:base,descontoValor:0,iva:tax,total:amount,
    itens:[{nome:'Rectificação da factura '+sale.numeroFatura,qty:1,preco:base,subtotal:base,taxRate:base?tax/base*100:0,taxAmount:tax,unidade:'UN'}],observacoes:reason});
  return {result,note,fullyCredited};
}
async function cancelarVendaComoAdmin(id) {
  const actor=kanawaCurrentActor();
  if(!['admin','owner'].includes(actor.role)){toast('Apenas o administrador pode cancelar uma venda.','warning');return;}
  const sale=(await getData('vendas')).find(item=>String(item.id)===String(id));
  if(!sale||!isFinalizedSaleRecord(sale)){toast('Venda não encontrada ou já cancelada.','warning');return;}
  const balance=await getSaleCreditBalance(sale);
  if(balance.remainingTotalCents<=0n){toast('Esta factura já foi totalmente rectificada por Notas de Crédito.','warning');return;}
  if(!window.confirm('Cancelar integralmente a venda '+(sale.numeroFatura||id)+'? Será emitida uma Nota de Crédito pelo saldo restante. A factura original ficará no arquivo fiscal; o stock só será reposto após conferência física.'))return;
  const reason=window.prompt('Motivo do cancelamento (mínimo 5 caracteres):','Cancelamento autorizado pelo administrador');
  if(reason===null)return;
  if(reason.trim().length<5){toast('Indique um motivo válido.','warning');return;}
  try{
    const outcome=await emitirNotaCreditoVenda(sale,balance.remainingTotalCents,balance.remainingTaxCents,reason.trim());
    closeModal();toast('Venda cancelada com Nota de Crédito '+outcome.result.document_number+'. O stock físico continua pendente de conferência.','success');
    await abrirFatura(outcome.note);openModule('vendas');
  }catch(error){toast(error.message||'Não foi possível cancelar a venda com Nota de Crédito.','error');}
}
async function abrirModalNotaCredito(id) {
  const sale=(await getData('vendas')).find(v=>String(v.id)===String(id));
  if(!sale||!isFinalizedSaleRecord(sale))return;
  const balance=await getSaleCreditBalance(sale);
  if(balance.remainingTotalCents<=0n){toast('A factura já não tem saldo disponível para rectificação.','warning');return;}
  const amount=moneyCentsToNumber(balance.remainingTotalCents),tax=moneyCentsToNumber(balance.remainingTaxCents);
  openModal('Emitir Nota de Crédito (NC) — '+esc(sale.numeroFatura||'Venda'),
    '<p class="text-muted">A NC será ligada ao documento original, sem editar ou apagar a factura. O valor máximo é o saldo ainda não rectificado. O stock físico fica pendente de conferência.</p>'+
    '<div class="form-group"><label>Valor total da Nota de Crédito (Kz) *</label><input id="ncAmount" type="number" min="0.01" max="'+amount+'" step="0.01" value="'+amount+'"></div>'+
    '<div class="form-group"><label>IVA a rectificar (Kz)</label><input id="ncTax" type="number" min="0" max="'+tax+'" step="0.01" value="'+tax+'"></div>'+
    '<div class="form-group"><label>Motivo / fundamento da rectificação *</label><textarea id="ncReason" rows="3" maxlength="500" placeholder="Explique o motivo da nota de crédito"></textarea></div>'+
    '<p><strong>Documento original:</strong> '+esc(sale.numeroFatura||'—')+' · <strong>Saldo disponível:</strong> '+fmt(amount)+'</p>'+
    '<button class="btn btn-danger btn-block" onclick="confirmarNotaCredito(\''+esc(sale.id)+'\')">Validar e emitir NC</button>');
}
async function confirmarNotaCredito(id) {
  const sale=(await DB.getAll('vendas')).find(v=>String(v.id)===String(id));if(!sale)return;
  const balance=await getSaleCreditBalance(sale);
  const amount=Number($('ncAmount')&&$('ncAmount').value),tax=Number($('ncTax')&&$('ncTax').value),reason=$('ncReason')&&$('ncReason').value.trim();
  if(!Number.isFinite(amount)||!Number.isFinite(tax)||reason.length<5){toast('Verifique o valor, IVA e motivo da Nota de Crédito.','warning');return;}
  try{
    const amountCents=moneyToCents(amount),taxCents=moneyToCents(tax);
    if(amountCents<=0n||amountCents>balance.remainingTotalCents||taxCents<0n||taxCents>balance.remainingTaxCents||taxCents>amountCents){toast('O valor/IVA ultrapassa o saldo ainda não rectificado.','warning');return;}
    const outcome=await emitirNotaCreditoVenda(sale,amountCents,taxCents,reason);
    closeModal();toast('Nota de Crédito '+outcome.result.document_number+' emitida. '+(outcome.fullyCredited?'Venda anulada no sistema. ':'')+'Stock físico pendente de conferência.','success');
    await abrirFatura(outcome.note);openModule('vendas');
  }catch(error){toast(error.message||'Não foi possível emitir a Nota de Crédito.','error');}
}

/* ====== ORÇAMENTOS ====== */
async function renderOrcamentos() {
  const o=await getData('orcamentos')||[];
  const counts={rascunho:o.filter(x=>x.status==='rascunho'||x.status==='pendente').length,enviada:o.filter(x=>x.status==='enviada').length,aceite:o.filter(x=>x.status==='aceite').length,convertida:o.filter(x=>x.status==='convertida').length,perdida:o.filter(x=>x.status==='perdida').length};
  const rows=o.slice().reverse().map(x=>[
    esc(x.numeroProforma||('#'+x.id)),esc(x.empresaCliente||(x.cliente&&x.cliente.nome)||'-'),esc(x.responsavel||'-'),(x.carrinho||[]).length,
    '<strong>'+fmt(x.total)+'</strong>',fmtD(x.dataEnvio||x.data),badge(x.status||'rascunho',x.status==='convertida'?'success':x.status==='perdida'?'danger':x.status==='aceite'?'info':'warning'),
    '<button class="btn btn-sm btn-info" title="Marcar enviada" onclick="atualizarEstadoOrcamento('+x.id+',\'enviada\')"><i class="fas fa-paper-plane"></i></button> '+
    '<button class="btn btn-sm btn-success" title="Aceite pelo cliente" onclick="atualizarEstadoOrcamento('+x.id+',\'aceite\')"><i class="fas fa-check"></i></button> '+
    '<button class="btn btn-sm btn-warning" title="Proposta perdida" onclick="atualizarEstadoOrcamento('+x.id+',\'perdida\')"><i class="fas fa-times"></i></button> '+
    '<button class="btn btn-sm btn-info" title="Imprimir proforma" onclick="imprimirProforma('+x.id+')"><i class="fas fa-print"></i> PP</button> '+
    '<button class="btn btn-sm btn-primary" title="Converter em venda" onclick="converterOrcamento('+x.id+')"><i class="fas fa-arrow-right"></i></button>'
  ]);
  return header('Propostas e Negócios',o.length+' propostas comerciais','var(--info)','<button class="btn btn-light" onclick="openModule(\'pdv\')"><i class="fas fa-plus"></i> Nova pró-forma</button>', 'fa-file-invoice')+
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
async function imprimirProforma(id) {
  const quote=await DB.get('orcamentos',id);if(!quote)return;
  // Older/offline records may contain the products only in "carrinho".
  // Rebuild the printable snapshot from the stored lines instead of printing a zero-value document.
  const sourceLines=Array.isArray(quote.itens)&&quote.itens.length?quote.itens:
    (Array.isArray(quote.carrinho)?quote.carrinho:[]);
  if(!sourceLines.length){
    toast('Esta pró-forma não contém artigos. Abra a proposta, adicione produtos e guarde novamente.','warning');
    return;
  }
  const regime=String(quote.regime||'geral').toLowerCase();
  const defaultRate=regime==='geral'?14:(regime==='simplificado'?7:0);
  let calculated=null;
  if(window.KanawaFiscalDocuments&&typeof KanawaFiscalDocuments.calculateLines==='function'){
    calculated=KanawaFiscalDocuments.calculateLines(sourceLines.map(line=>Object.assign({},line,{
      quantity:line.quantity??line.qty??line.quantidade,
      unitPrice:line.unitPrice??line.preco,
      taxRate:line.taxRate??line.taxaIVA??defaultRate
    })),{
      discountPercent:Number(quote.desconto)||0,
      defaultRate,
      applyTax:quote.aplicarIVA!==false
    });
  }
  const normalizedLines=calculated?calculated.lines:sourceLines.map(line=>{
    const qty=Number(line.qty??line.quantity??line.quantidade)||0;
    const price=Number(line.preco??line.unitPrice)||0;
    const lineSubtotal=Number(line.subtotal)||qty*price;
    const taxAmount=Number(line.taxAmount)||0;
    return Object.assign({},line,{qty,preco:price,subtotal:lineSubtotal,taxAmount});
  });
  const subtotal=calculated?calculated.subtotal:(Number(quote.subtotal)||normalizedLines.reduce((sum,line)=>sum+(Number(line.subtotal)||0),0));
  const discountValue=calculated?calculated.discountValue:(Number(quote.descontoValor)||0);
  const taxableBase=calculated?calculated.taxableBase:(Number(quote.baseIncidencia)||Math.max(0,subtotal-discountValue));
  const taxAmount=calculated?calculated.taxAmount:(Number(quote.iva)||normalizedLines.reduce((sum,line)=>sum+(Number(line.taxAmount)||0),0));
  const total=calculated?calculated.total:(Number(quote.total)||taxableBase+taxAmount);
  if(!normalizedLines.length||total<=0){
    toast('Não foi possível calcular o valor desta pró-forma. Confirme os preços e quantidades dos artigos.','warning');
    return;
  }
  const doc=Object.assign({},quote,{
    itens:normalizedLines.map(line=>Object.assign({},line,{
      nome:line.nome||line.product_name||'Artigo',
      qty:Number(line.qty??line.quantity)||0,
      preco:Number(line.preco??line.unitPrice)||0,
      subtotal:Number(line.taxableBase??line.subtotal??line.lineGross)||0,
      taxAmount:Number(line.taxAmount)||0,
      unidade:line.unidade||line.unitOfMeasure||'UN'
    })),
    subtotal,descontoValor:discountValue,baseIncidencia:taxableBase,iva:taxAmount,total,
    numeroFatura:quote.numeroProforma||('PP-'+quote.id),
    tipoDocumento:'PP',
    status:'Proforma comercial — não fiscal',
    clienteNome:quote.empresaCliente||(quote.cliente&&quote.cliente.nome)||'Consumidor Final',
    clienteNif:(quote.cliente&&quote.cliente.nif)||'999999999',
    clienteEndereco:(quote.cliente&&quote.cliente.endereco)||'',
    pagamento:'Proposta comercial',
    valorRecebido:0,troco:0
  });
  await abrirFatura(doc);
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
async function renderRelatorios(){
 const [sales,products,clients]=await Promise.all([getOperationalSales(),getData('produtos'),getData('clientes')]);
 const today=new Date(),isoToday=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0'),month=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
 setTimeout(()=>aplicarFiltroRelatorio(),100);
 return header('Relatórios','Análise e exportação por período','var(--primary)','<button class="btn btn-success" onclick="exportarBackupCompleto()"><i class="fas fa-database"></i> Backup JSON</button><button class="btn btn-info" onclick="exportarVendasCSV()"><i class="fas fa-file-csv"></i> Vendas CSV</button><button class="btn btn-primary" onclick="exportarProdutos()"><i class="fas fa-file-excel"></i> Produtos Excel</button>','fa-chart-bar')+
 '<div class="card"><h3>Filtrar relatório de vendas</h3><div class="form-grid"><div class="form-group"><label>Período</label><select id="relPeriodo" onchange="alternarCamposPeriodoRelatorio()"><option value="geral">Geral</option><option value="dia">Por dia</option><option value="mes">Por mês</option></select></div><div class="form-group" id="relDiaWrap" style="display:none"><label>Dia</label><input type="date" id="relDia" value="'+isoToday+'"></div><div class="form-group" id="relMesWrap" style="display:none"><label>Mês</label><input type="month" id="relMes" value="'+month+'"></div></div><button class="btn btn-primary" onclick="aplicarFiltroRelatorio()">Aplicar filtro</button><button class="btn btn-secondary" onclick="document.getElementById(\'relPeriodo\').value=\'geral\';aplicarFiltroRelatorio()">Relatório geral</button></div>'+
 '<div id="relatorioResultados"><div class="card"><p>A preparar relatório...</p></div></div>'+
 '<div class="card"><h3>Exportações adicionais</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-success" onclick="exportarBackupCompleto()">Backup JSON</button><button class="btn btn-info" onclick="exportarVendasCSV()">Vendas CSV</button><button class="btn btn-primary" onclick="exportarProdutos()">Produtos Excel</button></div></div>';
}
function alternarCamposPeriodoRelatorio(){const period=$('relPeriodo')?.value;$('relDiaWrap').style.display=period==='dia'?'block':'none';$('relMesWrap').style.display=period==='mes'?'block':'none';}
async function aplicarFiltroRelatorio(){
 const [sales,products,clients]=await Promise.all([getOperationalSales(),getData('produtos'),getData('clientes')]),period=$('relPeriodo')?.value||'geral',day=$('relDia')?.value,month=$('relMes')?.value;
 let filtered=sales.filter(v=>v.status==='finalizada'||v.status==='finalizado');
 if(period==='dia'){if(!day)return toast('Escolha o dia do relatório.','warning');filtered=filtered.filter(v=>String(v.data||v.sold_at||'').slice(0,10)===day);}
 if(period==='mes'){if(!month)return toast('Escolha o mês do relatório.','warning');filtered=filtered.filter(v=>String(v.data||v.sold_at||'').slice(0,7)===month);}
 const total=filtered.reduce((sum,v)=>sum+(Number(v.total)||0),0),average=filtered.length?total/filtered.length:0;
 const rows=filtered.slice().sort((a,b)=>new Date(b.data||b.sold_at||0)-new Date(a.data||a.sold_at||0)).map(v=>[esc(v.numeroFatura||v.id||'-'),esc(v.clienteNome||'Cliente Anónimo'),fmt(v.total||0),esc(v.pagamento||'-'),badge(v.status||'finalizada','success'),fmtDT(v.data||v.sold_at)]);
 const label=period==='dia'?'Dia '+day:period==='mes'?'Mês '+month:'Todo o período';
 $('relatorioResultados').innerHTML='<div class="metric-grid"><div class="metric-card"><div class="label">Vendas ('+esc(label)+')</div><div class="value">'+filtered.length+'</div></div><div class="metric-card"><div class="label">Faturamento</div><div class="value">'+fmt(total)+'</div></div><div class="metric-card"><div class="label">Ticket médio</div><div class="value">'+fmt(average)+'</div></div><div class="metric-card"><div class="label">Produtos no catálogo</div><div class="value">'+products.length+'</div></div><div class="metric-card"><div class="label">Clientes cadastrados</div><div class="value">'+clients.length+'</div></div></div><div class="card"><h3>Vendas — '+esc(label)+'</h3>'+table(['N.º','Cliente','Total','Pagamento','Estado','Data'],rows)+'</div>';
}
const KANAWA_BACKUP_VERSION = 1;
const BACKUP_EXCLUDED_STORES = new Set(['usuarios','sessoes','tentativasLogin','politicasSenha','sms2FA','acessos','logsSeguranca','seguranca','dispositivos']);
function backupCryptoAvailable() {
  return !!(window.crypto && window.crypto.subtle && window.TextEncoder && window.TextDecoder);
}
async function deriveBackupKey(passphrase, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function bytesToBase64(bytes) {
  let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary=atob(value),out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
async function transformBackupBytes(bytes, mode) {
  const Constructor=mode==='compress'?window.CompressionStream:window.DecompressionStream;
  if(!Constructor)throw new Error('Este navegador não suporta compressão segura de backups.');
  const stream=new Blob([bytes]).stream().pipeThrough(new Constructor('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function exportarBackupCompleto() {
  if(!backupCryptoAvailable()){toast('Este navegador não disponibiliza criptografia segura para o backup.','error');return;}
  const passphrase=prompt('Crie uma chave de backup com pelo menos 12 caracteres. Guarde-a: sem ela não será possível restaurar.');
  if(passphrase===null)return;
  if(passphrase.length<12){toast('A chave deve ter pelo menos 12 caracteres.','warning');return;}
  const confirmPass=prompt('Confirme a chave de backup.');
  if(confirmPass!==passphrase){toast('As chaves não coincidem. Backup cancelado.','warning');return;}
  try{
    const stores={};
    for(const store of DB.stores){
      if(BACKUP_EXCLUDED_STORES.has(store))continue;
      stores[store]=await DB.getAll(store);
    }
    const snapshot={format:'KANAWASOFT-ENCRYPTED-BACKUP',version:KANAWA_BACKUP_VERSION,system:'KanawaSoft ERP 1.0 Enterprise',company_id:KanawaCloud&&KanawaCloud.context&&KanawaCloud.context.company?KanawaCloud.context.company.id:null,exported_at:new Date().toISOString(),stores};
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await deriveBackupKey(passphrase,salt);
    const plain=new TextEncoder().encode(JSON.stringify(snapshot));
    const compressed=await transformBackupBytes(plain,'compress');
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,compressed);
    const envelope={format:snapshot.format,version:KANAWA_BACKUP_VERSION,kdf:'PBKDF2-SHA256',iterations:310000,compression:'gzip',cipher:'AES-256-GCM',salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(encrypted))};
    const blob=new Blob([JSON.stringify(envelope)],{type:'application/vnd.kanawasoft.backup+json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='KANAWASOFT_BACKUP_'+new Date().toISOString().slice(0,10)+'.kns';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Backup encriptado exportado. Guarde a chave separadamente.','success');
  }catch(error){console.error('Backup:',error);toast('Não foi possível criar o backup encriptado.','error');}
}
async function importarBackupCompleto(file) {
  if(!file||!backupCryptoAvailable())return;
  if(file.size>100*1024*1024){toast('O ficheiro excede o limite de 100 MB.','warning');return;}
  const passphrase=prompt('Introduza a chave usada na criação deste backup.');
  if(passphrase===null)return;
  try{
    const envelope=JSON.parse(await file.text());
    if(envelope.format!=='KANAWASOFT-ENCRYPTED-BACKUP'||envelope.version!==KANAWA_BACKUP_VERSION||envelope.kdf!=='PBKDF2-SHA256'||envelope.compression!=='gzip'||envelope.cipher!=='AES-256-GCM')throw new Error('Formato de backup não reconhecido.');
    const key=await deriveBackupKey(passphrase,base64ToBytes(envelope.salt));
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(envelope.iv)},key,base64ToBytes(envelope.ciphertext));
    const decompressed=await transformBackupBytes(new Uint8Array(plain),'decompress');
    const snapshot=JSON.parse(new TextDecoder().decode(decompressed));
    if(snapshot.system!=='KanawaSoft ERP 1.0 Enterprise'||!snapshot.stores||typeof snapshot.stores!=='object')throw new Error('O conteúdo não pertence a um backup KanawaSoft válido.');
    const allowed=new Set(DB.stores.filter(s=>!BACKUP_EXCLUDED_STORES.has(s)));
    for(const [store,rows] of Object.entries(snapshot.stores)){
      if(!allowed.has(store)||!Array.isArray(rows))throw new Error('Estrutura inválida na coleção '+store+'.');
      if(rows.some(row=>!row||typeof row!=='object'||row.id===undefined||row.id===null))throw new Error('Registos inválidos na coleção '+store+'.');
    }
    const currentCompany=KanawaCloud&&KanawaCloud.context&&KanawaCloud.context.company?KanawaCloud.context.company.id:null;
    if(snapshot.company_id&&currentCompany&&snapshot.company_id!==currentCompany)throw new Error('Este backup pertence a outra empresa. Entre na empresa correcta antes de restaurar.');
    if(!confirm('Backup validado. A restauração vai substituir os dados locais das coleções incluídas. Faça primeiro um backup do estado actual. Continuar?'))return;
    for(const store of DB.stores){
      if(!allowed.has(store)||!Object.prototype.hasOwnProperty.call(snapshot.stores,store))continue;
      await DB.clear(store);
      for(const row of snapshot.stores[store])await DB.put(store,row);
    }
    toast('Backup restaurado no armazenamento local. Execute a sincronização após conferir os dados.','success');
    if(confirm('Recarregar o KanawaSoft agora?'))location.reload();
  }catch(error){console.error('Restauro:',error);toast(error.name==='OperationError'?'Chave incorrecta ou ficheiro danificado.':(error.message||'Falha ao restaurar o backup.'),'error');}
}
function selecionarBackupParaRestauro() {
  const input=document.createElement('input');input.type='file';input.accept='.kns,application/json';
  input.onchange=()=>{if(input.files&&input.files[0])importarBackupCompleto(input.files[0]);};
  input.click();
}
async function exportarVendasCSV() {
  const vendas = await getOperationalSales();
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
      const protectedMember = ['owner','admin'].includes(role) || member.user_id === currentUserId || kanawaCurrentActor().role !== 'admin';
      const active=member.status==='active',pendingApproval=member.status==='pending_approval';
      const options = ['manager','operator','cashier','accountant'].map(value =>
        '<option value="'+value+'" '+(role===value?'selected':'')+'>'+esc(labels[value])+'</option>'
      ).join('');
      const actions = protectedMember ? '<span class="text-muted">Protegido</span>' :
        '<div class="team-actions"><select id="teamRole_'+id+'" class="form-control">'+options+'</select>'+
        '<button class="btn btn-sm btn-primary" onclick="alterarAcessoMembro(\''+id+'\',\''+(active?'active':'suspended')+'\')">Guardar perfil</button>'+
        '<button class="btn btn-sm btn-outline" onclick="abrirPermissoesMembro(\''+id+'\')">Permissões</button>'+
        '<button class="btn btn-sm '+(active?'btn-warning':'btn-success')+'" onclick="alterarAcessoMembro(\''+id+'\',\''+(active?'suspended':'active')+'\')">'+(active?'Suspender':pendingApproval?'Activar conta':'Reactivar')+'</button></div>';
      const statusLabel=active?'Activo':pendingApproval?'A aguardar activação':'Suspenso';
      return ['<strong>'+esc(member.full_name||'Utilizador')+'</strong>',esc(member.email||'—'),badge(labels[role]||role,'primary'),
        badge(statusLabel,active?'success':pendingApproval?'warning':'danger'),actions];
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
function kanawaInviteRoles() {
  const role=kanawaCurrentActor().role;
  if(role==='admin') return [{value:'manager',label:'Gerente'},{value:'accountant',label:'Contabilista'}];
  if(role==='gerente') return [{value:'operator',label:'Operador'}];
  if(role==='operador') return [{value:'cashier',label:'Caixa'}];
  return [];
}
function abrirModalUsuario() {
  if (!TEAM_INVITATIONS_ENABLED) { toast('Convites temporariamente bloqueados por segurança.', 'warning'); return; }
  const roles=kanawaInviteRoles();
  if(!roles.length||!podeAcessar('usuarios')) { toast('O seu perfil não pode criar colaboradores.', 'error'); return; }
  openModal('Convidar colaborador',
    '<div class="form-group"><label>Nome completo *</label><input id="uNome" autocomplete="name"></div>'+
    '<div class="form-group"><label>Email do colaborador *</label><input id="uEmail" type="email" autocomplete="email"></div>'+
    '<div class="form-group"><label>Perfil inicial</label><select id="uPerfil">'+roles.map(r=>'<option value="'+r.value+'">'+r.label+'</option>').join('')+'</select></div>'+
    '<p class="text-muted">Hierarquia: Administrador cria gerente ou contabilista; gerente cria operador; operador cria caixas. O colaborador recebe convite, cria a própria senha e confirma o mesmo Gmail.</p>'+
    '<button class="btn btn-primary btn-block" onclick="salvarUsuario()">Gerar convite</button>');
}
function defaultTeamPermissions() { return {}; }
async function salvarUsuario() {
  if (!TEAM_INVITATIONS_ENABLED) { toast('Convites temporariamente bloqueados por segurança.', 'warning'); return; }
  const allowed=kanawaInviteRoles().map(r=>r.value);
  if (!podeAcessar('usuarios')) { toast('O seu perfil não pode criar utilizadores.', 'error'); return; }
  const name = $('uNome').value.trim();
  const email = $('uEmail').value.trim();
  const role = $('uPerfil').value;
  if (!allowed.includes(role)) { toast('Não pode atribuir este perfil. Respeite a hierarquia da empresa.', 'error'); return; }
  if (!name || !email) { toast('Preencha nome e email', 'warning'); return; }
  try {
    const invitation = await KanawaCloud.createTeamInvitation({ fullName: name, email: email, role: role, permissions: defaultTeamPermissions(role) });
    await registrarAuditoria('team_invited','usuarios',{nome:name,email:email,perfil:role});
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
    await registrarAuditoria('team_access_updated','usuarios',{user_id:userId,role:role,status:String(status||member.status).trim()});
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
  let rows=[];
  if(window.KanawaCloud&&KanawaCloud.ready&&typeof KanawaCloud.listAuditEvents==='function') {
    const events=await KanawaCloud.listAuditEvents(300);
    rows=events.map(x=>[fmtDT(x.created_at),esc(x.actor&&x.actor.full_name||'Utilizador'),esc(x.details&&x.details.role||'—'),badge(x.action,'info'),esc(x.resource_type||'—'),'<small>'+esc(JSON.stringify(x.details||{}).slice(0,240))+'</small>']);
    return header('Auditoria',events.length+' actividades centralizadas','var(--purple)','<button class="btn btn-light" onclick="imprimirTelaAtual()"><i class="fas fa-print"></i> Imprimir</button>','fa-history')+'<div class="card">'+table(['Data','Colaborador','Função','Acção','Módulo','Detalhes'],rows)+'</div>';
  }
  const a=await getData('auditoria');
  rows=a.slice(-300).reverse().map(x=>[fmtDT(x.data),esc(x.usuario||'-'),esc(x.cargo||'—'),badge(x.acao,'info'),esc(x.modulo),'<small>'+esc(JSON.stringify(x.detalhes||{}).slice(0,240))+'</small>']);
  return header('Auditoria',a.length+' registos locais','var(--purple)','','fa-history')+'<div class="card">'+table(['Data','Colaborador','Função','Acção','Módulo','Detalhes'],rows)+'</div>';
}
function kanawaCurrentActor() {
  const context=window.KanawaCloud&&KanawaCloud.context||{};
  const user=context.user||{}, profile=context.profile||{}, local=JSON.parse(localStorage.getItem('kanawa_user')||'{}');
  const raw=String(context.membership&&context.membership.role||context.role||local.role||local.perfil||'operator').toLowerCase();
  const role= context.isPlatformAdmin||['owner','admin'].includes(raw)?'admin':({manager:'gerente',gerente:'gerente',operator:'operador',operador:'operador',cashier:'caixa',caixa:'caixa',accountant:'contabilista',contabilista:'contabilista'})[raw]||'operador';
  const labels={admin:'Administrador',gerente:'Gerente',operador:'Operador',caixa:'Caixa',contabilista:'Contabilista'};
  return {id:user.id||null,email:user.email||local.email||'',name:profile.full_name||local.nome||user.user_metadata&&user.user_metadata.full_name||'Utilizador',role,roleLabel:labels[role]||role};
}
async function registrarAuditoria(acao, modulo, detalhes) {
  const actor=kanawaCurrentActor(), resourceType=modulo==='custosProducao'?'custos-producao':modulo, payload=Object.assign({role:actor.roleLabel},detalhes||{});
  try {
    if(window.KanawaCloud&&KanawaCloud.ready&&typeof KanawaCloud.logAuditEvent==='function') {
      await KanawaCloud.logAuditEvent({action:acao,resourceType:resourceType,details:payload});
    } else {
      await DB.add('auditoria',{acao,modulo:resourceType,detalhes:payload,usuario:actor.name,cargo:actor.roleLabel,data:now()});
    }
  } catch(error) { console.warn('Auditoria:',error); }
}

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
async function ksRenderConfigBase() {
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
    '<button class="btn btn-info" onclick="exportarBackupCompleto()"><i class="fas fa-download"></i> Backup encriptado</button>' +
    '<button class="btn btn-secondary" onclick="selecionarBackupParaRestauro()"><i class="fas fa-upload"></i> Restaurar backup</button>' +
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
async function ksSalvarConfigEmpresaBase() {
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
  if(!confirm('⚠️ Reset Total apaga o cache local deste navegador/dispositivo. Os dados centrais no Supabase NÃO serão apagados. Exporte um backup antes de continuar.'))return;
  if(!confirm('Última confirmação: pretende apagar todos os dados locais e a fila offline deste dispositivo?'))return;
  const dependencyLevels=[
    ['documentosFiscais','faturas','devolucoes','recibos','contasReceber','contasPagar','movimentacoesEstoque','transferencias','lotes','ordensProducao','ordensServico','vendas','compras'],
    ['tarefasProjetos','tarefas','projetos','orcamentos','contratos','timesheets','pontoDigital','folhasPagamento'],
    ['produtos','clientes','fornecedores','funcionarios','usuarios','armazens','categorias','unidades','ivas','irts'],
    ['empresaConfig','config','empresas']
  ];
  const ordered=new Set(dependencyLevels.flat());
  const remaining=DB.stores.filter(store=>!ordered.has(store)).reverse();
  const removalOrder=[...dependencyLevels.flat(),...remaining];
  try{
    for(const store of removalOrder)if(DB.stores.includes(store))await DB.clear(store);
    const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith('kanawa_'))keys.push(key);}
    keys.forEach(key=>localStorage.removeItem(key));
    toast('Cache local limpo por ordem inversa de dependências. A base central não foi apagada.','success');
    location.reload();
  }catch(error){console.error('Reset local:',error);toast('O reset foi interrompido. Não feche esta janela; verifique o armazenamento local.','error');}
}

/* ====== SETUP / AUTH ====== */
function setupNextStep(s) {
  if (setupStep === 1) {
    const n = $('setupNome').value.trim();
    const nif = $('setupNif').value.trim();
    const phone = $('setupTelefone').value.trim();
    const companyEmail = $('setupEmail').value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail);
    if (!n || !nif || !phone || !emailOk) {
      toast('Preencha o nome, NIF, telefone e um email válido da empresa.', 'warning');
      return;
    }
  }
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
      localStorage.removeItem('kanawa_pending_signup_otp');
      await activateCloudSession(KanawaCloud.context, true);
      mostrarAplicacaoAutenticada(KanawaCloud.context);
      toast('Conta criada e empresa ligada à base de dados central.', 'success');
    } else {
      localStorage.setItem('kanawa_pending_email', email);
      if ($('setupWizard')) $('setupWizard').classList.remove('active');
      if ($('authScreen')) $('authScreen').classList.add('active');
      if (window.kanawaStartSignupOtp) {
        await window.kanawaStartSignupOtp(email,true,result.otpType||'signup');
      } else {
        throw new Error('O formulário de confirmação ainda não está pronto. Atualize a página e solicite um novo código.');
      }
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
  const industrialPanel = window.KanawaIndustrialEnterprise ? await window.KanawaIndustrialEnterprise.renderPanel() : '';
  return header('Produção', producao.length + ' itens de produção', 'var(--purple)',
    '<button class="btn btn-success" onclick="abrirModalProducao()"><i class="fas fa-plus"></i> Novo Item</button>', 'fa-industry') +
    '<div class="card">' + table(['Código', 'Nome', 'Tipo', 'Status', 'Ações'],
      producao.map(p => [esc(p.codigo || '-'), '<strong>' + esc(p.nome) + '</strong>', badge(p.tipo || 'acabado', 'info'), badge(p.status === 'ativo' ? 'Ativo' : 'Inativo', p.status === 'ativo' ? 'success' : 'warning'),
      '<button class="btn btn-sm btn-primary" onclick="editarProducao(' + p.id + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'producao\',' + p.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>' + industrialPanel;
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

/* MRP — planeamento de necessidades sem procura fictícia */
function normalizarChaveMRP(valor) {
  return String(valor || '').trim().toLocaleLowerCase('pt-AO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function numeroMRP(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function calcularNecessidadesMRP(dados) {
  const produtos = Array.isArray(dados.produtos) ? dados.produtos : [];
  const boms = Array.isArray(dados.boms) ? dados.boms : [];
  const planos = Array.isArray(dados.planosProducao) ? dados.planosProducao : [];
  const previsoes = Array.isArray(dados.previsoesVendas) ? dados.previsoesVendas : [];
  const encomendas = Array.isArray(dados.encomendasClientes) ? dados.encomendasClientes : [];
  const periodo = Number(dados.periodoDias) > 0 ? Number(dados.periodoDias) : 30;
  const hoje = new Date();
  const limite = new Date(hoje.getTime() + periodo * 86400000);
  const dentroPeriodo = item => {
    const data = item.dataEntrega || item.dataPrevista || item.data || item.periodo;
    if (!data) return true;
    const dt = new Date(String(data).length === 7 ? String(data) + '-01T00:00:00' : data);
    return !Number.isNaN(dt.getTime()) && dt <= limite;
  };
  const demanda = new Map();
  const adicionarDemanda = (item, origem) => {
    const nome = String(item.produto || item.produtoNome || item.nomeProduto || '').trim();
    const qtd = numeroMRP(item.quantidade || item.qtd || item.demanda);
    if (!nome || !qtd || !dentroPeriodo(item)) return;
    const key = normalizarChaveMRP(nome);
    if (!demanda.has(key)) demanda.set(key, { produto:nome, quantidade:0, origens:[] });
    const atual = demanda.get(key);
    atual.quantidade += qtd;
    atual.origens.push(origem);
  };
  planos.filter(x => ['planeado','ativo','pendente','em_execucao'].includes(normalizarChaveMRP(x.status))).forEach(x => adicionarDemanda(x,'Plano Mestre de Produção'));
  previsoes.filter(x => !['concluido','cancelado','rejeitado'].includes(normalizarChaveMRP(x.status))).forEach(x => adicionarDemanda(x,'Previsão de vendas'));
  encomendas.filter(x => normalizarChaveMRP(x.status) === 'aceite' && !x.vendaId && !x.convertidaEmVenda).forEach(encomenda => {
    (Array.isArray(encomenda.carrinho) ? encomenda.carrinho : []).forEach(item => adicionarDemanda({
      produto:item.produto || item.nome || item.productName,
      quantidade:item.quantidade || item.qtd,
      dataEntrega:encomenda.dataEntrega || encomenda.dataPrevista || encomenda.data
    },'Encomenda aceite'));
  });

  const produtoPorNome = new Map();
  produtos.forEach(p => {
    [p.nome,p.codigo,p.codigoBarras,p.id].filter(v => v !== undefined && v !== null && String(v).trim()).forEach(v => produtoPorNome.set(normalizarChaveMRP(v),p));
  });
  const stockPorProduto = p => numeroMRP(p && (p.estoqueDisponivel !== undefined ? p.estoqueDisponivel : p.estoque));
  const linhasProduto = [];
  const necessidadesMaterial = new Map();
  demanda.forEach((d,key) => {
    const produto = produtoPorNome.get(key);
    if (!produto) {
      linhasProduto.push({tipo:'producao',produto:d.produto,demanda:d.quantidade,estoque:0,necessidade:d.quantidade,status:'produto_nao_cadastrado',origens:d.origens});
      return;
    }
    const stock = stockPorProduto(produto);
    const necessidade = Math.max(0,d.quantidade-stock);
    const bom = boms.filter(b => normalizarChaveMRP(b.produto || b.produtoNome || b.produtoId) === key);
    linhasProduto.push({tipo:'producao',produto:produto.nome,produtoId:produto.id,demanda:d.quantidade,estoque:stock,necessidade,status:necessidade>0?(bom.length?'produzir':'sem_bom'):'stock_suficiente',origens:d.origens});
    if (!necessidade || !bom.length) return;
    bom.forEach(item => {
      const materialNome=String(item.material || item.materialNome || '').trim();
      const porUnidade=numeroMRP(item.quantidade);
      if (!materialNome || !porUnidade) return;
      const perda=Math.max(0,Math.min(99,Number(item.perdaPercentual)||0));
      const bruto=necessidade*porUnidade*(1+perda/100);
      const mk=normalizarChaveMRP(materialNome);
      if (!necessidadesMaterial.has(mk)) necessidadesMaterial.set(mk,{tipo:'compra',material:materialNome,demanda:0,leadTimeDias:numeroMRP(item.leadTimeDias),estoqueSeguranca:numeroMRP(item.estoqueSeguranca),origens:[]});
      const m=necessidadesMaterial.get(mk);
      m.demanda+=bruto;
      m.leadTimeDias=Math.max(m.leadTimeDias,numeroMRP(item.leadTimeDias));
      m.estoqueSeguranca=Math.max(m.estoqueSeguranca,numeroMRP(item.estoqueSeguranca));
      m.origens.push(d.produto);
    });
  });
  const linhasMaterial=[];
  necessidadesMaterial.forEach(m=>{
    const produto=produtoPorNome.get(normalizarChaveMRP(m.material));
    const stock=stockPorProduto(produto);
    const necessidade=Math.max(0,m.demanda+m.estoqueSeguranca-stock);
    linhasMaterial.push(Object.assign({},m,{estoque:stock,necessidade,status:necessidade>0?'comprar':'stock_suficiente',dataNecessidade:new Date(hoje.getTime()+Math.max(0,periodo-m.leadTimeDias)*86400000).toISOString().slice(0,10)}));
  });
  return {periodoDias:periodo,calculadoEm:new Date().toISOString(),demanda:linhasProduto,materiais:linhasMaterial,totais:{produtos:linhasProduto.length,materiais:linhasMaterial.length,produzir:linhasProduto.filter(x=>x.necessidade>0&&x.status==='produzir').length,comprar:linhasMaterial.filter(x=>x.necessidade>0).length,semBOM:linhasProduto.filter(x=>x.status==='sem_bom').length,semCadastro:linhasProduto.filter(x=>x.status==='produto_nao_cadastrado').length}};
}
async function renderMRP() {
  const historico=(await getData('mrp')||[]).slice().sort((a,b)=>Date.parse(b.calculadoEm||0)-Date.parse(a.calculadoEm||0));
  const atual=historico[0]||null;
  const [planos,previsoes,boms,produtos,movimentosEstoque,compras,vendas,armazens,lotes,transferencias,funcionarios,turnos,pontoDigital,custosProducao]=await Promise.all([
    getData('planosProducao'),getData('previsoesVendas'),getData('boms'),getData('produtos'),
    getData('movimentacoesEstoque'),getData('compras'),getOperationalSales(),getData('armazens'),
    getData('lotes'),getData('transferencias'),getData('funcionarios'),getData('turnos'),
    getData('pontoDigital'),getData('custosProducao')
  ]);
  const actions='<button class="btn btn-success" onclick="calcularMRP()"><i class="fas fa-calculator"></i> Calcular MRP</button> <button class="btn btn-light" onclick="openModule(\'planos-producao\')">Planos de produção</button> <button class="btn btn-light" onclick="openModule(\'bom\')">Fichas técnicas (BOM)</button>';
  const statusLabel=s=>({produzir:'Produção necessária',comprar:'Compra necessária',stock_suficiente:'Stock suficiente',sem_bom:'Ficha técnica em falta',produto_nao_cadastrado:'Produto não cadastrado'}[s]||s);
  const statusTone=s=>s==='produzir'||s==='comprar'?'warning':s==='sem_bom'||s==='produto_nao_cadastrado'?'danger':'success';
  const productRows=atual&&atual.resultado?atual.resultado.demanda.map(x=>[esc(x.produto),fmtN(x.demanda),fmtN(x.estoque),'<strong>'+fmtN(x.necessidade)+'</strong>',badge(statusLabel(x.status),statusTone(x.status)),esc((x.origens||[]).join(', '))]):[];
  const materialRows=atual&&atual.resultado?atual.resultado.materiais.map(x=>[esc(x.material),fmtN(x.demanda),fmtN(x.estoque),fmtN(x.estoqueSeguranca),'<strong>'+fmtN(x.necessidade)+'</strong>',fmtN(x.leadTimeDias)+' dias',fmtD(x.dataNecessidade),badge(statusLabel(x.status),statusTone(x.status))]):[];
  return header('MRP — Planeamento de necessidades',atual?'Último cálculo: '+fmtDT(atual.calculadoEm):'Sem cálculos efectuados','var(--info)',actions,'fa-cogs')+
    '<div class="metric-grid">'+
      '<div class="metric-card"><div class="label">Planos de produção</div><div class="value">'+planos.length+'</div></div>'+
      '<div class="metric-card"><div class="label">Previsões registadas</div><div class="value">'+previsoes.length+'</div></div>'+
      '<div class="metric-card"><div class="label">Produtos com BOM</div><div class="value">'+new Set(boms.map(x=>normalizarChaveMRP(x.produto))).size+'</div></div>'+
      '<div class="metric-card"><div class="label">Produtos no catálogo</div><div class="value">'+produtos.length+'</div></div>'+
    '</div>'+
    '<div class="card"><div class="card-header"><h3 class="card-title">Executar planeamento</h3></div><div class="form-grid"><div class="form-group"><label for="mrpPeriodoDias">Horizonte de planeamento (dias)</label><input id="mrpPeriodoDias" type="number" min="1" max="365" value="30"></div><div class="form-group"><label>Fontes de procura</label><div class="text-muted">Planos de produção activos/pendentes e previsões de vendas dentro do horizonte.</div></div></div><p class="text-muted">O cálculo não cria compras nem ordens reais automaticamente. Primeiro apresenta sugestões para revisão. Não usa procura aleatória nem altera o stock.</p><button class="btn btn-primary" onclick="calcularMRP()">Calcular necessidades</button></div>'+
    (atual&&atual.resultado?'<div class="metric-grid">'+
      '<div class="metric-card"><div class="label">Necessidades de produção</div><div class="value">'+atual.resultado.totais.produzir+'</div></div>'+
      '<div class="metric-card"><div class="label">Sugestões de compra</div><div class="value">'+atual.resultado.totais.comprar+'</div></div>'+
      '<div class="metric-card"><div class="label">BOM em falta</div><div class="value">'+atual.resultado.totais.semBOM+'</div></div>'+
      '<div class="metric-card"><div class="label">Produto por cadastrar</div><div class="value">'+atual.resultado.totais.semCadastro+'</div></div></div>'+
      '<div class="card"><div class="card-header"><h3 class="card-title">Necessidades de produtos acabados</h3></div>'+(productRows.length?table(['Produto','Procura','Stock','A produzir','Situação','Origem'],productRows):'<p class="text-muted">Não há procura registada no período seleccionado.</p>')+'</div>'+
      '<div class="card"><div class="card-header"><h3 class="card-title">Necessidades de matérias-primas</h3></div>'+(materialRows.length?table(['Material','Necessidade bruta','Stock','Stock segurança','A comprar','Lead time','Data necessária','Situação'],materialRows):'<p class="text-muted">Sem necessidades de materiais calculadas. Verifique as fichas técnicas (BOM).</p>')+'</div>'
      :'<div class="card"><div class="empty-state"><i class="fas fa-calculator"></i><h3>Ainda não existem cálculos MRP</h3><p>Cadastre procura, produtos, fichas técnicas e stocks; depois execute o cálculo.</p></div></div>')+
    '<div class="card"><h3 class="card-title">Verificações antes do cálculo</h3><ul><li>Produtos: '+produtos.length+'</li><li>Fichas técnicas: '+boms.length+'</li><li>Planos de produção: '+planos.length+'</li><li>Previsões de vendas: '+previsoes.length+'</li><li>O stock é lido do cadastro dos produtos; não é movimentado pelo MRP.</li></ul></div>' +
     '<div class="card"><div class="card-header"><h3 class="card-title">Integração com módulos existentes</h3></div><p class="text-muted">Consulta de dados das colecções existentes no IndexedDB e sincronizadas por empresa em ks_records. Apenas leitura: sem novas tabelas, alterações de saldo ou operações automáticas.</p><div class="metric-grid">'+
     '<div class="metric-card"><div class="label">Movimentos de stock</div><div class="value">'+movimentosEstoque.length+'</div><button class="btn btn-sm btn-light" onclick="openModule(\'estoque\')">Abrir stock</button></div>'+
     '<div class="metric-card"><div class="label">Compras</div><div class="value">'+compras.length+'</div><button class="btn btn-sm btn-light" onclick="openModule(\'compras\')">Abrir compras</button></div>'+
     '<div class="metric-card"><div class="label">Vendas</div><div class="value">'+vendas.length+'</div><button class="btn btn-sm btn-light" onclick="openModule(\'vendas\')">Abrir vendas</button></div>'+
     '<div class="metric-card"><div class="label">Armazéns</div><div class="value">'+armazens.length+'</div><button class="btn btn-sm btn-light" onclick="openModule(\'logistica-armazens\')">Abrir armazéns</button></div>'+
     '<div class="metric-card"><div class="label">Lotes</div><div class="value">'+lotes.length+'</div></div><div class="metric-card"><div class="label">Transferências</div><div class="value">'+transferencias.length+'</div></div>'+
     '<div class="metric-card"><div class="label">Colaboradores</div><div class="value">'+funcionarios.length+'</div><button class="btn btn-sm btn-light" onclick="openModule(\'rh\')">Abrir RH</button></div>'+
     '<div class="metric-card"><div class="label">Turnos</div><div class="value">'+turnos.length+'</div></div><div class="metric-card"><div class="label">Registos de ponto</div><div class="value">'+pontoDigital.length+'</div><button class="btn btn-sm btn-light" onclick="openModule(\'rh-ponto\')">Abrir ponto</button></div>'+
     '<div class="metric-card"><div class="label">Custos de produção</div><div class="value">'+custosProducao.length+'</div><button class="btn btn-sm btn-light" onclick="openModule(\'custos-producao\')">Abrir custos</button></div>'+
     '</div></div>';
}
async function calcularMRP() {
  const periodo=num($('mrpPeriodoDias')&&$('mrpPeriodoDias').value,30);
  if(periodo<1||periodo>365){toast('O horizonte deve estar entre 1 e 365 dias.','warning');return;}
  const [produtos,boms,planosProducao,previsoesVendas,encomendasClientes]=await Promise.all([getData('produtos'),getData('boms'),getData('planosProducao'),getData('previsoesVendas'),getData('orcamentos')]);
  const resultado=calcularNecessidadesMRP({produtos,boms,planosProducao,previsoesVendas,encomendasClientes,periodoDias:periodo});
  if(!resultado.totais.produtos&&!resultado.totais.materiais){toast('Não há procura registada. Crie um Plano de Produção ou uma Previsão de Vendas antes de calcular.','warning');return;}
  await saveData('mrp',{calculadoEm:resultado.calculadoEm,periodoDias:periodo,resultado,status:'simulado'});
  toast('Simulação MRP concluída. O stock não foi alterado.','success');
  openModule('mrp');
}

/* BOM — ficha técnica por produto e componente */
async function renderBOM() {
  const boms=await getData('boms')||[];
  const produtos=await getData('produtos')||[];
  const rows=boms.map(b=>['<strong>'+esc(b.produto||'-')+'</strong>',esc(b.material||'-'),fmtN(b.quantidade||0),fmtN(b.perdaPercentual||0)+'%',fmtN(b.estoqueSeguranca||0),fmtN(b.leadTimeDias||0)+' dias',esc(b.unidade||'UN'),
    '<button class="btn btn-sm btn-primary" onclick="editarBOM('+Number(b.id)+')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'boms\','+Number(b.id)+')"><i class="fas fa-trash"></i></button>']);
  return header('Lista de Materiais (BOM)',boms.length+' componentes registados','var(--primary)',
    '<button class="btn btn-success" onclick="abrirModalBOM()"><i class="fas fa-plus"></i> Nova componente</button>','fa-sitemap')+
    '<div class="card"><p class="text-muted">Cada linha representa um componente necessário para fabricar uma unidade do produto acabado. Pode adicionar vários componentes ao mesmo produto.</p>'+
    (rows.length?table(['Produto acabado','Componente/material','Qtd por unidade','Perda %','Stock segurança','Lead time','Unidade','Ações'],rows):'<div class="empty-state"><i class="fas fa-sitemap"></i><h3>Sem fichas técnicas</h3><p>Cadastre os componentes e as quantidades necessárias para fabricar cada produto.</p><button class="btn btn-success" onclick="abrirModalBOM()">Criar primeira BOM</button></div>')+'</div>'+
    '<div class="card"><h3 class="card-title">Produtos disponíveis</h3><p>'+produtos.map(p=>esc(p.nome)).join(' · ')+'</p></div>';
}
async function abrirModalBOM(id) {
  const b=id?await DB.get('boms',id):{};
  const produtos=await getData('produtos');
  const options=produtos.map(p=>'<option value="'+esc(p.nome)+'" '+(b.produto===p.nome?'selected':'')+'>'+esc(p.nome)+'</option>').join('');
  openModal(id?'Editar componente da BOM':'Adicionar componente à BOM',
    '<div class="form-grid">'+
    '<div class="form-group"><label>Produto acabado *</label><input id="bomProduto" list="bomProdutosLista" value="'+esc(b.produto||'')+'" placeholder="Nome do produto a fabricar"><datalist id="bomProdutosLista">'+options+'</datalist></div>'+
    '<div class="form-group"><label>Componente / matéria-prima *</label><input id="bomMaterial" value="'+esc(b.material||'')+'" placeholder="Nome exacto do material no catálogo"></div>'+
    '<div class="form-group"><label>Quantidade por unidade *</label><input id="bomQtd" type="number" min="0.0001" step="0.0001" value="'+(b.quantidade||1)+'"></div>'+
    '<div class="form-group"><label>Unidade</label><input id="bomUnidade" maxlength="12" value="'+esc(b.unidade||'UN')+'"></div>'+
    '<div class="form-group"><label>Perda / desperdício (%)</label><input id="bomPerda" type="number" min="0" max="99" step="0.01" value="'+(b.perdaPercentual||0)+'"></div>'+
    '<div class="form-group"><label>Stock de segurança</label><input id="bomSeguranca" type="number" min="0" step="0.001" value="'+(b.estoqueSeguranca||0)+'"></div>'+
    '<div class="form-group"><label>Lead time (dias)</label><input id="bomLeadTime" type="number" min="0" step="1" value="'+(b.leadTimeDias||0)+'"></div></div>'+
    '<button class="btn btn-primary btn-block" onclick="salvarBOM('+(id||'null')+')"><i class="fas fa-save"></i> Guardar componente</button>',true);
}
async function salvarBOM(id) {
  const produto=$('bomProduto').value.trim(),material=$('bomMaterial').value.trim(),quantidade=Number($('bomQtd').value);
  const perda=Number($('bomPerda').value),seguranca=Number($('bomSeguranca').value),lead=Number($('bomLeadTime').value);
  if(!produto||!material||!Number.isFinite(quantidade)||quantidade<=0){toast('Indique produto, componente e uma quantidade superior a zero.','warning');return;}
  if(![perda,seguranca,lead].every(Number.isFinite)||perda<0||perda>=100||seguranca<0||lead<0){toast('Verifique perda, stock de segurança e lead time.','warning');return;}
  const item={produto,material,quantidade,unidade:$('bomUnidade').value.trim()||'UN',perdaPercentual:perda,estoqueSeguranca:seguranca,leadTimeDias:lead,data:now()};
  if(id!==null&&id!==undefined){item.id=id;await saveData('boms',item);}else await saveData('boms',item);
  toast('Componente da ficha técnica guardado.','success');closeModal();openModule('bom');
}
async function editarBOM(id) { return abrirModalBOM(id); }

/* CUSTOS DE PRODUÇÃO */
function totalizarCustoProducao(c) {
  return Math.max(0, Number(c.material) || 0) + Math.max(0, Number(c.maoObra) || 0) + Math.max(0, Number(c.indireto) || 0);
}
async function renderCustosProducao() {
  const custos = (await getData('custosProducao') || []).slice().sort((a,b) => Date.parse(b.data || b.updatedAt || 0) - Date.parse(a.data || a.updatedAt || 0));
  const total = custos.reduce((s,c) => s + totalizarCustoProducao(c), 0);
  const materiais = custos.reduce((s,c) => s + Math.max(0,Number(c.material)||0), 0);
  const maoObra = custos.reduce((s,c) => s + Math.max(0,Number(c.maoObra)||0), 0);
  const indiretos = custos.reduce((s,c) => s + Math.max(0,Number(c.indireto)||0), 0);
  const unidades = custos.reduce((s,c) => s + Math.max(0,Number(c.quantidade)||0), 0);
  const media = unidades > 0 ? total / unidades : 0;
  const actions = '<button class="btn btn-success" onclick="abrirModalCustoProducao()"><i class="fas fa-plus"></i> Novo Custo</button> ' +
    '<button class="btn btn-light" onclick="imprimirTelaAtual()"><i class="fas fa-print"></i> Imprimir</button> ' +
    '<button class="btn btn-light" onclick="exportarTabelaAtualExcel()"><i class="fas fa-file-excel"></i> Excel</button> ' +
    '<button class="btn btn-light" onclick="exportarTelaAtualPDF()"><i class="fas fa-file-pdf"></i> PDF</button>';
  const rows = custos.map(c => {
    const t = totalizarCustoProducao(c), q = Math.max(0,Number(c.quantidade)||0);
    return [fmtD(c.data), '<strong>' + esc(c.produto || '-') + '</strong>', q ? fmtN(q) + ' ' + esc(c.unidade || 'un.') : '—',
      fmt(c.material || 0), fmt(c.maoObra || 0), fmt(c.indireto || 0), '<strong>' + fmt(t) + '</strong>', q ? fmt(t/q) : '—',
      '<button class="btn btn-sm btn-primary" title="Editar" onclick="editarCustoProducao(' + Number(c.id) + ')"><i class="fas fa-edit"></i></button> ' +
      '<button class="btn btn-sm btn-danger" title="Eliminar" onclick="excluirItem(\'custosProducao\',' + Number(c.id) + ')"><i class="fas fa-trash"></i></button>'];
  });
  return header('Custos de Produção', fmt(total) + ' em custos registados', 'var(--success)', actions, 'fa-calculator') +
    '<div class="metric-grid">' +
      '<div class="metric-card"><div class="label">Materiais</div><div class="value">' + fmt(materiais) + '</div></div>' +
      '<div class="metric-card"><div class="label">Mão de obra</div><div class="value">' + fmt(maoObra) + '</div></div>' +
      '<div class="metric-card"><div class="label">Custos indirectos</div><div class="value">' + fmt(indiretos) + '</div></div>' +
      '<div class="metric-card"><div class="label">Custo médio por unidade</div><div class="value">' + fmt(media) + '</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title">Registos de custos</h3><span class="badge badge-info">' + custos.length + ' registos</span></div>' +
      (custos.length ? table(['Data','Produto','Quantidade','Material','Mão de obra','Indirectos','Custo total','Custo/unidade','Ações'], rows) :
        '<div class="empty-state"><i class="fas fa-calculator"></i><h3>Sem registros</h3><p>Registe os custos de materiais, mão de obra e despesas indirectas para acompanhar o custo real de produção.</p><button class="btn btn-success" onclick="abrirModalCustoProducao()"><i class="fas fa-plus"></i> Registar primeiro custo</button></div>') +
    '</div>';
}
function abrirModalCustoProducao(id) {
  const editing = id !== undefined && id !== null;
  const body = '<div class="form-grid">' +
    '<div class="form-group"><label for="custoProduto">Produto / artigo produzido *</label><input id="custoProduto" maxlength="160" placeholder="Ex.: Caderno A4"></div>' +
    '<div class="form-group"><label for="custoData">Data do custo *</label><input id="custoData" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div>' +
    '<div class="form-group"><label for="custoQuantidade">Quantidade produzida</label><input id="custoQuantidade" type="number" min="0.001" step="0.001" value="1"></div>' +
    '<div class="form-group"><label for="custoUnidade">Unidade</label><select id="custoUnidade"><option value="un.">Unidade</option><option value="kg">Kg</option><option value="L">Litro</option><option value="m">Metro</option><option value="cx">Caixa</option><option value="lote">Lote</option></select></div>' +
    '<div class="form-group"><label for="custoMaterial">Materiais (Kz)</label><input id="custoMaterial" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="form-group"><label for="custoMaoObra">Mão de obra (Kz)</label><input id="custoMaoObra" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="form-group"><label for="custoIndireto">Custos indirectos (Kz)</label><input id="custoIndireto" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="form-group"><label for="custoObservacoes">Observações</label><textarea id="custoObservacoes" rows="2" maxlength="1000" placeholder="Fornecedor, ordem de produção, lote ou notas"></textarea></div>' +
    '</div><div class="card"><strong>Total estimado:</strong> <span id="custoTotalPreview">0,00 Kz</span></div>' +
    '<button class="btn btn-primary btn-block" onclick="salvarCustoProducao(' + (editing ? Number(id) : 'null') + ')"><i class="fas fa-save"></i> ' + (editing ? 'Guardar alterações' : 'Registar custo') + '</button>';
  openModal(editing ? 'Editar Custo de Produção' : 'Novo Custo de Produção', body, true);
  const updatePreview = () => {
    const total = num($('custoMaterial') && $('custoMaterial').value) + num($('custoMaoObra') && $('custoMaoObra').value) + num($('custoIndireto') && $('custoIndireto').value);
    if ($('custoTotalPreview')) $('custoTotalPreview').textContent = fmt(total);
  };
  ['custoMaterial','custoMaoObra','custoIndireto'].forEach(key => { const el=$(key); if(el) el.addEventListener('input',updatePreview); });
  if (editing) editarCustoProducao(id, true);
}
async function preencherModalCustoProducao(c) {
  if (!c) return;
  $('custoProduto').value = c.produto || '';
  $('custoData').value = String(c.data || now()).slice(0,10);
  $('custoQuantidade').value = c.quantidade == null ? 1 : c.quantidade;
  $('custoUnidade').value = c.unidade || 'un.';
  $('custoMaterial').value = Number(c.material) || 0;
  $('custoMaoObra').value = Number(c.maoObra) || 0;
  $('custoIndireto').value = Number(c.indireto) || 0;
  $('custoObservacoes').value = c.observacoes || '';
  if ($('custoTotalPreview')) $('custoTotalPreview').textContent = fmt(totalizarCustoProducao(c));
}
async function salvarCustoProducao(id) {
  const produto = $('custoProduto').value.trim(), quantidade = num($('custoQuantidade').value, 0);
  const material = num($('custoMaterial').value, 0), maoObra = num($('custoMaoObra').value, 0), indireto = num($('custoIndireto').value, 0);
  const data = $('custoData').value;
  if (!produto || !data) { toast('Informe o produto e a data do custo.', 'warning'); return; }
  if (quantidade <= 0 || [material,maoObra,indireto].some(v => !Number.isFinite(v) || v < 0)) { toast('Quantidade deve ser maior que zero e os custos não podem ser negativos.', 'warning'); return; }
  const total = material + maoObra + indireto;
  if (total <= 0) { toast('Informe pelo menos um custo superior a zero.', 'warning'); return; }
  const record = { produto, quantidade, unidade: $('custoUnidade').value || 'un.', material, maoObra, indireto, total,
    custoUnitario: total / quantidade, data: new Date(data + 'T12:00:00').toISOString(), observacoes: $('custoObservacoes').value.trim(), updatedAt: now() };
  if (id !== null && id !== undefined) {
    const existing = await DB.get('custosProducao', id);
    if (!existing) { toast('O registo que pretende editar já não existe.', 'error'); return; }
    Object.assign(existing, record); await saveData('custosProducao', existing);
  } else await saveData('custosProducao', record);
  toast(id !== null && id !== undefined ? 'Custo actualizado com sucesso.' : 'Custo registado com sucesso.', 'success');
  closeModal(); openModule('custos-producao');
}
async function editarCustoProducao(id, modalJaAberto) {
  const c = await DB.get('custosProducao', id);
  if (!c) { toast('Registo de custo não encontrado.', 'warning'); return; }
  if (!modalJaAberto) abrirModalCustoProducao(id);
  await preencherModalCustoProducao(c);
}
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
async function renderPlanosProducao(){
 const planos=await getData('planosProducao')||[];
 const rows=planos.map(p=>['<strong>'+esc(p.codigo||'PLANO-'+p.id)+'</strong><small style="display:block">'+esc(p.nome||'')+'</small>',esc(p.produto||'-'),fmtN(p.quantidade||0),esc((p.dataInicio||'—')+' → '+(p.dataFim||p.periodo||'—')),esc(p.responsavel||'-'),badge(p.status||'rascunho','info'),'<button class="btn btn-sm btn-primary" onclick="editarPlanoProducao('+Number(p.id)+')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" data-store="planosProducao" onclick="excluirItem(this.dataset.store,'+Number(p.id)+')"><i class="fas fa-trash"></i></button>']);
 return header('Planos de Produção',planos.length+' planos registados','var(--primary)','<button class="btn btn-success" onclick="abrirModalPlanoProducao()"><i class="fas fa-plus"></i> Novo Plano</button>','fa-calendar-alt')+
 '<div class="metric-grid"><div class="metric-card"><div class="label">Planos</div><div class="value">'+fmtN(planos.length)+'</div></div><div class="metric-card"><div class="label">Unidades planeadas</div><div class="value">'+fmtN(planos.reduce((n,p)=>n+(Number(p.quantidade)||0),0))+'</div></div><div class="metric-card"><div class="label">Em execução</div><div class="value">'+fmtN(planos.filter(p=>p.status==='ativo').length)+'</div></div><div class="metric-card"><div class="label">Concluídos</div><div class="value">'+fmtN(planos.filter(p=>p.status==='concluido').length)+'</div></div></div>'+
 '<div class="card">'+(rows.length?table(['Plano','Produto','Quantidade','Período','Responsável','Estado','Acções'],rows):'<div class="empty-state"><h3>Sem registos</h3><p>Crie um plano manual ou utilize o MRP.</p><button class="btn btn-primary" onclick="abrirModalPlanoProducao()">Novo Plano</button></div>')+'</div><div class="card"><p class="text-muted">Criar um plano não movimenta o stock. O consumo será registado durante a execução da ordem.</p><button class="btn btn-light" data-module="mrp" onclick="openModule(this.dataset.module)">Abrir MRP</button></div>';
}
async function abrirModalPlanoProducao(id){
 const produtos=await getData('produtos')||[],boms=await getData('boms')||[],p=id?await DB.get('planosProducao',id):null;
 if(id&&!p)return toast('Plano não encontrado.','warning');
 const hoje=new Date().toISOString().slice(0,10),fim=new Date(Date.now()+604800000).toISOString().slice(0,10);
 const opts=produtos.map(x=>'<option value="'+esc(x.id)+'" '+(String(x.id)===String(p&&p.produtoId||'')?'selected':'')+'>'+esc((x.codigo?x.codigo+' — ':'')+(x.nome||'Produto'))+'</option>').join('');
 const body='<form onsubmit="salvarPlanoProducao(event)"><input type="hidden" id="planoId" value="'+(p&&p.id||'')+'"><div class="form-grid">'+
 '<div class="form-group"><label>Nome do plano *</label><input class="form-control" id="planoNome" required value="'+esc(p&&p.nome||'')+'"></div>'+
 '<div class="form-group"><label>Código *</label><input class="form-control" id="planoCodigo" required value="'+esc(p&&p.codigo||('PLANO-'+Date.now().toString().slice(-8)))+'"></div>'+
 '<div class="form-group"><label>Produto final *</label><select class="form-control" id="planoProdutoId" required onchange="atualizarResumoBOMPlano()"><option value="">Seleccione...</option>'+opts+'</select></div>'+
 '<div class="form-group"><label>Quantidade *</label><input class="form-control" id="planoQtd" type="number" min="0.001" step="0.001" required value="'+(p&&p.quantidade||1)+'"></div>'+
 '<div class="form-group"><label>Data de início *</label><input class="form-control" id="planoInicio" type="date" required value="'+esc(p&&p.dataInicio||hoje)+'"></div>'+
 '<div class="form-group"><label>Data de conclusão *</label><input class="form-control" id="planoFim" type="date" required value="'+esc(p&&p.dataFim||fim)+'"></div>'+
 '<div class="form-group"><label>Responsável</label><input class="form-control" id="planoResponsavel" value="'+esc(p&&p.responsavel||'')+'"></div>'+
 '<div class="form-group"><label>Origem</label><select class="form-control" id="planoOrigem"><option value="stock">Reposição de stock</option><option value="encomenda">Encomenda de cliente</option><option value="previsao">Previsão de vendas</option><option value="mps">Plano mestre</option></select></div>'+
 '<div class="form-group"><label>Centro de trabalho / máquina</label><input class="form-control" id="planoCentro" value="'+esc(p&&p.centroTrabalho||'')+'"></div>'+
 '<div class="form-group"><label>Mão de obra / serviço</label><input class="form-control" id="planoServico" value="'+esc(p&&p.maoObraServico||'')+'"></div>'+
 '<div class="form-group"><label>Estado</label><select class="form-control" id="planoStatus">'+[['rascunho','Rascunho'],['planeado','Planeado'],['ativo','Em execução'],['concluido','Concluído'],['cancelado','Cancelado']].map(x=>'<option value="'+x[0]+'" '+((p&&p.status||'rascunho')===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'+
 '<div class="form-group" style="grid-column:1/-1"><label>Observações</label><textarea class="form-control" id="planoObs">'+esc(p&&p.observacoes||'')+'</textarea></div></div>'+
 '<div class="card"><strong>Lista de materiais (BOM)</strong><div id="planoBomResumo">Seleccione um produto.</div><small>Consulta informativa. Não movimenta stock.</small></div>'+
 '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button type="button" class="btn btn-light" onclick="closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Guardar plano</button></div></form>';
 openModal(p?'Editar Plano de Produção':'Novo Plano de Produção',body,true);window.kanawaPlanoBoms=boms;window.kanawaPlanoProdutos=produtos;atualizarResumoBOMPlano();
}
function atualizarResumoBOMPlano(){
 const select=$('planoProdutoId'),host=$('planoBomResumo');if(!select||!host)return;
 const prod=(window.kanawaPlanoProdutos||[]).find(x=>String(x.id)===String(select.value));if(!prod){host.textContent='Seleccione um produto.';return;}
 const list=(window.kanawaPlanoBoms||[]).filter(b=>String(b.produto||b.produtoNome||'').trim().toLowerCase()===String(prod.nome||'').trim().toLowerCase()||String(b.produtoId||'')===String(prod.id));
 host.innerHTML=list.length?'<ul>'+list.map(b=>'<li>'+esc(b.material||b.materialNome||'Material')+': '+fmtN(b.quantidade||0)+' '+esc(b.unidade||'UN')+'</li>').join('')+'</ul>':'<span class="text-warning">Ficha técnica BOM não cadastrada.</span>';
}
async function salvarPlanoProducao(event){
 if(event)event.preventDefault();
 const id=$('planoId').value,produtoId=$('planoProdutoId').value,prod=(window.kanawaPlanoProdutos||[]).find(x=>String(x.id)===String(produtoId));
 const nome=$('planoNome').value.trim(),codigo=$('planoCodigo').value.trim().toUpperCase(),qtd=Number($('planoQtd').value),inicio=$('planoInicio').value,fim=$('planoFim').value;
 if(!nome||!codigo||!prod||!Number.isFinite(qtd)||qtd<=0)return toast('Preencha nome, código, produto e quantidade válida.','warning');
 if(!inicio||!fim||fim<inicio)return toast('A data final não pode anteceder a data inicial.','warning');
 const all=await getData('planosProducao');if(all.some(x=>String(x.codigo||'').toLowerCase()===codigo.toLowerCase()&&String(x.id)!==String(id)))return toast('Código de plano já existente.','error');
 const oldRecord=id?await DB.get('planosProducao',Number(id)):{},list=(window.kanawaPlanoBoms||[]).filter(b=>String(b.produto||b.produtoNome||'').trim().toLowerCase()===String(prod.nome||'').trim().toLowerCase()||String(b.produtoId||'')===String(prod.id));
 const item=Object.assign({},oldRecord||{},{nome,codigo,produto:prod.nome,produtoId:prod.id,quantidade:qtd,dataInicio:inicio,dataFim:fim,dataEntrega:fim,periodo:inicio.slice(0,7),responsavel:$('planoResponsavel').value.trim(),origem:$('planoOrigem').value,centroTrabalho:$('planoCentro').value.trim(),maoObraServico:$('planoServico').value.trim(),componentes:list.map(b=>({material:b.material||b.materialNome,quantidade:Number(b.quantidade)||0,unidade:b.unidade||'UN'})),observacoes:$('planoObs').value.trim(),status:$('planoStatus').value,updatedAt:now()});
 if(!id)item.createdAt=now();
 try{await saveData('planosProducao',item);closeModal();toast('Plano guardado. Stock não foi movimentado.','success');openModule('planos-producao');}catch(e){toast('Falha ao guardar plano: '+(e.message||'erro de ligação'),'error');}
}
async function editarPlanoProducao(id){return abrirModalPlanoProducao(id);}
/* LOGÍSTICA */
async function renderLogisticaRoteirizacao() {
  const rotas = await getData('roteirizacao') || [];
  setTimeout(() => inicializarMapaRotas(rotas), 120);
  return header('Roteirização', rotas.length + ' rotas e entregas', 'var(--primary)',
    '<button class="btn btn-success" onclick="abrirModalRota()"><i class="fas fa-plus"></i> Nova Rota</button>' +
    '<button class="btn btn-info" onclick="abrirMapaTransito()"><i class="fas fa-car"></i> Trânsito</button>', 'fa-route') +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-map-marked-alt"></i> Mapa de rotas</h3><span class="badge badge-info">Ruas e satélite</span></div>' +
    '<p class="text-muted" style="font-size:.82rem;margin-bottom:10px">Escolha a camada de ruas ou satélite. Use a localização do dispositivo como origem e selecione o destino clicando no mapa. A rota e a distância são calculadas pela rede rodoviária disponível.</p>' +
    '<div id="kanawaDeliveryMap" class="kanawa-delivery-map" role="application" aria-label="Mapa de rotas de entrega"></div>' +
    '<div class="quick-links" style="margin-top:10px"><button class="btn btn-sm btn-light" onclick="capturarLocalizacaoRota(\'origem\')"><i class="fas fa-location-arrow"></i> Minha localização</button><button class="btn btn-sm btn-light" onclick="selecionarDestinoNoMapa()"><i class="fas fa-map-pin"></i> Selecionar destino no mapa</button><button class="btn btn-sm btn-light" onclick="abrirMapaTransito()"><i class="fas fa-traffic-light"></i> Abrir trânsito no Google Maps</button></div>' +
    '<div id="kanawaRouteStatus" class="text-muted" style="font-size:.8rem;margin-top:8px">Aguarda seleção de origem e destino.</div></div>' +
    '<div class="card">' + table(['Origem', 'Destino', 'Distância', 'Veículo', 'Ações'],
      rotas.map(r => [esc(r.origem || '-'), esc(r.destino || '-'), esc(r.distancia || '-'), esc(r.veiculo || '-'), '<button class="btn btn-sm btn-info" onclick="verRotaNoMapa(' + r.id + ')"><i class="fas fa-map"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'roteirizacao\',' + r.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
function abrirModalRota() {
  openModal('Nova Rota de Entrega',
    '<div class="form-grid">' +
    '<div class="form-group"><label>Origem *</label><input id="rotaOrigem" placeholder="Morada de partida"></div>' +
    '<div class="form-group"><label>Destino *</label><input id="rotaDestino" placeholder="Morada do cliente"></div>' +
    '<div class="form-group"><label>Latitude da origem</label><input id="rotaOrigemLat" type="number" step="any" placeholder="-8.8383"></div>' +
    '<div class="form-group"><label>Longitude da origem</label><input id="rotaOrigemLng" type="number" step="any" placeholder="13.2344"></div>' +
    '<div class="form-group"><label>Latitude do destino</label><input id="rotaDestinoLat" type="number" step="any"></div>' +
    '<div class="form-group"><label>Longitude do destino</label><input id="rotaDestinoLng" type="number" step="any"></div>' +
    '<div class="form-group"><label>Veículo / transporte</label><input id="rotaVeiculo"></div></div>' +
    '<div class="quick-links"><button class="btn btn-sm btn-light" onclick="capturarLocalizacaoRota(\'origem\')"><i class="fas fa-location-arrow"></i> Usar a minha localização como origem</button><button class="btn btn-sm btn-light" onclick="closeModal();selecionarDestinoNoMapa()"><i class="fas fa-map-pin"></i> Escolher destino no mapa</button></div>' +
    '<p class="text-muted" style="font-size:.78rem;margin:8px 0">Também pode introduzir as coordenadas manualmente. A localização depende da autorização do dispositivo.</p>' +
    '<button class="btn btn-primary btn-block" onclick="salvarRota()">Guardar rota e calcular distância</button>');
  if(window.kanawaLastMapPoint){if($('rotaDestinoLat'))$('rotaDestinoLat').value=window.kanawaLastMapPoint.lat;if($('rotaDestinoLng'))$('rotaDestinoLng').value=window.kanawaLastMapPoint.lng;}
}
async function salvarRota() {
  const o = $('rotaOrigem').value.trim(), d = $('rotaDestino').value.trim();
  if (!o || !d) { toast('Preencha origem e destino', 'warning'); return; }
  const route = {
    origem:o,destino:d,veiculo:$('rotaVeiculo').value,
    origemLat:num($('rotaOrigemLat').value,NaN),origemLng:num($('rotaOrigemLng').value,NaN),
    destinoLat:num($('rotaDestinoLat').value,NaN),destinoLng:num($('rotaDestinoLng').value,NaN),data:now()
  };
  await saveData('roteirizacao',route);
  toast('Rota guardada', 'success'); closeModal(); openModule('logistica-roteirizacao');
}
function inicializarMapaRotas(rotas) {
  const host=$('kanawaDeliveryMap');if(!host)return;
  if(typeof L==='undefined'){host.innerHTML='<div class="kanawa-map-fallback">Mapa indisponível sem ligação à biblioteca cartográfica. Verifique a ligação à internet.</div>';return;}
  if(window.kanawaRouteMap){try{window.kanawaRouteMap.remove();}catch(error){}}
  const map=L.map(host,{scrollWheelZoom:true}).setView([-8.8383,13.2344],12);
  const streets=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'});
  const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'});
  streets.addTo(map);L.control.layers({'Ruas':streets,'Satélite':satellite},null,{position:'topright'}).addTo(map);
  window.kanawaRouteMap=map;window.kanawaRouteMarkers=[];window.kanawaRouteLine=null;window.kanawaSelectedRoute=null;
  map.on('click',function(e){
    if(!window.kanawaSelectDestination)return;
    window.kanawaSelectDestination=false;
    const lat=e.latlng.lat.toFixed(6),lng=e.latlng.lng.toFixed(6);
    window.kanawaLastMapPoint={lat,lng};
    if($('rotaDestinoLat'))$('rotaDestinoLat').value=lat;
    if($('rotaDestinoLng'))$('rotaDestinoLng').value=lng;
    if($('rotaDestino')&&!$('rotaDestino').value)$('rotaDestino').value='Destino seleccionado no mapa';
    if($('kanawaRouteStatus'))$('kanawaRouteStatus').textContent='Destino seleccionado: '+lat+', '+lng;
    L.marker([Number(lat),Number(lng)]).addTo(map).bindPopup('Destino da entrega').openPopup();
  });
  (rotas||[]).forEach(r=>{
    const valid=[r.origemLat,r.origemLng,r.destinoLat,r.destinoLng].every(v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v)));
    if(valid)desenharRotaNoMapa(r,map);
  });
  setTimeout(()=>map.invalidateSize(),150);
}
function selecionarDestinoNoMapa(){
  if(!window.kanawaRouteMap){toast('Abra primeiro o mapa de rotas.','warning');return;}
  window.kanawaSelectDestination=true;
  if($('kanawaRouteStatus'))$('kanawaRouteStatus').textContent='Toque no mapa para marcar a localização do cliente.';
  toast('Toque no mapa para escolher o destino.','info');
}
function capturarLocalizacaoRota(tipo){
  if(!navigator.geolocation){toast('Este dispositivo não disponibiliza geolocalização.','warning');return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude.toFixed(6),lng=pos.coords.longitude.toFixed(6);
    const prefix=tipo==='destino'?'rotaDestino':'rotaOrigem';
    if($(prefix+'Lat'))$(prefix+'Lat').value=lat;
    if($(prefix+'Lng'))$(prefix+'Lng').value=lng;
    if($(prefix)&&!$(prefix).value)$(prefix).value=tipo==='origem'?'Minha localização':'Localização selecionada';
    if(window.kanawaRouteMap){const point=[Number(lat),Number(lng)];window.kanawaRouteMap.setView(point,15);L.marker(point).addTo(window.kanawaRouteMap).bindPopup(tipo==='origem'?'Origem actual':'Destino').openPopup();}
    if($('kanawaRouteStatus'))$('kanawaRouteStatus').textContent='Localização '+tipo+' capturada com precisão aproximada de '+Math.round(pos.coords.accuracy)+' m.';
  },error=>toast('Não foi possível obter a localização: '+error.message,'warning'),{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
}
async function desenharRotaNoMapa(route,map) {
  window.kanawaSelectedRoute=route;
  const start=[Number(route.origemLat),Number(route.origemLng)],end=[Number(route.destinoLat),Number(route.destinoLng)];
  if([route.origemLat,route.origemLng,route.destinoLat,route.destinoLng].some(v=>v===null||v===''||v===undefined)||!start.concat(end).every(Number.isFinite))return;
  L.marker(start).addTo(map).bindPopup('Origem: '+esc(route.origem||''));
  L.marker(end).addTo(map).bindPopup('Destino: '+esc(route.destino||''));
  try{
    const url='https://router.project-osrm.org/route/v1/driving/'+start[1]+','+start[0]+';'+end[1]+','+end[0]+'?overview=full&geometries=geojson';
    const response=await fetch(url);if(!response.ok)throw new Error('Serviço de rotas indisponível');
    const result=await response.json();if(!result.routes||!result.routes.length)throw new Error('Não foi encontrada rota rodoviária.');
    const r=result.routes[0],coords=r.geometry.coordinates.map(p=>[p[1],p[0]]);
    const line=L.polyline(coords,{color:'#2563eb',weight:5,opacity:.85}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[24,24]});
    const km=(r.distance/1000).toFixed(1),minutes=Math.round(r.duration/60);
    if($('kanawaRouteStatus'))$('kanawaRouteStatus').textContent='Distância rodoviária: '+km+' km · Duração estimada: '+minutes+' min. Trânsito em tempo real não incluído neste cálculo.';
    if(route.id&&!route.distancia){route.distancia=km+' km';route.duracao=minutes+' min';await saveData('roteirizacao',route);}
  }catch(error){if($('kanawaRouteStatus'))$('kanawaRouteStatus').textContent=error.message||'Não foi possível calcular a rota.';}
}
async function verRotaNoMapa(id){
  const routes=await getData('roteirizacao')||[],route=routes.find(r=>String(r.id)===String(id));
  if(!route)return;
  openModule('logistica-roteirizacao');
  setTimeout(()=>{if(window.kanawaRouteMap&&[route.origemLat,route.origemLng,route.destinoLat,route.destinoLng].every(v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))))desenharRotaNoMapa(route,window.kanawaRouteMap);},300);
}
function abrirMapaTransito(){
  const route=window.kanawaSelectedRoute||{};
  const originLat=$('rotaOrigemLat')?$('rotaOrigemLat').value:route.origemLat;
  const originLng=$('rotaOrigemLng')?$('rotaOrigemLng').value:route.origemLng;
  const destLat=$('rotaDestinoLat')?$('rotaDestinoLat').value:route.destinoLat;
  const destLng=$('rotaDestinoLng')?$('rotaDestinoLng').value:route.destinoLng;
  let url='https://www.google.com/maps/@?api=1&map_action=map&basemap=traffic';
  if([originLat,originLng,destLat,destLng].every(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))){
    url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(originLat+','+originLng)+'&destination='+encodeURIComponent(destLat+','+destLng)+'&travelmode=driving';
  }
  window.open(url,'_blank','noopener');
}
function otimizarRotas() { toast('A otimização avançada exige origem e destino com coordenadas. Guarde as coordenadas para calcular a rota rodoviária.','info'); }

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

async function renderLogisticaArmazens(){
 const [warehouses,products,balances,transfers]=await Promise.all([getData('armazens'),getData('produtos'),getData('estoqueArmazens'),getData('transferencias')]);
 const balanceRows=balances.map(b=>{const p=products.find(x=>String(x.id)===String(b.produtoId));return [esc(p?p.nome:b.produtoCodigo||'Produto removido'),esc(b.armazem),fmtN(b.quantidade||0),p?fmt(p.precoCompra??p.purchase_cost??0):'—',p?fmt(p.precoVenda??p.preco??0):'—'];});
 const transferRows=transfers.slice().reverse().slice(0,100).map(t=>[fmtDT(t.data),esc(t.codigoProduto||''),esc(t.nomeProduto||''),esc(t.origem||''),esc(t.destino||''),fmtN(t.quantidade||0),badge(t.status||'concluída','success')]);
 return header('Armazéns e Transferências',warehouses.length+' armazéns • '+balances.length+' posições de stock','var(--info)','<button class="btn btn-success" onclick="novoArmazem()"><i class="fas fa-plus"></i> Novo Armazém</button><button class="btn btn-warning" onclick="abrirSaldoInicialArmazem()">Stock inicial</button><button class="btn btn-primary" onclick="abrirTransferenciaArmazem()">Transferir</button><button class="btn btn-info" onclick="abrirImportarTransferenciasExcel()">Importar Excel</button><button class="btn btn-sm" onclick="exportarTransferenciasExcel()">Exportar Excel</button>','fa-warehouse')+
 '<div class="card"><h3>Stock por armazém</h3>'+table(['Produto','Armazém','Quantidade','Custo unitário','Preço de venda'],balanceRows)+'</div><div class="card"><h3>Histórico de transferências</h3>'+table(['Data','Código','Produto','Origem','Destino','Quantidade','Estado'],transferRows)+'</div><div class="card"><h3>Modelo Excel de transferência</h3><p>Colunas obrigatórias: codigo, origem, destino, quantidade. A folha inteira é validada antes de movimentar stock.</p><button class="btn btn-info" onclick="baixarModeloTransferenciasExcel()">Descarregar modelo Excel</button></div>';
}
async function novoArmazem(){const n=prompt('Nome do armazém:');if(!n||!n.trim())return;const all=await getData('armazens');if(all.some(a=>a.nome.trim().toLowerCase()===n.trim().toLowerCase()))return toast('Este armazém já existe.','warning');await saveData('armazens',{nome:n.trim(),data:now()});toast('Armazém criado','success');openModule('logistica-armazens');}
async function abrirSaldoInicialArmazem(){const [warehouses,products]=await Promise.all([getData('armazens'),getData('produtos')]);if(!warehouses.length||!products.length)return toast('Cadastre armazéns e produtos primeiro.','warning');openModal('Registar stock inicial por armazém','<div class="form-group"><label>Produto</label><select id="whOpeningProduct">'+products.map(p=>'<option value="'+p.id+'">'+esc(p.codigo||'')+' — '+esc(p.nome)+'</option>').join('')+'</select></div><div class="form-group"><label>Armazém</label><select id="whOpeningWarehouse">'+warehouses.map(w=>'<option>'+esc(w.nome)+'</option>').join('')+'</select></div><div class="form-group"><label>Quantidade física</label><input id="whOpeningQty" type="number" min="0" step="0.001"></div><p>Total distribuído não pode ultrapassar o stock geral do produto.</p><button class="btn btn-primary btn-block" onclick="guardarSaldoInicialArmazem()">Guardar stock inicial</button>');}
async function guardarSaldoInicialArmazem(){const product=await DB.get('produtos',Number($('whOpeningProduct').value)),warehouse=$('whOpeningWarehouse').value,qty=Number($('whOpeningQty').value);if(!product||!warehouse||!Number.isFinite(qty)||qty<0)return toast('Informe produto, armazém e quantidade válida.','error');const balances=await getData('estoqueArmazens'),allocated=balances.filter(b=>String(b.produtoId)===String(product.id)).reduce((sum,b)=>sum+(Number(b.quantidade)||0),0),existing=balances.find(b=>String(b.produtoId)===String(product.id)&&b.armazem===warehouse),current=Number(existing?.quantidade)||0;if(allocated-current+qty>Number(product.estoque||0))return toast('Quantidade excede stock geral disponível.','error');if(existing){existing.quantidade=qty;await saveData('estoqueArmazens',existing);}else await saveData('estoqueArmazens',{produtoId:product.id,produtoCodigo:product.codigo,armazem:warehouse,quantidade:qty});toast('Stock inicial guardado.','success');closeModal();openModule('logistica-armazens');}
async function abrirTransferenciaArmazem(){const [warehouses,products]=await Promise.all([getData('armazens'),getData('produtos')]);if(warehouses.length<2)return toast('Cadastre pelo menos dois armazéns.','warning');openModal('Transferência entre armazéns','<div class="form-group"><label>Produto</label><select id="whProduct">'+products.map(p=>'<option value="'+p.id+'">'+esc(p.codigo||'')+' — '+esc(p.nome)+'</option>').join('')+'</select></div><div class="form-group"><label>Origem</label><select id="whFrom">'+warehouses.map(w=>'<option>'+esc(w.nome)+'</option>').join('')+'</select></div><div class="form-group"><label>Destino</label><select id="whTo">'+warehouses.map(w=>'<option>'+esc(w.nome)+'</option>').join('')+'</select></div><div class="form-group"><label>Quantidade</label><input id="whQty" type="number" min="0.001" step="0.001" value="1"></div><button class="btn btn-primary btn-block" onclick="confirmarTransferenciaArmazem()">Confirmar transferência</button>');}
async function confirmarTransferenciaArmazem(){const product=await DB.get('produtos',Number($('whProduct').value)),from=$('whFrom').value,to=$('whTo').value,qty=Number($('whQty').value);if(!product||!from||!to||from===to||!Number.isFinite(qty)||qty<=0)return toast('Produto, armazéns diferentes e quantidade positiva são obrigatórios.','error');const balances=await getData('estoqueArmazens'),source=balances.find(b=>String(b.produtoId)===String(product.id)&&b.armazem===from);if(!source||Number(source.quantidade)<qty)return toast('Stock insuficiente na origem. Disponível: '+fmtN(source?.quantidade||0),'error');await executarTransferenciaArmazem(product,from,to,qty);closeModal();openModule('logistica-armazens');}
async function executarTransferenciaArmazem(product,from,to,qty){
  return commitTransferenciasArmazemAtomicas([{product,from,to,qty}]);
}
async function commitTransferenciasArmazemAtomicas(transfers){
  if(!DB.db)throw new Error('Base de dados local ainda não está inicializada.');
  const balances=await getData('estoqueArmazens'),byKey=new Map(),changed=new Map(),history=[];
  balances.forEach(b=>byKey.set(String(b.produtoId)+'|'+b.armazem,{record:Object.assign({},b),isNew:false}));
  for(const t of transfers){
    const product=t.product,from=String(t.from||''),to=String(t.to||''),qty=Number(t.qty);
    if(!product||!from||!to||from===to||!Number.isFinite(qty)||qty<=0)throw new Error('Dados de transferência inválidos.');
    const sourceKey=String(product.id)+'|'+from,sourceEntry=byKey.get(sourceKey),source=sourceEntry&&sourceEntry.record;
    if(!source||Number(source.quantidade)<qty)throw new Error('Stock insuficiente no armazém '+from+' para '+product.nome+'.');
    source.quantidade=Number(source.quantidade)-qty;changed.set(sourceKey,source);
    const targetKey=String(product.id)+'|'+to;let targetEntry=byKey.get(targetKey);
    if(!targetEntry){targetEntry={record:{id:nextGeneratedRecordId(),produtoId:product.id,produtoCodigo:product.codigo,armazem:to,quantidade:0},isNew:true};byKey.set(targetKey,targetEntry);}
    targetEntry.record.quantidade=Number(targetEntry.record.quantidade||0)+qty;changed.set(targetKey,targetEntry.record);
    history.push({id:nextGeneratedRecordId(),produtoId:product.id,codigoProduto:product.codigo,nomeProduto:product.nome,origem:from,destino:to,quantidade:qty,status:'concluída',data:now()});
  }
  // Commit every balance change and its audit history in one IndexedDB transaction.
  await new Promise((resolve,reject)=>{
    const tx=DB.db.transaction(['estoqueArmazens','transferencias'],'readwrite');
    const balanceStore=tx.objectStore('estoqueArmazens'),historyStore=tx.objectStore('transferencias');
    changed.forEach(record=>balanceStore.put(record));history.forEach(record=>historyStore.put(record));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Falha na transação local de transferência.'));tx.onabort=()=>reject(tx.error||new Error('Transação de transferência cancelada.'));
  });
  // The local transaction is atomic. Cloud writes use stable IDs and are queued for retry if offline.
  for(const [key,record] of changed){
    const entry=byKey.get(key);
    if(window.KanawaCloud&&!KanawaCloud.isLocalOnly('estoqueArmazens')){
      if(KanawaCloud.ready){try{await KanawaCloud.upsertRecord('estoqueArmazens',record,{});}catch(error){await queueSync('estoqueArmazens',entry.isNew?'create':'update',record,{});}}
      else await queueSync('estoqueArmazens',entry.isNew?'create':'update',record,{});
    }
  }
  for(const record of history){
    if(window.KanawaCloud&&!KanawaCloud.isLocalOnly('transferencias')){
      if(KanawaCloud.ready){try{await KanawaCloud.upsertRecord('transferencias',record,{});}catch(error){await queueSync('transferencias','create',record,{});}}
      else await queueSync('transferencias','create',record,{});
    }
  }
  return history.length;
}
function baixarModeloTransferenciasExcel(){if(typeof XLSX==='undefined')return toast('Excel indisponível','warning');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{codigo:'PRD-0001',origem:'Armazém Central',destino:'Loja 1',quantidade:5}]),'Transferencias');XLSX.writeFile(wb,'modelo_transferencias_kanawa.xlsx');}
function abrirImportarTransferenciasExcel(){openModal('Importar transferências do Excel','<p>Colunas obrigatórias: codigo, origem, destino, quantidade. Todas as linhas serão validadas antes de executar.</p><input type="file" id="whImportFile" accept=".xlsx,.xls,.csv"><button class="btn btn-primary btn-block" onclick="validarTransferenciasExcel()">Validar ficheiro</button><div id="whImportResult"></div>');}
async function validarTransferenciasExcel(){if(typeof XLSX==='undefined')return toast('Excel indisponível','warning');const file=$('whImportFile')?.files?.[0];if(!file)return toast('Selecione o ficheiro','warning');try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}),[products,warehouses,balances]=await Promise.all([getData('produtos'),getData('armazens'),getData('estoqueArmazens')]),virtual=new Map(balances.map(b=>[String(b.produtoId)+'|'+b.armazem,Number(b.quantidade)||0])),errors=[],prepared=[];rows.forEach((r,i)=>{const code=String(r.codigo||'').trim(),from=String(r.origem||'').trim(),to=String(r.destino||'').trim(),qty=Number(r.quantidade),p=products.find(x=>String(x.codigo||'').toLowerCase()===code.toLowerCase()||String(x.codigoBarras||'')===code),issues=[];if(!p)issues.push('produto não encontrado pelo código');if(!warehouses.some(w=>w.nome===from))issues.push('armazém de origem não existe');if(!warehouses.some(w=>w.nome===to))issues.push('armazém de destino não existe');if(from&&to&&from===to)issues.push('origem e destino não podem ser iguais');if(!Number.isFinite(qty)||qty<=0)issues.push('quantidade inválida');if(p&&from&&Number.isFinite(qty)&&qty>0){const key=String(p.id)+'|'+from,available=virtual.get(key)||0;if(available<qty)issues.push('stock insuficiente na origem (disponível '+available+')');else{virtual.set(key,available-qty);const dest=String(p.id)+'|'+to;virtual.set(dest,(virtual.get(dest)||0)+qty);}}if(issues.length)errors.push({line:i+2,code,issues});else prepared.push({product:p,from,to,qty});});window.kanawaTransferPreview={errors,prepared};$('whImportResult').innerHTML=errors.length?'<div class="alert alert-danger"><strong>Importação bloqueada — nenhum stock foi movimentado.</strong>'+errors.map(e=>'<p>Linha '+e.line+' ('+esc(e.code)+'): '+e.issues.map(esc).join('; ')+'</p>').join('')+'</div>':'<div class="alert alert-success">'+prepared.length+' transferências válidas. <button class="btn btn-success" onclick="confirmarTransferenciasExcel()">Executar transferências</button></div>';}catch(e){$('whImportResult').textContent=e.message;toast('Erro: '+e.message,'error');}}
async function confirmarTransferenciasExcel(){const preview=window.kanawaTransferPreview;if(!preview||preview.errors.length)return toast('Valide novamente o Excel.','warning');const balances=await getData('estoqueArmazens'),virtual=new Map(balances.map(b=>[String(b.produtoId)+'|'+b.armazem,Number(b.quantidade)||0]));for(const t of preview.prepared){const key=String(t.product.id)+'|'+t.from,available=virtual.get(key)||0;if(available<t.qty)return toast('Transferência cancelada: stock da origem foi alterado.','error');virtual.set(key,available-t.qty);const dest=String(t.product.id)+'|'+t.to;virtual.set(dest,(virtual.get(dest)||0)+t.qty);}try{await commitTransferenciasArmazemAtomicas(preview.prepared);window.kanawaTransferPreview=null;toast(preview.prepared.length+' transferências executadas numa transação local única.','success');closeModal();openModule('logistica-armazens');}catch(e){toast('Falha durante transferência. Verifique o histórico antes de repetir: '+e.message,'error');}}
async function exportarTransferenciasExcel(){if(typeof XLSX==='undefined')return toast('Excel indisponível','warning');const rows=await getData('transferencias'),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.map(({codigoProduto,nomeProduto,origem,destino,quantidade,data,status})=>({codigo:codigoProduto,nome:nomeProduto,origem,destino,quantidade,data,status}))),'Transferencias');XLSX.writeFile(wb,'kanawa_transferencias_'+Date.now()+'.xlsx');}
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
  return renderProjectsViewsNav('projetos-kanban')+header('Kanban', t.length + ' tarefas', 'var(--primary)', '', 'fa-columns') +
    '<div class="kanban-columns">' + stages.map(s => { const ts = t.filter(x => x.status === s); return '<div class="kanban-column"><h5>' + (labels[s] || s) + ' (' + ts.length + ')</h5>' + (ts.length > 0 ? ts.map(x => '<div class="kanban-card" onclick="detalharTarefa(' + x.id + ')"><div style="font-weight:600;font-size:.75rem">' + esc(x.titulo) + '</div><div style="font-size:.6rem;color:var(--text-muted)">' + esc(x.responsavel || '-') + '</div></div>').join('') : '<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:.6rem">Vazio</div>') + '</div>'; }).join('') + '</div>';
}
async function detalharTarefa(id) { const t = await DB.get('tarefas', id); if (t) toast(t.titulo + ' - ' + (t.responsavel || 'Sem responsável'), 'info'); }
async function renderProjetosGantt() {
  const g = await getData('ganttProjetos') || [];
  return renderProjectsViewsNav('projetos-gantt')+header('Gantt Chart', g.length + ' atividades', 'var(--info)',
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
  return renderProjectsViewsNav('projetos-timesheet')+header('Timesheet', t.length + ' registros', 'var(--warning)',
    '<button class="btn btn-success" onclick="novoTimesheet()"><i class="fas fa-plus"></i> Novo Registro</button>', 'fa-clock') +
    '<div class="card">' + table(['Recurso', 'Projeto', 'Horas', 'Data', 'Ações'],
      t.map(x => [esc(x.recurso || '-'), esc(x.projeto || '-'), (x.horas || 0) + 'h', fmtD(x.data), '<button class="btn btn-sm btn-danger" onclick="excluirItem(\'timesheets\',' + x.id + ')"><i class="fas fa-trash"></i></button>'])) + '</div>';
}
async function novoTimesheet() { const r = prompt('Nome do recurso:'); if (!r) return; await saveData('timesheets', { recurso: r, projeto: prompt('Projeto:', 'Geral') || 'Geral', horas: parseFloat(prompt('Horas:', '0')) || 0, data: new Date().toISOString().split('T')[0], dataRegistro: now() }); toast('Timesheet registrado', 'success'); openModule('projetos-timesheet'); }
function renderProjetosCustos() {
  return renderProjectsViewsNav('projetos-custos')+header('Custo Real vs Planejado', 'Análise de custos', 'var(--danger)', '', 'fa-calculator') +
    '<div class="card"><div class="form-grid">' +
    '<div class="form-group"><label>Projeto</label><select id="custoProjeto"><option value="">Selecione...</option></select></div>' +
    '<div class="form-group"><label>Custo Planejado</label><input type="number" id="custoPlanejado" value="0"></div>' +
    '<div class="form-group"><label>Custo Real</label><input type="number" id="custoReal" value="0"></div></div>' +
    '<button class="btn btn-success" onclick="salvarCustoProjeto()"><i class="fas fa-save"></i> Salvar</button> <button class="btn btn-info" onclick="analisarCustos()"><i class="fas fa-chart-line"></i> Analisar</button></div>';
}
function salvarCustoProjeto() { toast('Custo salvo', 'success'); }
function analisarCustos() { toast('Análise concluída', 'success'); }
function renderProjetosRiscos() {
  return renderProjectsViewsNav('projetos-riscos')+header('Matriz de Riscos', 'Identificação e gestão', 'var(--warning)', '', 'fa-exclamation-triangle') +
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
async function renderManutencoesUnificadas(){
 const records=await getData('manutencoes')||[];
 const sorted=records.slice().sort((a,b)=>String(b.dataAgendada||b.data||'').localeCompare(String(a.dataAgendada||a.data||'')));
 const rows=sorted.map(item=>{
  const isVehicle=!!item.veiculo;
  const subject=item.veiculo||item.ativo||item.equipamento||'—';
  const status=item.status==='concluida'?'Concluída':(item.status==='em_curso'?'Em curso':(item.status||'Pendente'));
  const action=isVehicle?'concluirManutencaoFrota':'concluirManutencaoAtivo';
  return [isVehicle?'Viatura':'Activo / equipamento',esc(subject),esc(item.empresaCliente||item.cliente||'—'),esc(item.tecnicoNome||item.tecnico||'Por atribuir'),fmtD(item.dataAgendada||item.data),fmtD(item.proximaManutencao),badge(status,item.status==='concluida'?'success':item.status==='em_curso'?'info':'warning'),fmt(item.custo||0),
   '<button class="btn btn-sm btn-primary" onclick="verDetalheManutencao('+item.id+')" title="Ver histórico"><i class="fas fa-eye"></i></button> '+(item.status==='concluida'?'':'<button class="btn btn-sm btn-success" onclick="'+action+'('+item.id+')" title="Concluir"><i class="fas fa-check"></i></button> ')+'<button class="btn btn-sm btn-danger" onclick="excluirItem(\'manutencoes\','+item.id+')" title="Eliminar"><i class="fas fa-trash"></i></button>'];
 });
 return header('Manutenção Unificada',records.length+' intervenções de activos e viaturas','var(--warning)',
  '<button class="btn btn-light" onclick="novaManutencaoFrota()"><i class="fas fa-truck"></i> Nova manutenção de viatura</button> <button class="btn btn-success" onclick="novaManutencaoAtivo()"><i class="fas fa-tools"></i> Agendar activo / equipamento</button>','fa-tools')+
  '<div class="card"><p class="text-muted">Painel único para manutenção preventiva e correctiva de activos, equipamentos e viaturas. Todos os registos são lidos do mesmo histórico partilhado.</p>'+
  table(['Origem','Activo / viatura','Cliente / unidade','Técnico','Data','Próxima','Estado','Custo','Acções'],rows)+'</div>';
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
    '<div class="card"><strong>'+esc(m.empresaCliente||m.cliente||'—')+'</strong><p>'+esc(m.veiculo||m.ativo||m.equipamento||'—')+'</p>'+
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
async function renderEmpresasFiliais() {
  const context = window.KanawaCloud?.context || {};
  const company = context.company || {};
  const companyId = company.id;
  if (!companyId || !window.KanawaCloud?.ready) {
    return header('Empresas e Filiais', 'Gestão de estrutura empresarial', 'var(--primary)', '', 'fa-code-branch') +
      '<div class="card"><p>É necessário iniciar sessão e seleccionar uma empresa para gerir filiais.</p></div>';
  }
  const role = String(context.membership?.role || '').toLowerCase();
  const canManage = ['owner','admin'].includes(role);
  let links = [];
  try { links = await KanawaCloud.getCompanyBranches(); }
  catch (error) {
    return header('Empresas e Filiais', 'Gestão de estrutura empresarial', 'var(--primary)', '', 'fa-code-branch') +
      '<div class="card"><p class="text-danger">Não foi possível carregar as filiais: ' + esc(error.message) + '</p></div>';
  }
  const currentId = companyId;
  const rows = links.map(link => {
    const isParent = link.parent_company_id === currentId;
    const related = isParent ? link.branch : link.parent;
    const type = isParent ? 'Filial associada' : 'Empresa principal';
    const status = link.status === 'active' ? 'Activa' : link.status === 'pending' ? 'Pendente' : 'Inactiva';
    const statusColor = link.status === 'active' ? 'var(--success)' : link.status === 'pending' ? 'var(--warning)' : 'var(--text-muted)';
    const action = link.status === 'pending' && !isParent && canManage
      ? '<button class="btn btn-sm btn-success" onclick="aceitarAssociacaoFilial(\'' + link.parent_company_id + '\',\'' + link.branch_company_id + '\')"><i class="fas fa-check"></i> Aceitar</button>'
      : link.status === 'active' && canManage
        ? '<button class="btn btn-sm btn-outline-danger" onclick="desassociarFilial(\'' + link.parent_company_id + '\',\'' + link.branch_company_id + '\')"><i class="fas fa-unlink"></i> Desassociar</button>'
        : link.status === 'pending' && isParent ? '<small>A aguardar confirmação da filial</small>' : '—';
    return [
      '<strong>' + esc(related?.trade_name || related?.legal_name || (isParent ? link.branch_company_id : link.parent_company_id)) + '</strong>',
      esc(related?.tax_id || '—'),
      type,
      '<span style="color:' + statusColor + ';font-weight:700">' + status + '</span>',
      fmtDT(link.created_at),
      action
    ];
  });
  const form = canManage
    ? '<div class="card"><h3><i class="fas fa-link"></i> Associar uma filial existente</h3><p class="text-muted">Introduza o NIF de uma empresa já registada no KanawaSoft. A empresa filial terá de aceitar o pedido com a sua própria conta de proprietário ou administrador. Os dados operacionais continuam separados por empresa.</p><div class="form-grid"><div class="form-group"><label for="branchTaxId">NIF da empresa filial</label><input id="branchTaxId" type="text" maxlength="24" placeholder="Introduza o NIF da filial"></div><div class="form-group" style="align-self:end"><button class="btn btn-primary" onclick="solicitarAssociacaoFilial()"><i class="fas fa-paper-plane"></i> Enviar pedido</button></div></div></div>'
    : '<div class="card"><p>O seu perfil pode consultar as ligações, mas apenas o proprietário ou administrador pode solicitar, aceitar ou terminar associações.</p></div>';
  return header('Empresas e Filiais', links.length + ' ligações encontradas', 'var(--primary)', '', 'fa-code-branch') +
    '<div class="card"><div class="ks-branch-summary"><div><strong>' + esc(company.trade_name || company.legal_name || 'Empresa actual') + '</strong><small>Empresa seleccionada</small></div><div><strong>' + links.filter(x => x.status === 'active' && x.parent_company_id === currentId).length + '</strong><small>Filiais activas</small></div><div><strong>' + links.filter(x => x.status === 'pending').length + '</strong><small>Pedidos pendentes</small></div></div></div>' +
    form +
    '<div class="card"><h3>Ligações empresariais</h3>' +
    (rows.length ? table(['Empresa relacionada','NIF','Relação','Estado','Data do pedido','Acções'], rows) : '<div class="empty-state"><i class="fas fa-code-branch"></i><p>Ainda não existem filiais associadas a esta empresa.</p></div>') +
    '<p class="text-muted" style="margin-top:12px;font-size:.75rem">Cada empresa mantém o seu próprio stock, vendas, clientes, contabilidade e utilizadores. A associação não concede acesso automático aos dados operacionais da outra empresa.</p></div>';
}

async function solicitarAssociacaoFilial() {
  const field = document.getElementById('branchTaxId');
  const taxId = String(field?.value || '').trim();
  if (!taxId) { toast('Introduza o NIF da empresa filial.', 'warning'); return; }
  try {
    await KanawaCloud.requestCompanyBranchByTaxId(taxId);
    toast('Pedido enviado. A filial deve aceitar a associação.', 'success');
    openModule('filiais');
  } catch (error) { toast(error.message || 'Não foi possível enviar o pedido.', 'error'); }
}

async function aceitarAssociacaoFilial(parentId, branchId) {
  try {
    await KanawaCloud.acceptCompanyBranch(parentId, branchId);
    toast('Associação de filial activada.', 'success');
    openModule('filiais');
  } catch (error) { toast(error.message || 'Não foi possível aceitar a associação.', 'error'); }
}

async function desassociarFilial(parentId, branchId) {
  if (!confirm('Terminar a associação desta filial? Os dados da empresa não serão apagados.')) return;
  try {
    await KanawaCloud.unlinkCompanyBranch(parentId, branchId);
    toast('Associação terminada. Os dados das empresas foram preservados.', 'success');
    openModule('filiais');
  } catch (error) { toast(error.message || 'Não foi possível terminar a associação.', 'error'); }
}

async function renderFrotaGPS() {
  if (typeof window.renderFrotaGPSMapModule === 'function') return window.renderFrotaGPSMapModule();
  return header('GPS e Localização da Frota', 'Mapa indisponível', 'var(--info)', '', 'fa-satellite') +
    '<div class="card">O módulo de mapas não foi carregado.</div>';
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
  const [clientes, contasReceber, tickets, contratos] = await Promise.all([
    getData('clientes'), getData('contasReceber'), getData('tickets'), getData('contratos')
  ]);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const pendentes = contasReceber.filter(item => !['pago', 'cancelado', 'cancelada'].includes(String(item.status || '').toLowerCase()));
  const atrasadas = pendentes.filter(item => {
    if (!item.vencimento) return false;
    const vencimento = new Date(item.vencimento);
    if (Number.isNaN(vencimento.getTime())) return false;
    vencimento.setHours(0, 0, 0, 0);
    return vencimento < hoje;
  });
  const ticketsAbertos = tickets.filter(item => !['resolvido', 'fechado', 'cancelado'].includes(String(item.status || '').toLowerCase()));
  const contratosAtivos = contratos.filter(item => String(item.status || 'ativo').toLowerCase() === 'ativo');
  const empresa = window.KanawaCloud && KanawaCloud.context && KanawaCloud.context.company || {};
  const actor = kanawaCurrentActor();
  let atividades = [];
  if (window.KanawaCloud && KanawaCloud.ready && typeof KanawaCloud.listAuditEvents === 'function') {
    try {
      atividades = await KanawaCloud.listAuditEvents(8);
    } catch (error) {
      console.warn('Portal do Cliente — auditoria cloud:', error);
    }
  }
  if (!atividades.length && podeAcessar('auditoria')) {
    try {
      const locais = await getData('auditoria');
      atividades = locais.slice().sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0)).slice(0, 8);
    } catch (error) {
      console.warn('Portal do Cliente — auditoria local:', error);
    }
  }
  const activityRows = atividades.map(item => {
    const cloud = !!item.created_at;
    return [
      fmtDT(cloud ? item.created_at : item.data),
      esc(cloud ? (item.actor && item.actor.full_name || 'Utilizador') : (item.usuario || 'Utilizador')),
      badge(cloud ? item.action : item.acao, 'info'),
      esc(cloud ? item.resource_type || '—' : item.modulo || '—')
    ];
  });
  const action = (moduleId, label, icon) => podeAcessar(moduleId)
    ? '<button class="btn btn-sm btn-primary" onclick="openModule(\'' + moduleId + '\')"><i class="fas ' + icon + '"></i> ' + label + '</button>'
    : '';
  const auditCard = podeAcessar('auditoria')
    ? '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-history"></i> Actividade recente</h3>' + action('auditoria', 'Ver auditoria', 'fa-arrow-right') + '</div>' +
      table(['Data', 'Utilizador', 'Acção', 'Módulo'], activityRows) + '</div>'
    : '';
  return header('Portal do Cliente', 'Centro de relacionamento e auto-atendimento · ' + esc(empresa.name || empresa.legal_name || 'Empresa activa'),
    'var(--info)', action('clientes', 'Gerir clientes', 'fa-users') + action('usuarios', 'Gerir acessos', 'fa-user-shield'), 'fa-user-circle') +
    '<div class="card" style="border-left:4px solid var(--info)"><h3>Bem-vindo ao Portal do Cliente</h3><p class="text-muted">Acompanhe a carteira de clientes, obrigações financeiras, pedidos de suporte e contratos num único painel. Os indicadores abaixo são calculados a partir dos registos existentes nesta empresa.</p><small class="text-muted">Sessão: ' + esc(actor.name) + ' · ' + esc(actor.roleLabel) + '</small></div>' +
    '<div class="metric-grid">' +
      '<div class="metric-card"><div class="label"><i class="fas fa-users"></i> Clientes registados</div><div class="value">' + clientes.length + '</div><div class="sub">Carteira de clientes da empresa</div></div>' +
      '<div class="metric-card" style="border-left-color:var(--warning)"><div class="label"><i class="fas fa-file-invoice-dollar"></i> Contas a receber pendentes</div><div class="value">' + pendentes.length + '</div><div class="sub">' + atrasadas.length + ' vencidas</div></div>' +
      '<div class="metric-card" style="border-left-color:var(--danger)"><div class="label"><i class="fas fa-headset"></i> Tickets em aberto</div><div class="value">' + ticketsAbertos.length + '</div><div class="sub">Pedidos que ainda exigem acompanhamento</div></div>' +
      '<div class="metric-card" style="border-left-color:var(--success)"><div class="label"><i class="fas fa-file-contract"></i> Contratos activos</div><div class="value">' + contratosAtivos.length + '</div><div class="sub">Contratos com estado activo</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-bolt"></i> Atalhos rápidos</h3></div><div class="portal-quick-actions">' +
      action('clientes', 'Consultar clientes', 'fa-users') +
      action('financeiro', 'Ver contas a receber', 'fa-receipt') +
      action('tickets', 'Acompanhar suporte', 'fa-headset') +
      action('contratos', 'Consultar contratos', 'fa-file-contract') +
      action('usuarios', 'Utilizadores e permissões', 'fa-user-shield') +
      action('auditoria', 'Histórico de actividades', 'fa-history') +
    '</div></div>' +
    auditCard +
    '<div class="card"><h3><i class="fas fa-shield-alt"></i> Gestão de acessos</h3><p class="text-muted">A gestão actual de utilizadores e permissões da equipa está disponível no módulo Utilizadores. Contas individuais para clientes externos, convites de acesso ao portal e permissões próprias do cliente exigem um fluxo de autenticação e associação seguro; não serão simulados nem enviados até essa integração estar concluída.</p>' +
      (podeAcessar('usuarios') ? '<button class="btn btn-primary" onclick="openModule(\'usuarios\')"><i class="fas fa-user-cog"></i> Abrir gestão de utilizadores</button>' : '<span class="text-muted">O seu perfil não tem acesso à gestão de utilizadores.</span>') +
    '</div>';
}
function convidarClientePortal() {
  toast('O convite de acesso externo ainda não está integrado. Primeiro é necessário associar com segurança a conta do cliente à empresa e às respectivas permissões.', 'warning');
}
function abrirPortalCliente() {
  toast('A área externa self-service será disponibilizada depois da integração de autenticação e permissões dos clientes.', 'info');
}
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
let crmScoreTempFilter = 'todos';
let crmScoreSearch = '';

function crmScoreConfigPadrao() {
  return {
    id: 'lead-score-config', tipo: 'config',
    fitRules: [
      { key: 'cargo', value: 'CEO', points: 30, label: 'Cargo: CEO' },
      { key: 'cargo', value: 'Director', points: 25, label: 'Cargo: Director' },
      { key: 'cargo', value: 'Gerente', points: 20, label: 'Cargo: Gerente' },
      { key: 'cargo', value: 'Estagiário', points: -10, label: 'Cargo: Estagiário' },
      { key: 'tamanhoEmpresa', value: 'Grande', points: 15, label: 'Empresa de grande dimensão' },
      { key: 'setor', value: 'Tecnologia', points: 10, label: 'Setor: Tecnologia' }
    ],
    hotAt: 70, warmAt: 35, decayAfterDays: 30, decayPoints: 5,
    routingAt: 80, responsibleId: ''
  };
}
async function obterConfigScoreLeads() {
  const all = await getData('scoreLeads');
  return all.find(x => x.tipo === 'config') || crmScoreConfigPadrao();
}
function crmScoreTemperatura(score, cfg) {
  return score >= Number(cfg.hotAt || 70) ? 'hot' : score >= Number(cfg.warmAt || 35) ? 'warm' : 'cold';
}
function crmScoreQuadrante(fit, interest) {
  const grade = n => n >= 75 ? 'A' : n >= 50 ? 'B' : n >= 25 ? 'C' : 'D';
  const level = n => n >= 75 ? '1' : n >= 50 ? '2' : n >= 25 ? '3' : '4';
  return grade(fit) + level(interest);
}
function crmScoreData(data) {
  const d = new Date(data || 0);
  return Number.isNaN(d.getTime()) ? null : d;
}
async function calcularScoreLead(lead, cfg, events) {
  const fitReasons = [];
  let fitRaw = 0;
  (cfg.fitRules || []).forEach(rule => {
    const actual = String(lead[rule.key] || '').trim().toLowerCase();
    if (actual && actual === String(rule.value || '').trim().toLowerCase()) {
      fitRaw += Number(rule.points) || 0;
      fitReasons.push({ label: rule.label || (rule.key + ': ' + rule.value), points: Number(rule.points) || 0 });
    }
  });
  const fit = Math.max(0, Math.min(100, fitRaw));
  let interestRaw = 0;
  const reasons = [];
  let lastActivity = null;
  const createdAt = crmScoreData(lead.data);
  events.forEach(event => {
    const pts = Number(event.points) || 0;
    interestRaw += pts;
    reasons.push({ label: event.descricao || 'Atividade registada', points: pts, data: event.data });
    const d = crmScoreData(event.data);
    if (d && (!lastActivity || d > lastActivity)) lastActivity = d;
  });
  const inactivityAnchor = lastActivity || createdAt;
  const daysInactive = inactivityAnchor ? Math.max(0, Math.floor((Date.now() - inactivityAnchor.getTime()) / 86400000)) : 0;
  const decayPeriods = cfg.decayAfterDays > 0 ? Math.floor(daysInactive / Number(cfg.decayAfterDays)) : 0;
  const decay = decayPeriods * Math.max(0, Number(cfg.decayPoints) || 0);
  if (decay > 0) reasons.push({ label: 'Degradação por ' + daysInactive + ' dias sem nova atividade', points: -decay });
  const interest = Math.max(0, Math.min(100, interestRaw - decay));
  const total = Math.max(0, Math.min(100, Math.round(fit * 0.4 + interest * 0.6)));
  return {
    score: total, fit, interest, quadrant: crmScoreQuadrante(fit, interest),
    temperatura: crmScoreTemperatura(total, cfg), lastActivity: lastActivity ? lastActivity.toISOString() : null,
    fitReasons, reasons, daysInactive
  };
}
async function renderCRMScore() {
  const leads = await getData('leads') || [];
  const all = await getData('scoreLeads') || [];
  const cfg = all.find(x => x.tipo === 'config') || crmScoreConfigPadrao();
  const events = all.filter(x => x.tipo === 'evento');
  const users = await getData('usuarios') || [];
  const rows = [];
  const scored = [];
  for (const lead of leads) {
    const leadEvents = events.filter(e => String(e.leadId) === String(lead.id));
    const result = await calcularScoreLead(lead, cfg, leadEvents);
    scored.push({ lead, result });
    const temp = result.temperatura;
    const last = result.lastActivity ? new Date(result.lastActivity).toLocaleDateString('pt-AO') : 'Sem atividade';
    const status = lead.status === 'convertido' ? 'Convertido' : (lead.status || 'Novo');
    rows.push('<tr data-temp="' + temp + '" data-search="' + esc([lead.nome, lead.empresa, lead.email, lead.telefone, lead.setor].join(' ').toLowerCase()) + '">' +
      '<td><strong>' + esc(lead.nome || 'Lead sem nome') + '</strong><small style="display:block;color:var(--text-muted)">' + esc(lead.empresa || lead.email || lead.telefone || 'Sem contacto adicional') + '</small></td>' +
      '<td><strong>' + result.score + ' pts</strong><small style="display:block;color:var(--text-muted)">Perfil ' + result.fit + ' · Interesse ' + result.interest + '</small></td>' +
      '<td>' + badge(temp === 'hot' ? '🔥 Quente' : temp === 'warm' ? '🌤️ Morno' : '❄️ Frio', temp === 'hot' ? 'danger' : temp === 'warm' ? 'warning' : 'info') + '<small style="display:block;color:var(--text-muted)">' + result.quadrant + '</small></td>' +
      '<td>' + esc(last) + '</td><td>' + badge(status, lead.status === 'convertido' ? 'success' : 'secondary') + '</td>' +
      '<td><button class="btn btn-sm btn-primary" onclick="verDetalheScoreLead(' + Number(lead.id) + ')">Detalhes</button> <button class="btn btn-sm btn-light" onclick="enviarLeadParaCRM(' + Number(lead.id) + ')">CRM</button></td></tr>');
  }
  const hot = scored.filter(x => x.result.temperatura === 'hot').length;
  const warm = scored.filter(x => x.result.temperatura === 'warm').length;
  const cold = scored.filter(x => x.result.temperatura === 'cold').length;
  const converted = scored.filter(x => x.lead.status === 'convertido').length;
  const conversionByTemp = ['hot','warm','cold'].map(temp => { const group = scored.filter(x => x.result.temperatura === temp); const wins = group.filter(x => x.lead.status === 'convertido').length; return { temp, rate: group.length ? Math.round(wins / group.length * 100) : 0, wins, total: group.length }; });
  const avg = scored.length ? Math.round(scored.reduce((sum, x) => sum + x.result.score, 0) / scored.length) : 0;
  const dist = [['Quentes', hot, '#dc2626'], ['Mornos', warm, '#d97706'], ['Frios', cold, '#2563eb']];
  const bars = dist.map(x => '<div style="display:grid;grid-template-columns:76px 1fr 32px;gap:8px;align-items:center;margin:9px 0"><span>' + x[0] + '</span><div style="height:10px;background:var(--bg);border-radius:10px;overflow:hidden"><div style="height:100%;width:' + (scored.length ? Math.round(x[1] / scored.length * 100) : 0) + '%;background:' + x[2] + '"></div></div><strong>' + x[1] + '</strong></div>').join('');
  const userOptions = '<option value="">Não atribuir automaticamente</option>' + users.map(u => '<option value="' + esc(String(u.id)) + '" ' + (String(cfg.responsibleId || '') === String(u.id) ? 'selected' : '') + '>' + esc(u.nome || u.name || u.email || ('Utilizador ' + u.id)) + '</option>').join('');
  const headerActions = '<button class="btn btn-light" onclick="configurarScoreLeads()"><i class="fas fa-sliders-h"></i> Regras e encaminhamento</button> <button class="btn btn-success" onclick="abrirModalLead()"><i class="fas fa-plus"></i> Novo lead</button>';
  return header('Score de Leads', leads.length + ' potenciais clientes analisados', 'var(--primary)', headerActions, 'fa-chart-line') +
    '<div class="metric-grid">' +
    '<div class="metric-card"><div class="label">Leads quentes</div><div class="value">' + hot + '</div></div>' +
    '<div class="metric-card"><div class="label">Leads mornos</div><div class="value">' + warm + '</div></div>' +
    '<div class="metric-card"><div class="label">Leads frios</div><div class="value">' + cold + '</div></div>' +
    '<div class="metric-card"><div class="label">Score médio</div><div class="value">' + avg + '<small> / 100</small></div></div></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-filter"></i> Inteligência comercial</h3><span class="text-muted">' + converted + ' convertidos · ' + (scored.length ? Math.round(converted / scored.length * 100) : 0) + '% de conversão da base</span></div>' +
    '<div class="quick-links"><button class="btn btn-light" onclick="filtrarScoreTemperatura(\'todos\')">Todos (' + leads.length + ')</button><button class="btn btn-light" onclick="filtrarScoreTemperatura(\'hot\')">🔥 Quentes (' + hot + ')</button><button class="btn btn-light" onclick="filtrarScoreTemperatura(\'warm\')">🌤️ Mornos (' + warm + ')</button><button class="btn btn-light" onclick="filtrarScoreTemperatura(\'cold\')">❄️ Frios (' + cold + ')</button></div>' +
    '<div class="form-group"><label for="scoreLeadSearch">Pesquisar lead, empresa ou contacto</label><input id="scoreLeadSearch" type="search" placeholder="Nome, empresa, telefone ou email..." value="' + esc(crmScoreSearch) + '" oninput="filtrarTabelaScoreLeads(this.value)" style="width:100%"></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px"><section><h4>Distribuição por temperatura</h4>' + (scored.length ? bars : '<p class="text-muted">Ainda não existem leads para analisar.</p>') + '</section><section><h4>Matriz Perfil × Interesse</h4><p class="text-muted">A1 representa perfil forte e interesse elevado; D4 representa perfil e interesse baixos.</p><div style="display:grid;grid-template-columns:repeat(4,minmax(38px,1fr));gap:5px">' + ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4'].map(q => '<div style="padding:8px 4px;text-align:center;border:1px solid var(--border);border-radius:6px;background:' + (scored.some(x => x.result.quadrant === q) ? 'var(--surface)' : 'var(--bg)') + '"><strong>' + q + '</strong><small style="display:block;color:var(--text-muted)">' + scored.filter(x => x.result.quadrant === q).length + '</small></div>').join('') + '</div></section></div></div>' +
    '<div class="card"><h3><i class="fas fa-trophy"></i> Conversão por temperatura</h3><div class="quick-links">' + conversionByTemp.map(x => '<span class="badge badge-info">' + (x.temp === 'hot' ? 'Quentes' : x.temp === 'warm' ? 'Mornos' : 'Frios') + ': ' + x.rate + '% (' + x.wins + '/' + x.total + ')</span>').join(' ') + '</div><p class="text-muted">Indicador calculado com base nos leads actualmente marcados como convertidos; ainda não representa um modelo estatístico validado.</p></div>' +
    '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-fire"></i> Classificação de leads</h3><span class="text-muted">Pontuação de 0 a 100</span></div>'
    (rows.length ? '<div class="table-responsive"><table class="table" id="scoreLeadsTable"><thead><tr><th>Lead / Empresa</th><th>Score actual</th><th>Temperatura / Matriz</th><th>Última actividade</th><th>Estado CRM</th><th>Acções</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '<div class="empty-state"><i class="fas fa-chart-line"></i><h3>Sem leads para pontuar</h3><p>Registe um lead no CRM. A pontuação será calculada a partir do perfil e das actividades reais.</p><button class="btn btn-primary" onclick="abrirModalLead()">Adicionar primeiro lead</button></div>') + '</div>' +
    '<div class="card"><h3><i class="fas fa-route"></i> Encaminhamento automático</h3><p>Leads que atingirem ' + Number(cfg.routingAt || 80) + ' pontos poderão ser atribuídos ao responsável configurado. O encaminhamento só ocorre quando existir um responsável seleccionado.</p><p class="text-muted">Responsável actual: ' + esc((users.find(u => String(u.id) === String(cfg.responsibleId)) || {}).nome || (users.find(u => String(u.id) === String(cfg.responsibleId)) || {}).name || 'Não configurado') + '</p></div>';
}
function filtrarScoreTemperatura(temp) {
  crmScoreTempFilter = temp || 'todos';
  const tableEl = document.getElementById('scoreLeadsTable');
  if (!tableEl) return;
  Array.from(tableEl.querySelectorAll('tbody tr')).forEach(row => {
    row.style.display = (crmScoreTempFilter === 'todos' || row.dataset.temp === crmScoreTempFilter) && (!crmScoreSearch || (row.dataset.search || '').includes(crmScoreSearch.toLowerCase())) ? '' : 'none';
  });
}
function filtrarTabelaScoreLeads(value) {
  crmScoreSearch = String(value || '').trim().toLowerCase();
  filtrarScoreTemperatura(crmScoreTempFilter);
}
async function configurarScoreLeads() {
  const cfg = await obterConfigScoreLeads();
  const users = await getData('usuarios') || [];
  const userOptions = '<option value="">Não atribuir automaticamente</option>' + users.map(u => '<option value="' + esc(String(u.id)) + '" ' + (String(cfg.responsibleId || '') === String(u.id) ? 'selected' : '') + '>' + esc(u.nome || u.name || u.email || ('Utilizador ' + u.id)) + '</option>').join('');
  const rules = (cfg.fitRules || []).map((r, i) => '<div class="form-grid"><div class="form-group"><label>Campo</label><select id="scoreRuleKey' + i + '"><option value="cargo" ' + (r.key === 'cargo' ? 'selected' : '') + '>Cargo</option><option value="tamanhoEmpresa" ' + (r.key === 'tamanhoEmpresa' ? 'selected' : '') + '>Dimensão da empresa</option><option value="setor" ' + (r.key === 'setor' ? 'selected' : '') + '>Setor</option><option value="provincia" ' + (r.key === 'provincia' ? 'selected' : '') + '>Província</option></select></div><div class="form-group"><label>Valor correspondente</label><input id="scoreRuleValue' + i + '" value="' + esc(r.value) + '"></div><div class="form-group"><label>Pontos (+/-)</label><input id="scoreRulePoints' + i + '" type="number" value="' + Number(r.points || 0) + '"></div></div>').join('');
  openModal('Configuração do Score de Leads', '<p class="text-muted">As regras de perfil são comparadas com os dados do lead. Ajuste os pontos conforme o seu processo comercial.</p><h4>Regras de perfil (Fit)</h4><div id="scoreFitRules">' + rules + '</div><div class="form-grid"><div class="form-group"><label>Quente a partir de</label><input id="scoreHotAt" type="number" min="0" max="100" value="' + Number(cfg.hotAt || 70) + '"></div><div class="form-group"><label>Morno a partir de</label><input id="scoreWarmAt" type="number" min="0" max="100" value="' + Number(cfg.warmAt || 35) + '"></div></div><h4>Degradação por inactividade</h4><div class="form-grid"><div class="form-group"><label>Dias sem actividade</label><input id="scoreDecayDays" type="number" min="0" value="' + Number(cfg.decayAfterDays || 30) + '"></div><div class="form-group"><label>Pontos retirados por período</label><input id="scoreDecayPoints" type="number" min="0" value="' + Number(cfg.decayPoints || 5) + '"></div></div><h4>Encaminhamento automático</h4><div class="form-grid"><div class="form-group"><label>Score mínimo para encaminhar</label><input id="scoreRoutingAt" type="number" min="0" max="100" value="' + Number(cfg.routingAt || 80) + '"></div><div class="form-group"><label>Comercial responsável</label><select id="scoreResponsible">' + userOptions + '</select></div></div><button class="btn btn-primary btn-block" onclick="guardarConfigScoreLeads(' + (cfg.fitRules || []).length + ')">Guardar regras</button>');
}
async function guardarConfigScoreLeads(count) {
  const rules = [];
  for (let i = 0; i < count; i++) {
    const key = $('scoreRuleKey' + i).value;
    const value = $('scoreRuleValue' + i).value.trim();
    const points = Number($('scoreRulePoints' + i).value);
    if (!value || !Number.isFinite(points)) { toast('Preencha correctamente todas as regras.', 'warning'); return; }
    rules.push({ key, value, points, label: key + ': ' + value });
  }
  const cfg = {
    id: 'lead-score-config', tipo: 'config', fitRules: rules,
    hotAt: Math.max(0, Math.min(100, Number($('scoreHotAt').value) || 70)),
    warmAt: Math.max(0, Math.min(100, Number($('scoreWarmAt').value) || 35)),
    decayAfterDays: Math.max(0, Number($('scoreDecayDays').value) || 0),
    decayPoints: Math.max(0, Number($('scoreDecayPoints').value) || 0),
    routingAt: Math.max(0, Math.min(100, Number($('scoreRoutingAt').value) || 80)),
    responsibleId: $('scoreResponsible').value
  };
  if (cfg.warmAt > cfg.hotAt) { toast('O limite Morno não pode ser superior ao limite Quente.', 'warning'); return; }
  await saveData('scoreLeads', cfg);
  const leads = await getData('leads') || [];
  for (const lead of leads) await aplicarRoteamentoLead(lead.id);
  closeModal(); toast('Regras do Score guardadas.', 'success'); openModule('crm-score');
}
async function verDetalheScoreLead(id) {
  const lead = await DB.get('leads', id);
  if (!lead) { toast('Lead não encontrado.', 'warning'); return; }
  const all = await getData('scoreLeads') || [];
  const cfg = all.find(x => x.tipo === 'config') || crmScoreConfigPadrao();
  const events = all.filter(x => x.tipo === 'evento' && String(x.leadId) === String(id));
  const result = await calcularScoreLead(lead, cfg, events);
  const timeline = events.slice().sort((a,b) => Date.parse(b.data || 0) - Date.parse(a.data || 0)).map(e => '<div style="padding:9px 0;border-bottom:1px solid var(--border)"><strong>' + esc(e.descricao) + '</strong><span style="float:right;font-weight:700;color:' + (Number(e.points) >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + (Number(e.points) > 0 ? '+' : '') + Number(e.points) + ' pts</span><small style="display:block;color:var(--text-muted)">' + esc(e.data ? new Date(e.data).toLocaleString('pt-AO') : 'Data não registada') + '</small></div>').join('') + (result.reasons.some(r => String(r.label).startsWith('Degradação')) ? '<div style="padding:9px 0;color:var(--danger)"><strong>' + esc(result.reasons.find(r => String(r.label).startsWith('Degradação')).label) + '</strong><span style="float:right">' + Number(result.reasons.find(r => String(r.label).startsWith('Degradação')).points) + ' pts</span></div>' : '');
  openModal('Detalhes do lead — ' + esc(lead.nome || ''), '<div class="metric-grid"><div class="metric-card"><div class="label">Score total</div><div class="value">' + result.score + '/100</div></div><div class="metric-card"><div class="label">Perfil</div><div class="value">' + result.fit + '</div></div><div class="metric-card"><div class="label">Interesse</div><div class="value">' + result.interest + '</div></div></div><p><strong>Classificação:</strong> ' + esc(result.temperatura.toUpperCase()) + ' · <strong>Matriz:</strong> ' + result.quadrant + '</p><h4>Perfil — factores aplicados</h4>' + (result.fitReasons.length ? result.fitReasons.map(r => '<p>' + esc(r.label) + ': <strong>' + (r.points > 0 ? '+' : '') + r.points + '</strong></p>').join('') : '<p class="text-muted">Nenhuma regra de perfil corresponde aos dados deste lead.</p>') + '<h4>Linha do tempo — actividades e degradação</h4>' + (timeline || '<p class="text-muted">Ainda não existem actividades registadas para este lead.</p>') + '<button class="btn btn-success btn-block" onclick="registarAtividadeScoreLead(' + Number(id) + ')">Registar actividade / interesse</button>');
}
async function registarAtividadeScoreLead(id) {
  const descricao = prompt('Descreva a actividade real do lead (ex.: pediu demonstração):');
  if (!descricao || !descricao.trim()) return;
  const points = Number(prompt('Pontos desta actividade (ex.: 50 para pedido de demonstração):', '10'));
  if (!Number.isFinite(points) || points < -100 || points > 100) { toast('Informe uma pontuação entre -100 e 100.', 'warning'); return; }
  await saveData('scoreLeads', { tipo: 'evento', leadId: id, descricao: descricao.trim(), points, data: new Date().toISOString(), origem: 'registo_manual' });
  await aplicarRoteamentoLead(id);
  toast('Actividade registada e pontuação actualizada.', 'success');
  verDetalheScoreLead(id);
}
async function aplicarRoteamentoLead(id) {
  const lead = await DB.get('leads', id);
  if (!lead || lead.responsavelId) return false;
  const cfg = await obterConfigScoreLeads();
  if (!cfg.responsibleId) return false;
  const all = await getData('scoreLeads') || [];
  const events = all.filter(x => x.tipo === 'evento' && String(x.leadId) === String(id));
  const result = await calcularScoreLead(lead, cfg, events);
  if (result.score < Number(cfg.routingAt || 80)) return false;
  lead.responsavelId = cfg.responsibleId;
  lead.encaminhadoEm = new Date().toISOString();
  await saveData('leads', lead);
  return true;
}
async function enviarLeadParaCRM(id) {
  const lead = await DB.get('leads', id);
  if (!lead) return;
  if (lead.status !== 'convertido') lead.status = 'qualificado';
  lead.origemScore = true;
  await saveData('leads', lead);
  toast('Lead disponível no CRM para acompanhamento.', 'success');
  openModule('crm');
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
  const produtos = await getData('produtos',{force:true,waitForCloud:true,includeMedia:true});
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
  const ativos = servicos.filter(s => s.status !== 'inativo');
  const valorPotencial = ativos.reduce((sum,s) => sum + (Number(s.preco)||0),0);
  return header('Serviços', servicos.length + ' serviços registados', 'var(--info)',
    '<button class="btn btn-success" onclick="novoServico()"><i class="fas fa-plus"></i> Novo Serviço</button>', 'fa-concierge-bell') +
    '<div class="grid grid-3" style="margin-bottom:16px">' +
      '<div class="card"><small>Serviços activos</small><h2>' + fmtN(ativos.length) + '</h2></div>' +
      '<div class="card"><small>Preço de venda cadastrado</small><h2>' + fmt(valorPotencial) + '</h2></div>' +
      '<div class="card"><small>Categorias</small><h2>' + fmtN(new Set(servicos.map(s=>s.categoria).filter(Boolean)).size) + '</h2></div>' +
    '</div><div class="card">' + table(['Código', 'Serviço', 'Categoria', 'Unidade', 'Custo', 'Preço', 'Margem', 'IVA', 'Estado', 'Ações'],
      servicos.map(s => {
        const preco = Number(s.preco)||0, custo = Number(s.precoCusto)||0;
        const margem = preco-custo, margemPct = preco>0 ? margem/preco*100 : 0;
        return [esc(s.codigo || '-'), '<strong>' + esc(s.nome) + '</strong><small style="display:block;color:var(--text-muted)">' + esc(s.tipo==='subcontratado'?'Subcontratado':'Interno') + '</small>',
          esc(s.categoria||'-'), esc(s.unidade||s.duracao||'-'), fmt(custo), fmt(preco),
          '<span class="' + (margem>=0?'text-success':'text-danger') + '">' + fmt(margem) + ' (' + margemPct.toFixed(1) + '%)</span>',
          (Number(s.iva)||0) + '%', badge(s.status !== 'inativo' ? 'Activo' : 'Inactivo', s.status !== 'inativo' ? 'success' : 'danger'),
          '<button class="btn btn-sm btn-primary" onclick="editarServico(' + Number(s.id) + ')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="excluirItem(\'servicos\',' + Number(s.id) + ')"><i class="fas fa-trash"></i></button>'];
      })) + '</div>';
}
async function novoServico() { abrirFormularioServico(null); }
async function editarServico(id) { const servico = await DB.get('servicos', id); if (!servico) return toast('Serviço não encontrado.','warning'); abrirFormularioServico(servico); }
function abrirFormularioServico(servico) {
  const s = servico || {};
  const ivaPadrao = Number.isFinite(Number(s.iva)) ? Number(s.iva) : (Number(AGT_CONFIG.iva)*100);
  const options = (values, selected) => values.map(v => '<option value="' + esc(v[0]) + '"' + (String(selected)===String(v[0])?' selected':'') + '>' + esc(v[1]) + '</option>').join('');
  const codigo = s.codigo || ('SRV-' + String(Date.now()).slice(-6));
  const body = '<form id="servicoForm" onsubmit="guardarServico(event)">' +
    '<input type="hidden" id="servicoId" value="' + (s.id||'') + '">' +
    '<div class="form-grid">' +
    '<div class="form-group"><label>Nome do serviço *</label><input class="form-control" id="servicoNome" maxlength="120" required value="' + esc(s.nome||'') + '" placeholder="Ex.: Instalação de CCTV"></div>' +
    '<div class="form-group"><label>Código / SKU *</label><input class="form-control" id="servicoCodigo" maxlength="40" required value="' + esc(codigo) + '" placeholder="SRV-001"></div>' +
    '<div class="form-group"><label>Categoria / Família</label><input class="form-control" id="servicoCategoria" maxlength="80" value="' + esc(s.categoria||'') + '" placeholder="Assistência técnica"></div>' +
    '<div class="form-group"><label>Unidade de medida</label><select class="form-control" id="servicoUnidade">' + options([['serviço','Serviço / preço fixo'],['h','Hora (h)'],['dia','Dia'],['un','Unidade (un)'],['km','Quilómetro (km)'],['visita','Visita']],s.unidade||'serviço') + '</select></div>' +
    '<div class="form-group"><label>Preço de venda (Kz) *</label><input class="form-control" id="servicoPreco" type="number" min="0" step="0.01" required value="' + (s.preco??'') + '" oninput="calcularMargemServico()"></div>' +
    '<div class="form-group"><label>Preço de custo (Kz)</label><input class="form-control" id="servicoCusto" type="number" min="0" step="0.01" value="' + (s.precoCusto??0) + '" oninput="calcularMargemServico()"></div>' +
    '<div class="form-group"><label>Tipo de execução</label><select class="form-control" id="servicoTipo">' + options([['interno','Interno — equipa própria'],['subcontratado','Subcontratado — fornecedor externo']],s.tipo||'interno') + '</select></div>' +
    '<div class="form-group"><label>IVA (conforme enquadramento fiscal)</label><select class="form-control" id="servicoIva">' + options([[14,'14% — Geral'],[7,'7% — Reduzido'],[0,'0% — Isento / não liquidado']],ivaPadrao) + '</select><small>Confirme a taxa aplicável ao regime e à natureza do serviço da empresa.</small></div>' +
    '<div class="form-group"><label>Retenção na fonte</label><select class="form-control" id="servicoRetencao">' + options([['nao','Não aplicável / não configurada'],['sim','Sujeito a retenção (configurar taxa)']],s.retencaoFonte?'sim':'nao') + '</select></div>' +
    '<div class="form-group"><label>Taxa de retenção (%)</label><input class="form-control" id="servicoRetencaoTaxa" type="number" min="0" max="100" step="0.01" value="' + (s.retencaoTaxa??0) + '"></div>' +
    '<div class="form-group"><label>Estado</label><select class="form-control" id="servicoStatus">' + options([['ativo','Activo'],['inativo','Inactivo']],s.status||'ativo') + '</select></div>' +
    '<div class="form-group"><label>Duração estimada</label><input class="form-control" id="servicoDuracao" maxlength="40" value="' + esc(s.duracao||'') + '" placeholder="Ex.: 2 horas"></div>' +
    '<div class="form-group" style="grid-column:1/-1"><label>Descrição comercial</label><textarea class="form-control" id="servicoDescricao" rows="3" maxlength="1500">' + esc(s.descricaoComercial||s.descricao||'') + '</textarea></div>' +
    '<div class="form-group" style="grid-column:1/-1"><label>Notas internas (não aparecem na factura)</label><textarea class="form-control" id="servicoNotas" rows="2" maxlength="1000">' + esc(s.notasInternas||'') + '</textarea></div>' +
    '</div><div class="card" style="background:var(--bg-secondary);margin-top:12px"><strong>Margem estimada</strong><p id="servicoMargemPreview" style="font-size:1.2rem;font-weight:800;margin-top:6px">—</p><small>Margem calculada como preço de venda menos preço de custo; não inclui outros encargos.</small></div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button type="button" class="btn btn-light" onclick="closeModal()">Cancelar</button><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Guardar serviço</button></div></form>';
  openModal(s.id?'Editar Serviço':'Novo Serviço',body,true);
  calcularMargemServico();
}
function calcularMargemServico() {
  const preco = Number($('servicoPreco')?.value)||0, custo = Number($('servicoCusto')?.value)||0;
  const margem = preco-custo, pct = preco>0 ? margem/preco*100 : 0, el=$('servicoMargemPreview');
  if(el) { el.textContent = fmt(margem) + ' (' + pct.toFixed(1) + '% sobre venda)'; el.style.color = margem>=0?'var(--success)':'var(--danger)'; }
}
async function guardarServico(event) {
  if(event) event.preventDefault();
  const idValue=$('servicoId')?.value, nome=String($('servicoNome')?.value||'').trim(), codigo=String($('servicoCodigo')?.value||'').trim().toUpperCase();
  const preco=Number($('servicoPreco')?.value), custo=Number($('servicoCusto')?.value||0), iva=Number($('servicoIva')?.value);
  if(!nome||!codigo||!Number.isFinite(preco)||preco<0||!Number.isFinite(custo)||custo<0) return toast('Preencha nome, código e preços válidos.','warning');
  if(!Number.isFinite(iva)||![0,7,14].includes(iva)) return toast('Seleccione uma taxa de IVA disponível na configuração inicial.','warning');
  const todos=await getData('servicos');
  const duplicado=todos.find(x=>String(x.codigo||'').trim().toLowerCase()===codigo.toLowerCase()&&String(x.id)!==String(idValue));
  if(duplicado) return toast('Já existe um serviço com este código. Altere o código antes de guardar.','error');
  const nomeDuplicado=todos.find(x=>String(x.nome||'').trim().toLowerCase()===nome.toLowerCase()&&String(x.id)!==String(idValue));
  if(nomeDuplicado) return toast('Já existe um serviço com este nome. Verifique o registo antes de guardar.','error');
  const anterior=idValue?await DB.get('servicos',Number(idValue)):{};
  const retencao=$('servicoRetencao')?.value==='sim', taxaRetencao=Number($('servicoRetencaoTaxa')?.value||0);
  if(!Number.isFinite(taxaRetencao)||taxaRetencao<0||taxaRetencao>100) return toast('A taxa de retenção deve estar entre 0 e 100%.','warning');
  const item=Object.assign({},anterior||{},{
    codigo,nome,preco,precoCusto:custo,unidade:$('servicoUnidade').value,tipo:$('servicoTipo').value,
    iva,retencaoFonte:retencao,retencaoTaxa:retencao?taxaRetencao:0,categoria:$('servicoCategoria').value.trim(),
    duracao:$('servicoDuracao').value.trim(),descricaoComercial:$('servicoDescricao').value.trim(),
    descricao:$('servicoDescricao').value.trim(),notasInternas:$('servicoNotas').value.trim(),
    status:$('servicoStatus').value,updatedAt:now()
  });
  if(!idValue) item.createdAt=now();
  try { await saveData('servicos',item); closeModal(); toast('Serviço guardado com sucesso.','success'); await openModule('servicos'); }
  catch(error) { console.error('Guardar serviço:',error); toast('Não foi possível guardar o serviço: '+(error.message||'erro de ligação'),'error'); }
}
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
    try {
      cloudContext = await Promise.race([
        KanawaCloud.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('A recuperação da sessão na nuvem excedeu 10 segundos. Pode entrar novamente quando a ligação estiver disponível.')), 10000))
      ]);
    } catch (cloudError) {
      console.warn('Sessão cloud:', cloudError);
    }

    const loading = $('loadingScreen');
    if (cloudContext && KanawaCloud.ready) {
      showLoadingScreen('A verificar o banco de dados e a preparar a conta...');
      await activateCloudSession(cloudContext, true);
      hideLoadingScreen();
      mostrarAplicacaoAutenticada(cloudContext);
    } else if (window.KANAWA_PREVIEW_DEMO === true && window.KanawaCloud && typeof KanawaCloud.setPreviewContext === 'function') {
      hideLoadingScreen();
      const previewCompany = {
        id: 'preview-company',
        legal_name: 'Empresa de Demonstração',
        trade_name: 'Kanawa Soft — Ambiente de Teste',
        tax_id: '000000000',
        tax_regime: 'not_configured',
        email: 'demo@kanawasoft.shop'
      };
      const previewUser = {
        id: 'preview-user',
        email: 'demo@kanawasoft.shop',
        user_metadata: { full_name: 'Administrador de Demonstração' }
      };
      const previewContext = {
        company: previewCompany,
        user: previewUser,
        profile: { full_name: 'Administrador de Demonstração' },
        role: 'admin',
        membership: { role: 'owner' },
        isPlatformAdmin: true,
        plan_code: 'enterprise',
        preview: true,
        read_only: true
      };
      KanawaCloud.setPreviewContext(previewContext);
      localStorage.setItem('kanawa_empresa', JSON.stringify({
        id: 1, firma: previewCompany.trade_name, nome: previewCompany.legal_name,
        nif: previewCompany.tax_id, email: previewCompany.email, regime: previewCompany.tax_regime
      }));
      localStorage.setItem('kanawa_user', JSON.stringify({
        id: 1, nome: 'Administrador de Demonstração',
        email: previewUser.email, perfil: 'admin', role: 'admin'
      }));
      localStorage.setItem('kanawa_preview_read_only', 'true');
      mostrarAplicacaoAutenticada(previewContext);
      toast('Ambiente de demonstração — consulta apenas. Gravações e ligação à base de dados estão desactivadas.', 'warning');
    } else {
      hideLoadingScreen();
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
      const passwordInput = $('loginPassword');
      const passwordGroup = $('loginPasswordGroup');
      const useOtpInput = $('loginUseOtp');
      const otpToggleGroup = $('loginOtpToggleGroup');
      function loginMethod() { return 'email'; }
      function useOneTimeCode() { return true; }
      function updateLoginChannel() {
        if(methodInput){methodInput.value='email';methodInput.disabled=true;const methodGroup=methodInput.closest('.form-group');if(methodGroup)methodGroup.style.display='none';}
        const sms=false,otp=useOneTimeCode();
        emailInput.type=sms?'tel':'email';
        emailInput.autocomplete=sms?'tel':'email';
        emailInput.placeholder=sms?'923000000 ou +244923000000':'seu@email.com';
        if(identifierLabel)identifierLabel.textContent=sms?'📱 Telemóvel (9 dígitos ou formato internacional)':'📧 Gmail / Email';
        if(passwordGroup)passwordGroup.style.display=otp?'none':'block';
        if(passwordInput)passwordInput.required=!otp;
        if(otpToggleGroup)otpToggleGroup.style.display='none';
        if(submit)submit.innerHTML=otp?'<i class="fas fa-paper-plane"></i> Enviar código de acesso':'<i class="fas fa-sign-in-alt"></i> Entrar com Gmail e palavra-passe';
        if(otpHelp)otpHelp.textContent=sms
          ?'Enviámos um código de utilização única por SMS. Verifique se o número está confirmado na sua conta.'
          :'Enviámos um código de confirmação para o seu Gmail. Consulte também a pasta de spam.';
      }
      if(methodInput)methodInput.addEventListener('change',function(){if(!otpStep)emailInput.value='';updateLoginChannel();});
      if(useOtpInput)useOtpInput.addEventListener('change',updateLoginChannel);
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
      updateLoginChannel();

      function showLoginError(message) {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.classList.add('show');
      }
      function resetOtpStep() {
        otpStep = false;
        emailInput.readOnly = false;
        if (methodInput) methodInput.disabled = false;
        if (useOtpInput) useOtpInput.disabled = false;
        codeInput.value = '';
        codeInput.setCustomValidity('');
        codeInput.required = false;
        codeGroup.style.display = 'none';
        otpHelp.style.display = 'none';
        otpActions.style.display = 'none';
        updateLoginChannel();
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
        if (useOtpInput) useOtpInput.disabled = true;
        if (passwordGroup) passwordGroup.style.display = 'none';
        codeGroup.style.display = 'block';
        codeInput.required = true;
        otpHelp.style.display = 'block';
        otpActions.style.display = 'flex';
        submit.innerHTML = '<i class="fas fa-unlock-alt"></i> Validar código e entrar';
        codeInput.focus();
        toast('Código de acesso enviado por ' + (method === 'sms' ? 'SMS para ' : 'email para ') + identifier + '.', 'success');
      }

      window.kanawaStartSignupOtp = async function (email, alreadySent, otpType) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail) throw new Error('Email de registo inválido.');
        const confirmationType=otpType==='email'?'email':'signup';
        if(!alreadySent)await KanawaCloud.requestSignupOtp(normalizedEmail,confirmationType);
        localStorage.setItem('kanawa_pending_signup_otp', 'true');
        localStorage.setItem('kanawa_pending_signup_otp_type',confirmationType);
        emailInput.value = normalizedEmail;
        emailInput.type = 'email';
        emailInput.readOnly = true;
        if (methodInput) { methodInput.value = 'email'; methodInput.disabled = true; }
        if (useOtpInput) { useOtpInput.checked = true; useOtpInput.disabled = true; }
        if (passwordGroup) passwordGroup.style.display = 'none';
        codeGroup.style.display = 'block';
        codeInput.value = '';
        codeInput.required = true;
        otpStep = true;
        otpHelp.textContent = 'Enviámos um código de confirmação de 6 dígitos para o Gmail do registo. Introduza-o para activar a conta.';
        otpHelp.style.display = 'block';
        otpActions.style.display = 'flex';
        const changeButton = $('changeOtpEmailBtn');
        if (changeButton) changeButton.disabled = true;
        submit.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar email e activar conta';
        codeInput.focus();
        toast('Código de confirmação enviado para ' + normalizedEmail + '.', 'success');
      };

      loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (errorBox) { errorBox.textContent = ''; errorBox.classList.remove('show'); }
        submit.disabled = true;
        const idleLoginLabel = submit.innerHTML;
        submit.setAttribute('aria-busy','true');
        submit.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> A processar acesso...';
        try {
          showLoadingScreen('A validar o acesso e a ligação à base de dados...');
          if (!otpStep) {
            if (!useOneTimeCode()) {
              const identifier=emailInput.value.trim();
              if(!identifier||!emailInput.checkValidity()){emailInput.reportValidity();return;}
              if(!passwordInput||!passwordInput.value){if(passwordInput)passwordInput.reportValidity();return;}
              const pendingKey=$('preLoginLicenseKey')&&$('preLoginLicenseKey').value.trim();
              if(pendingKey)sessionStorage.setItem('kanawa_pending_license_key',pendingKey);
              const ctx=await KanawaCloud.signInWithPassword(identifier,passwordInput.value);
              await activateCloudSession(ctx,true);
              localStorage.removeItem('kanawa_pending_email');
              hideLoadingScreen();
              mostrarAplicacaoAutenticada(ctx);
              toast('Sessão iniciada. Gmail confirmado e palavra-passe validada.','success');
              return;
            }
            await sendLoginCode();
            return;
          }
          const pendingSignup = localStorage.getItem('kanawa_pending_signup_otp') === 'true';
          const ctx = pendingSignup
            ? await KanawaCloud.verifySignupOtp(emailInput.value, codeInput.value, localStorage.getItem('kanawa_pending_signup_otp_type') || 'signup')
            : await KanawaCloud.verifyOtp(emailInput.value, codeInput.value, loginMethod());
          if (pendingSignup) { localStorage.removeItem('kanawa_pending_signup_otp'); localStorage.removeItem('kanawa_pending_signup_otp_type'); }
          await activateCloudSession(ctx, true);
          if (loginMethod() === 'email') localStorage.removeItem('kanawa_pending_email');
          hideLoadingScreen();
          mostrarAplicacaoAutenticada(ctx);
          toast('Sessão iniciada. Os seus dados estão disponíveis no espaço de trabalho.', 'success');
        } catch (error) {
          hideLoadingScreen();
          showLoginError(error.message || 'Não foi possível validar o acesso. Confirme o Gmail e verifique a palavra-passe.');
        } finally {
          if (otpStep) hideLoadingScreen();
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
            const invitedEmail=$('inviteEmail').value.trim().toLowerCase();
            $('inviteSignupPanel').style.display='none';
            localStorage.setItem('kanawa_pending_email',invitedEmail);
            await window.kanawaStartSignupOtp(invitedEmail,true,result.otpType||'signup');
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
          if (localStorage.getItem('kanawa_pending_signup_otp') === 'true') {
            await KanawaCloud.requestSignupOtp(emailInput.value,localStorage.getItem('kanawa_pending_signup_otp_type')||'signup');
          } else {
            await KanawaCloud.requestOtp(emailInput.value, loginMethod());
          }
          toast('Novo código enviado. Utilize o código mais recente.', 'success');
          if (errorBox) { errorBox.textContent = ''; errorBox.classList.remove('show'); }
        } catch (error) {
          showLoginError(error.message || 'Não foi possível reenviar o código.');
        } finally {
          resendButton.disabled = false;
        }
      });

      const changeEmailButton = $('changeOtpEmailBtn');
      if (changeEmailButton) changeEmailButton.addEventListener('click', function () {
        if (localStorage.getItem('kanawa_pending_signup_otp') === 'true') {
          toast('Conclua primeiro a confirmação do email utilizado no registo.', 'warning');
          return;
        }
        resetOtpStep();
      });
    }

    aplicarTemaPersonalizado();
    startAutoSync();
  } catch (e) {
    console.error('Init error:', e);
    const loading = $('loadingScreen');
    if (loading) {
      loading.classList.remove('hidden');
      loading.innerHTML = '<div style="max-width:560px;padding:28px;text-align:center;color:#fff"><div class="loading-spinner" aria-hidden="true"></div><h2 style="margin:16px 0 12px">Não foi possível iniciar o Kanawa Soft</h2><p style="line-height:1.6;margin-bottom:18px">' + esc(e && e.message ? e.message : 'Erro inesperado durante a inicialização.') + '</p><button type="button" onclick="location.reload()" style="border:0;border-radius:9px;padding:12px 20px;background:#fff;color:#1a3a5c;font-weight:700;cursor:pointer">Tentar novamente</button><p style="opacity:.75;font-size:.8rem;margin-top:14px">O sistema não abre o espaço de trabalho enquanto a ligação ao Supabase não estiver confirmada.</p></div>';
    }
    const errorBox = $('loginError');
    if (errorBox) { errorBox.textContent = 'Erro ao iniciar o Kanawa Soft: ' + (e && e.message ? e.message : 'erro inesperado'); errorBox.classList.add('show'); }
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
  'exportarRelatorioContabilCSV','imprimirRelatorioContabil','openModule','toggleMenuGroup','openMenuGroupScreen','toggleMobileSidebar','closeMobileSidebar','mudarAbaContabilidade','alterarPeriodoContabil','importarPGCAngola','adicionarLinhaLancamento','removerLinhaLancamento','recalcularTotaisLancamento','alterarEstadoModulo','abrirPermissoesMembro','guardarPermissoesMembro','abrirConfiguracaoAGT','guardarConfiguracaoAGT','prepararSAFTAO','calcularRetencaoIRTB','guardarRascunhoIRTBC','guardarRascunhoIVA','guardarRascunhoIRT','abrirDeclaracaoFiscal','closeModal','openModal','toggleTheme','toggleUserMenu','logout','aplicarLogo','setupNextStep','finalizarSetup','abrirCadastroEmpresa','toggleSync','syncNow','mostrarToast','toast','solicitarVerificacaoSMS','confirmarTelefoneSMS',
  'pdvIrParaTela','pdvSelecionarProduto','pdvAltQty','pdvRemoverItem','pdvSalvarCliente','pdvClienteAnonimo','pdvSelecionarPagamento','pdvAtualizarValores','pdvAbrirFechoVenda','pdvAtualizarClienteCampo','pdvLimparCarrinho','pdvSelecionarItemCarrinho','pdvCancelarVenda','pdvSalvarRascunho','pdvSalvarOrcamento','pdvFinalizarVenda','abrirModalPDVCliente','salvarNovoClientePDV','filtrarPDV','toggleFavorito',
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
  'exportarBackupCompleto','selecionarBackupParaRestauro','exportarVendasCSV',
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

function contabilCsvCell(value) {
  const text=String(value==null?'':value);
  return '"' + text.replace(/"/g,'""') + '"';
}
function contabilDownloadCsv(filename,headers,rows) {
  const csv=[headers].concat(rows).map(row=>row.map(contabilCsvCell).join(';')).join('\r\n');
  const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportarRelatorioContabilCSV() {
  const from=$('contPeriodoInicio')&&$('contPeriodoInicio').value || contabilidadeFromDate;
  const to=$('contPeriodoFim')&&$('contPeriodoFim').value || contabilidadeToDate;
  if(!from||!to||to<from){toast('Seleccione um período válido para exportar.','warning');return;}
  if(!window.KanawaCloud||!KanawaCloud.ready){toast('Ligue a empresa ao Supabase antes de exportar.','warning');return;}
  try {
    toast('A preparar o relatório contabilístico...','info');
    const tab=contabilidadeTab||'resumo';
    const snap=await KanawaCloud.getAccountingSnapshot();
    const reports=['balancete','resultados','balanco','razao'].includes(tab)
      ? await KanawaCloud.getAccountingReports(from,to) : null;
    let headers=[],rows=[],label=tab;
    if(tab==='contas') {
      headers=['Código','Conta','Tipo','Saldo normal','Débito acumulado','Crédito acumulado','Saldo'];
      rows=(snap.accounts||[]).map(a=>[a.account_code,a.name,a.account_type,a.normal_balance,a.debit_total,a.credit_total,a.balance]);
    } else if(tab==='diario'||tab==='resumo') {
      headers=['Número','Data','Descrição','Débito','Crédito','Estado'];
      rows=(snap.entries||[]).map(e=>[e.entry_number,e.entry_date,e.description,e.debit_total,e.credit_total,e.status]);
      label='diario';
    } else if(tab==='balancete') {
      headers=['Conta','Descrição','Classificação','Saldo inicial','Débito período','Crédito período','Saldo final'];
      rows=(reports&&reports.trial_balance||[]).map(r=>[r.account_code,r.name,r.is_off_balance?'Ordem/analítica':'Financeira',r.opening_balance,r.period_debit,r.period_credit,r.closing_balance]);
    } else if(tab==='resultados') {
      headers=['Indicador','Valor (Kz)'];
      const r=reports&&reports.income_statement||{};
      rows=[['Proveitos',r.income],['Custos e perdas',r.expenses],['Resultado líquido',r.net_result]];
    } else if(tab==='balanco') {
      headers=['Indicador','Valor (Kz)'];
      const r=reports&&reports.balance_sheet||{};
      rows=[['Activo',r.assets],['Passivo',r.liabilities],['Capital próprio',r.equity],['Diferença',r.difference]];
    } else {
      headers=['Data','Diário','Conta','Descrição da conta','Histórico','Débito','Crédito'];
      rows=(reports&&reports.ledger||[]).map(r=>[r.entry_date,r.entry_number,r.account_code,r.account_name,r.description,r.debit,r.credit]);
    }
    if(!rows.length){toast('Não existem linhas para exportar neste separador.','warning');return;}
    contabilDownloadCsv('KANAWA_CONTABILIDADE_'+label.toUpperCase()+'_'+from+'_'+to+'.csv',headers,rows);
    toast('Relatório exportado em CSV compatível com Excel.','success');
  } catch(error) { toast(error.message||'Não foi possível exportar o relatório.','error'); }
}
function imprimirRelatorioContabil() {
  if(!window.KanawaCloud||!KanawaCloud.ready){toast('Ligue a empresa antes de imprimir a contabilidade.','warning');return;}
  window.print();
}
async function exportarSaftContabilidade() {
  const from=$('contPeriodoInicio')&&$('contPeriodoInicio').value || contabilidadeFromDate;
  const to=$('contPeriodoFim')&&$('contPeriodoFim').value || contabilidadeToDate;
  if(!from||!to||to<from){toast('Seleccione um período válido para o SAF-T.','warning');return;}
  if(!window.KanawaCloud||!KanawaCloud.ready){toast('Ligue a empresa ao Supabase antes de exportar.','warning');return;}
  try {
    toast('A preparar o SAF-T (AO)...','info');
    const result=await KanawaCloud.exportAccountingSaft(from,to);
    const blob=new Blob([result.xml],{type:'application/xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=result.filename||('SAFT_AO_CONTABILIDADE_'+from+'_'+to+'.xml');
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    if(result.certificationStatus==='pre_certification') {
      toast('XML exportado. Estado pré-certificação: número de validação AGT ainda não configurado.','warning');
    } else {
      toast('SAF-T (AO) exportado. Valide o ficheiro no ambiente oficial antes de produção.','success');
    }
  } catch(error) {
    toast(error.message||'Não foi possível exportar o SAF-T (AO).','error');
  }
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
  const trigger=document.querySelector('.mobile-menu-toggle');
  if(trigger){
    trigger.setAttribute('aria-expanded',String(open));
    trigger.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
    trigger.title=open?'Fechar menu':'Abrir menu';
    const icon=trigger.querySelector('i');
    if(icon)icon.className='fas '+(open?'fa-times':'fa-bars');
  }
  if(open){
    const active=sidebar.querySelector('.sidebar-group-trigger.active');
    if(active)active.scrollIntoView({block:'nearest'});
  }
}
function closeMobileSidebar() { toggleMobileSidebar(false); }
if(typeof document!=='undefined'&&!window.__kanawaMenuKeyboardBound){
  window.__kanawaMenuKeyboardBound=true;
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&megaMenuVisible&&window.innerWidth<=900)toggleMegaMenu(false);else if(event.key==='Escape'&&$('sidebar')&&$('sidebar').classList.contains('mobile-open'))closeMobileSidebar();
    const area=$('content');
    const target=event.target;
    const editing=target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName));
    if(currentModule==='pdv'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
      if(event.key==='F2'){event.preventDefault();const search=$('pdvBusca');if(search)search.focus();return;}
      if(event.key==='F8'){event.preventDefault();pdvAbrirFechoVenda();return;}
      if(event.key==='Enter'&&$('pdvPaymentModal')&&target&&target.id==='pdvConfirmarPagamento'){event.preventDefault();pdvFinalizarVenda();return;}
      if(!editing&&(event.key==='+'||event.key==='='||event.code==='NumpadAdd')){event.preventDefault();if(pdvSelectedItemId!==null)pdvAltQty(pdvSelectedItemId,1);return;}
      if(!editing&&(event.key==='-'||event.code==='NumpadSubtract')){event.preventDefault();if(pdvSelectedItemId!==null)pdvAltQty(pdvSelectedItemId,-1);return;}
    }
    if(!area||editing||event.altKey||event.ctrlKey||event.metaKey)return;
    const step=Math.max(120,Math.round(area.clientHeight*0.8));
    const actions={PageDown:step,PageUp:-step,ArrowDown:60,ArrowUp:-60,Home:-area.scrollTop,End:area.scrollHeight};
    if(Object.prototype.hasOwnProperty.call(actions,event.key)){
      event.preventDefault();
      area.scrollBy({top:actions[event.key],behavior:'auto'});
    }
  });
  window.addEventListener('resize',()=>{
    if(window.innerWidth>900)closeMobileSidebar();
  },{passive:true});
}


function calcularRetencaoIRTB() {
  const base=Number($('irtBCBase')&&$('irtBCBase').value||0);
  const mode=$('irtBCMode')&&$('irtBCMode').value||'withholding';
  if(!Number.isFinite(base)||base<=0){toast('Introduza uma matéria colectável válida.','warning');return;}
  const rates={withholding:0.065,non_withholding:0.25,self_billing_b:0.02,self_billing_c:0.065};
  const labels={withholding:'Retenção na fonte — Grupo B/C',non_withholding:'Matéria colectável não sujeita a retenção — Grupo B/C',self_billing_b:'Auto-facturação — Grupo B',self_billing_c:'Auto-facturação — Grupo C'};
  const rate=rates[mode];const amount=base*rate;
  const result=$('irtBCResult');
  if(result)result.innerHTML='<strong>'+esc(labels[mode])+'</strong><div class="value">'+fmt(amount)+'</div><p class="text-muted">Base: '+fmt(base)+' · Taxa: '+(rate*100).toLocaleString('pt-AO',{maximumFractionDigits:2})+'%</p><p class="text-muted">Simulação informativa. Confirme enquadramento, retenção e prazo de entrega antes de declarar.</p>';
}

async function guardarRascunhoIRTBC() {
  try {
    const base=Number($('irtBCBase')&&$('irtBCBase').value||0);
    const mode=$('irtBCMode')&&$('irtBCMode').value||'withholding';
    const rates={withholding:0.065,non_withholding:0.25,self_billing_b:0.02,self_billing_c:0.065};
    const rate=rates[mode];
    if(!Number.isFinite(base)||base<=0||rate===undefined){toast('Introduza uma matéria colectável válida.','warning');return;}
    const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,0);
    const taxType=mode==='self_billing_b'?'IRT_B':mode==='self_billing_c'?'IRT_C':'IRT_BC';
    await KanawaCloud.saveTaxReturn({taxType,periodStart:fromDate,periodEnd:toDate,
      taxRegime:KanawaCloud.context.company.tax_regime,taxableBase:base,taxAmount:base*rate,taxCredit:0,payableAmount:base*rate,
      payload:{scenario:mode,rate,stage:'draft',legalReference:'Lei 28/20, artigos 10.º e 16.º'}});
    toast('Rascunho de retenção IRT guardado no servidor.','success');openModule('fiscal');
  } catch(error) { toast(error.message||'Não foi possível guardar o rascunho IRT B/C.','error'); }
}

async function guardarRascunhoIVA() {
  try {
    const period=new Date().toISOString().slice(0,7),parts=period.split('-').map(Number);
    const fromDate=period+'-01',toDate=new Date(Date.UTC(parts[0],parts[1],0)).toISOString().slice(0,10);
    const summary=await getFiscalSalesSummary({fromDate,toDate});
    const compras=(await getData('compras')).filter(c=>dateIsInRange(c.data||c.dataCompra||c.date||c.created_at,{fromDate,toDate}));
    const hasSalesVat=summary.hasSalesVat;
    const hasPurchaseVat=compras.some(c=>c.iva!==undefined&&c.iva!==null||c.ivaTotal!==undefined&&c.ivaTotal!==null||c.valorIVA!==undefined&&c.valorIVA!==null);
    if(!hasSalesVat||!hasPurchaseVat){toast('Não é seguro guardar a declaração: falta IVA discriminado nas vendas/notas de crédito ou compras.','warning');return;}
    const ivaV=moneyCentsToNumber(summary.netTaxCents);
    const ivaCCents=compras.reduce((sum,c)=>sum+moneyToCents(c.iva!==undefined&&c.iva!==null?c.iva:(c.ivaTotal!==undefined&&c.ivaTotal!==null?c.ivaTotal:(c.valorIVA||0))),0n);
    const ivaC=moneyCentsToNumber(ivaCCents),base=moneyCentsToNumber(summary.netBaseCents);
    const nowDate=new Date();
    await KanawaCloud.saveTaxReturn({taxType:'IVA',periodStart:start.toISOString().slice(0,10),periodEnd:end.toISOString().slice(0,10),
      taxRegime:KanawaCloud.context.company.tax_regime,taxableBase:base,taxAmount:ivaV,taxCredit:ivaC,payableAmount:moneyCentsToNumber(summary.netTaxCents-ivaCCents),
      payload:{salesCount:summary.sales.length,creditNotesCount:summary.creditNotesCount,purchaseCount:compras.length,ivaLiquidado:ivaV,ivaDedutivel:ivaC,source:'Kanawa Soft ERP',stage:'draft',calculation:'integer-cents'}});
    toast('Rascunho de IVA guardado com cálculo exacto em cêntimos.','success');openModule('fiscal');
  }catch(error){toast(error.message||'Não foi possível guardar o rascunho IVA.','error');}
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
      payload:{employeeCount:details.length,employeeInss:details.reduce((sum,e)=>sum+Number(e.employeeInss||0),0),employerInss:details.reduce((sum,e)=>sum+Number(e.employerInss||0),0),stage:'draft',legalReference:'Lei 14/25 e CIRT Lei 18/14 alterada pela Lei 28/20'}});
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
    '<p><strong>Tipos de documentos registados:</strong> '+esc(status.softwareDocumentTypes||'A definir após confirmação dos tipos oficiais no Portal do Parceiro')+'</p>'+
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

function recarregarDemo() {
  toast('A carga de dados fictícios está desactivada para proteger os registos reais. Use uma empresa de demonstração separada para testes.', 'warning');
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
    '<div class="card"><h3>Solicitar activação de pacote</h3><div class="form-grid"><div class="form-group"><label>Pacote</label><select id="activationPlan" onchange="atualizarTotalLicenca()">'+opts+'</select></div><div class="form-group"><label>Duração</label><select id="activationDuration" onchange="atualizarTotalLicenca()">'+termOpts+'</select></div><div class="form-group"><label>Meio de pagamento</label><select id="activationMethod"><option value="bank_transfer" '+(selectedMethod==='bank_transfer'?'selected':'')+'>Transferência bancária · validação manual</option><option value="multicaixa_express" '+(selectedMethod==='multicaixa_express'?'selected':'')+'>Multicaixa Express · validação manual (API pendente)</option></select></div><div class="form-group"><label>Referência / comprovativo</label><input id="activationReference" placeholder="Referência da operação"></div><div class="form-group full"><label>Comprovativo de pagamento (PDF/JPG/PNG)</label><input id="activationProof" type="file" accept=".pdf,image/jpeg,image/png,image/webp"></div></div><p id="activationTotal" style="font-weight:800">Total: —</p><button class="btn btn-primary" onclick="solicitarAtivacaoLicenca()">Enviar comprovativo para validação</button><p style="font-size:.76rem;color:var(--text-muted)">A licença permanece pendente até o pagamento ser verificado e o administrador emitir uma chave. O comprovativo não activa a licença automaticamente. A confirmação Multicaixa Express por API/webhook ainda não está configurada; por enquanto, todos os pedidos passam por validação manual.</p></div>'+
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
  openModal('Nova Despesa Geral','<div class="form-grid"><div class="form-group"><label for="dgCategoria">Categoria *</label><select id="dgCategoria" required><option>Renda</option><option>Água e electricidade</option><option>Internet e comunicações</option><option>Combustível e transporte</option><option>Manutenção</option><option>Material de escritório</option><option>Alimentação</option><option>Seguros</option><option>Impostos e taxas</option><option>Marketing</option><option>Outros</option></select></div><div class="form-group"><label for="dgFornecedor">Fornecedor</label><input id="dgFornecedor" maxlength="180"></div><div class="form-group full"><label for="dgDescricao">Descrição *</label><input id="dgDescricao" maxlength="240" required></div><div class="form-group"><label for="dgValor">Valor (Kz) *</label><input id="dgValor" type="number" min="0.01" step="0.01" required></div><div class="form-group"><label for="dgVenc">Vencimento</label><input id="dgVenc" type="date"></div><div class="form-group"><label for="dgCentro">Centro de custo</label><input id="dgCentro" maxlength="120"></div><div class="form-group"><label for="dgProjecto">Projecto</label><input id="dgProjecto" maxlength="120"></div></div><div class="form-actions"><button type="button" class="btn btn-light" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="guardarDespesaGeral()">Guardar despesa</button></div>');
}
async function guardarDespesaGeral(){
  const desc=String($('dgDescricao').value||'').trim(),amountRaw=String($('dgValor').value||'').trim(),amount=amountRaw===''?NaN:Number(amountRaw);
  if(!desc){toast('Informe a descrição da despesa.','warning');$('dgDescricao').focus();return;}
  if(!Number.isFinite(amount)||amount<=0){toast('O valor da despesa deve ser superior a zero.','warning');$('dgValor').focus();return;}
  try{
    await KanawaCloud.createGeneralExpense({category:$('dgCategoria').value,description:desc,supplierName:$('dgFornecedor').value.trim(),amount,dueOn:$('dgVenc').value||null});
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
    let emailSent=false;
    try{const mail=await KanawaCloud.sendLicenseKeyToOwner({licenseKey:result.license_key,planCode:'internal_lifetime',termCode:'lifetime_internal'});emailSent=true;toast('Chave enviada para '+mail.recipient+'.','success');}
    catch(mailError){toast('Chave criada, mas não enviada por email: '+(mailError.message||'configure o serviço de email.'),'warning');}
    openModal('Chave vitalícia interna emitida','<div style="padding:12px;background:var(--bg);border-radius:10px"><p><strong>Guarde esta chave agora. Ela não será apresentada novamente.</strong></p><h3 style="letter-spacing:.08em;overflow-wrap:anywhere">'+esc(result.license_key)+'</h3><p>Licença interna · Vitalícia · A chave pode ser activada uma única vez na empresa do proprietário.</p><button class="btn btn-primary" onclick="navigator.clipboard.writeText(\''+esc(result.license_key)+'\').then(()=>toast(\'Chave copiada\',\'success\'))">Copiar chave</button></div>');
    if(emailSent)toast('Chave vitalícia criada, guardada e enviada ao Gmail do proprietário.','success');
  }catch(e){toast(e.message||'Não foi possível gerar a chave vitalícia.','danger');}
}
async function emitirChavePedido(plan,termCode,requestId){
  const termName=({weekly:'7 dias',monthly:'1 mês',annual:'1 ano',two_year:'2 anos',three_year:'3 anos'}[termCode]||termCode);
  if(!confirm('Confirma que verificou o pagamento e pretende emitir uma chave '+plan+' por '+termName+'?'))return;
  try{
    const result=await KanawaCloud.issueLicenseKeyByTerm(plan,termCode,requestId);
    let emailSent=false;
    try{const mail=await KanawaCloud.sendLicenseKeyToOwner({licenseKey:result.license_key,planCode:result.plan_code||plan,termCode:termCode,requestId:requestId});emailSent=true;toast('Chave enviada para '+mail.recipient+'.','success');}
    catch(mailError){toast('Chave criada, mas não enviada por email: '+(mailError.message||'configure o serviço de email.'),'warning');}
    const durationLabel=result.is_lifetime?'Vitalícia':(Number(result.duration_days)>0?result.duration_days+' dias':result.duration_months+' meses');
    openModal('Chave de licença emitida','<div style="padding:12px;background:var(--bg);border-radius:10px"><p><strong>Copie esta chave agora. Ela não será mostrada novamente.</strong></p><h3 style="letter-spacing:.08em;overflow-wrap:anywhere">'+esc(result.license_key)+'</h3><p>Pacote: '+esc(result.plan_code)+' · Duração: '+esc(durationLabel)+' · Limite: '+Number(result.max_invoices_period).toLocaleString('pt-AO')+' facturas/mês</p><button class="btn btn-primary" onclick="navigator.clipboard.writeText(\''+esc(result.license_key)+'\').then(()=>toast(\'Chave copiada\',\'success\'))">Copiar chave</button></div>');
    if(emailSent)toast('Chave emitida e enviada para o Gmail do proprietário.','success');
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
  const gross=base+bonus+transport+meal+holiday+christmas+family+housing;

  // CIRT (Lei 18/14, alterada pela Lei 28/20): alimentação e transporte têm limites separados;
  // o abono de família não está sujeito até 5% do salário-base.
  const nonSubjectMeal=Math.min(meal,30000);
  const nonSubjectTransport=Math.min(transport,30000);
  const nonSubjectFamily=Math.min(family,base*0.05);
  // A isenção específica de subsídio de renda foi revogada; o valor é tratado como remuneração acessória.
  const taxableRemuneration=base+bonus+holiday+christmas+housing+
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
