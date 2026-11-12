(function () {
  'use strict';

  const SUPPORTED = ['pt', 'en', 'fr', 'es', 'zh', 'ar'];
  const LANGUAGE_NAMES = {
    pt: 'Português',
    en: 'English',
    fr: 'Français',
    es: 'Español',
    zh: '中文（普通话）',
    ar: 'العربية'
  };
  const HTML_LOCALES = { pt: 'pt-AO', en: 'en', fr: 'fr', es: 'es', zh: 'zh-CN', ar: 'ar' };

  const catalogs = {
    en: {
      'Dashboard':'Dashboard','Abertura e Fecho de Caixa':'Cash Opening and Closing','PDV':'POS','Vendas':'Sales',
      'Orçamentos':'Quotes','Produtos':'Products','Avaliações':'Reviews','Categorias':'Categories','Serviços':'Services',
      'Tabelas de Preços':'Price Lists','E-commerce':'E-commerce','Carrinho':'Cart','Pedidos':'Orders','Pagamento':'Payment',
      'Rastreio':'Tracking','Estoque':'Inventory','Produção':'Production','Ordens Produção':'Production Orders','MRP':'MRP',
      'BOM':'BOM','Custos Produção':'Production Costs','Qualidade':'Quality','Planos Produção':'Production Plans',
      'Compras':'Purchases','Clientes':'Customers','Fidelidade':'Loyalty','Cupons':'Coupons','Segmentação':'Segmentation',
      'Portal Cliente':'Customer Portal','Fornecedores':'Suppliers','Transportadoras':'Carriers','CRM':'CRM',
      'Pipeline':'Pipeline','Automação':'Automation','Score Leads':'Lead Scoring','Remarketing':'Remarketing',
      'Marketing':'Marketing','Integrações API':'API Integrations','Conformidade':'Compliance',
      'Empresa e Documentos Legais':'Company and Legal Documents','Licença e Pacotes':'License and Plans',
      'Despesas Gerais':'General Expenses','Férias e Dispensas':'Leave and Absences','Agenda e Marcações':'Calendar and Appointments',
      'Reuniões':'Meetings','Comunicação Interna':'Internal Communication','Aprovações':'Approvals',
      'Departamentos':'Departments','Orçamento Empresarial':'Business Budget','Documentos Funcionários':'Employee Documents',
      'Folha Salarial':'Payroll','Análise Marketing':'Marketing Analytics','Contabilidade':'Accounting',
      'Financeiro':'Finance','Fiscal AGT':'AGT Tax','RH':'Human Resources','Recrutamento':'Recruitment',
      'Desempenho':'Performance','Benefícios':'Benefits','Onboarding':'Onboarding','Ponto':'Time Clock',
      'Rescisão':'Termination','Carreira':'Career','Projetos':'Projects','Ativos':'Assets','Frota':'Fleet',
      'Contratos':'Contracts','Documentos':'Documents','Tickets':'Tickets','Relatórios':'Reports',
      'Relatórios de Gestão':'Management Reports','Notificações':'Notifications','Utilizadores':'Users',
      'Usuários':'Users','Auditoria':'Audit Log','Meu Perfil':'My Profile','Idioma do Sistema':'System Language',
      'Configurações':'Settings','Módulos':'Modules','Gestão e Relatórios':'Management and Reports',
      'Preferências':'Preferences','Idioma':'Language','Utilizadores e permissões':'Users and Permissions',
      'Membros da empresa':'Company Members','Convites pendentes':'Pending Invitations',
      'Convidar colaborador':'Invite Colleague','Não foi possível carregar a equipa':'Could not load the team',
      'Ligação cloud necessária':'Cloud connection required','Sem permissão':'Permission denied',
      'Nome':'Name','Email':'Email','Perfil':'Role','Estado':'Status','Ações':'Actions','Guardar perfil':'Save Role',
      'Permissões':'Permissions','Suspender':'Suspend','Reactivar':'Reactivate','Activo':'Active','Suspenso':'Suspended',
      'A aguardar activação':'Awaiting Activation','Não existem convites pendentes.':'There are no pending invitations.',
      'Gerente':'Manager','Operador':'Operator','Caixa':'Cashier','Contabilista':'Accountant',
      'Administrador':'Administrator','Proprietário':'Owner','Data':'Date','Colaborador':'Team Member',
      'Função':'Role','Acção':'Action','Módulo':'Module','Detalhes':'Details','Actualizar':'Refresh','Imprimir':'Print',
      'Erro ao abrir o módulo':'Error opening module','Tentar novamente':'Try Again',
      'Filtrar relatório de vendas':'Filter Sales Report','Período':'Period','Dia':'Day','Mês':'Month',
      'Aplicar filtro':'Apply Filter','Relatório geral':'Overall Report','Faturamento':'Revenue',
      'Ticket médio':'Average Transaction','Produtos no catálogo':'Products in Catalogue',
      'Clientes cadastrados':'Registered Customers','Exportações adicionais':'Additional Exports',
      'Backup JSON':'JSON Backup','Vendas CSV':'Sales CSV','Produtos Excel':'Products Excel',
      'Total':'Total','Pagamento':'Payment','Ainda não existem registos de auditoria para apresentar.':'There are no audit records to display.',
      'Idioma guardado.':'Language saved.','Escolha o idioma da sua conta':'Choose your account language',
      'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'Your selected language will be applied automatically to available screens and modules.'
    },
    fr: {
      'Dashboard':'Tableau de bord','Abertura e Fecho de Caixa':'Ouverture et clôture de caisse','PDV':'Point de vente',
      'Vendas':'Ventes','Orçamentos':'Devis','Produtos':'Produits','Avaliações':'Avis','Categorias':'Catégories',
      'Serviços':'Services','Tabelas de Preços':'Listes de prix','Carrinho':'Panier','Pedidos':'Commandes',
      'Pagamento':'Paiement','Rastreio':'Suivi','Estoque':'Stock','Produção':'Production','Ordens Produção':'Ordres de production',
      'Custos Produção':'Coûts de production','Qualidade':'Qualité','Planos Produção':'Plans de production',
      'Compras':'Achats','Clientes':'Clients','Fornecedores':'Fournisseurs','Transportadoras':'Transporteurs',
      'Pipeline':'Pipeline','Automação':'Automatisation','Marketing':'Marketing','Integrações API':'Intégrations API',
      'Conformidade':'Conformité','Licença e Pacotes':'Licence et forfaits','Despesas Gerais':'Dépenses générales',
      'Férias e Dispensas':'Congés et absences','Reuniões':'Réunions','Comunicação Interna':'Communication interne',
      'Aprovações':'Approbations','Departamentos':'Départements','Contabilidade':'Comptabilité','Financeiro':'Finance',
      'Fiscal AGT':'Fiscalité AGT','RH':'Ressources humaines','Recrutamento':'Recrutement','Desempenho':'Performance',
      'Benefícios':'Avantages','Projetos':'Projets','Ativos':'Actifs','Frota':'Flotte','Contratos':'Contrats',
      'Documentos':'Documents','Tickets':'Tickets','Relatórios':'Rapports','Relatórios de Gestão':'Rapports de gestion',
      'Notificações':'Notifications','Utilizadores':'Utilisateurs','Usuários':'Utilisateurs','Auditoria':'Audit',
      'Meu Perfil':'Mon profil','Idioma do Sistema':'Langue du système','Configurações':'Paramètres','Módulos':'Modules',
      'Gestão e Relatórios':'Gestion et rapports','Preferências':'Préférences','Idioma':'Langue',
      'Utilizadores e permissões':'Utilisateurs et autorisations','Membros da empresa':'Membres de l’entreprise',
      'Convites pendentes':'Invitations en attente','Convidar colaborador':'Inviter un collaborateur',
      'Não foi possível carregar a equipa':'Impossible de charger l’équipe','Ligação cloud necessária':'Connexion cloud requise',
      'Sem permissão':'Accès refusé','Nome':'Nom','Email':'E-mail','Perfil':'Rôle','Estado':'État','Ações':'Actions',
      'Guardar perfil':'Enregistrer le rôle','Permissões':'Autorisations','Suspender':'Suspendre','Reactivar':'Réactiver',
      'Activo':'Actif','Suspenso':'Suspendu','A aguardar activação':'En attente d’activation',
      'Não existem convites pendentes.':'Aucune invitation en attente.','Gerente':'Responsable','Operador':'Opérateur',
      'Caixa':'Caissier','Contabilista':'Comptable','Administrador':'Administrateur','Proprietário':'Propriétaire',
      'Data':'Date','Colaborador':'Collaborateur','Função':'Fonction','Acção':'Action','Módulo':'Module',
      'Detalhes':'Détails','Actualizar':'Actualiser','Imprimir':'Imprimer','Erro ao abrir o módulo':'Erreur lors de l’ouverture du module',
      'Tentar novamente':'Réessayer','Filtrar relatório de vendas':'Filtrer le rapport des ventes',
      'Período':'Période','Dia':'Jour','Mês':'Mois','Aplicar filtro':'Appliquer le filtre',
      'Relatório geral':'Rapport général','Faturamento':'Chiffre d’affaires','Ticket médio':'Panier moyen',
      'Produtos no catálogo':'Produits au catalogue','Clientes cadastrados':'Clients enregistrés',
      'Exportações adicionais':'Exports supplémentaires','Backup JSON':'Sauvegarde JSON','Vendas CSV':'Ventes CSV',
      'Produtos Excel':'Produits Excel','Total':'Total','Pagamento':'Paiement',
      'Ainda não existem registos de auditoria para apresentar.':'Aucun journal d’audit à afficher.',
      'Idioma guardado.':'Langue enregistrée.','Escolha o idioma da sua conta':'Choisissez la langue de votre compte',
      'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'La langue choisie sera appliquée automatiquement aux écrans et modules disponibles.'
    },
    es: {
      'Dashboard':'Panel principal','Abertura e Fecho de Caixa':'Apertura y cierre de caja','PDV':'Punto de venta',
      'Vendas':'Ventas','Orçamentos':'Presupuestos','Produtos':'Productos','Avaliações':'Reseñas','Categorias':'Categorías',
      'Serviços':'Servicios','Tabelas de Preços':'Listas de precios','Carrinho':'Carrito','Pedidos':'Pedidos',
      'Pagamento':'Pago','Rastreio':'Seguimiento','Estoque':'Inventario','Produção':'Producción',
      'Ordens Produção':'Órdenes de producción','Custos Produção':'Costes de producción','Qualidade':'Calidad',
      'Planos Produção':'Planes de producción','Compras':'Compras','Clientes':'Clientes','Fornecedores':'Proveedores',
      'Transportadoras':'Transportistas','Pipeline':'Embudo','Automação':'Automatización','Marketing':'Marketing',
      'Integrações API':'Integraciones API','Conformidade':'Cumplimiento','Licença e Pacotes':'Licencia y planes',
      'Despesas Gerais':'Gastos generales','Férias e Dispensas':'Vacaciones y permisos','Reuniões':'Reuniones',
      'Comunicação Interna':'Comunicación interna','Aprovações':'Aprobaciones','Departamentos':'Departamentos',
      'Contabilidade':'Contabilidad','Financeiro':'Finanzas','Fiscal AGT':'Fiscal AGT','RH':'Recursos humanos',
      'Recrutamento':'Contratación','Desempenho':'Rendimiento','Benefícios':'Beneficios','Projetos':'Proyectos',
      'Ativos':'Activos','Frota':'Flota','Contratos':'Contratos','Documentos':'Documentos','Tickets':'Tickets',
      'Relatórios':'Informes','Relatórios de Gestão':'Informes de gestión','Notificações':'Notificaciones',
      'Utilizadores':'Usuarios','Usuários':'Usuarios','Auditoria':'Auditoría','Meu Perfil':'Mi perfil',
      'Idioma do Sistema':'Idioma del sistema','Configurações':'Configuración','Módulos':'Módulos',
      'Gestão e Relatórios':'Gestión e informes','Preferências':'Preferencias','Idioma':'Idioma',
      'Utilizadores e permissões':'Usuarios y permisos','Membros da empresa':'Miembros de la empresa',
      'Convites pendentes':'Invitaciones pendientes','Convidar colaborador':'Invitar colaborador',
      'Não foi possível carregar a equipa':'No se pudo cargar el equipo','Ligação cloud necessária':'Se requiere conexión cloud',
      'Sem permissão':'Sin permiso','Nome':'Nombre','Email':'Correo electrónico','Perfil':'Rol','Estado':'Estado',
      'Ações':'Acciones','Guardar perfil':'Guardar rol','Permissões':'Permisos','Suspender':'Suspender',
      'Reactivar':'Reactivar','Activo':'Activo','Suspenso':'Suspendido','A aguardar activação':'Pendiente de activación',
      'Não existem convites pendentes.':'No hay invitaciones pendientes.','Gerente':'Gerente','Operador':'Operador',
      'Caixa':'Cajero','Contabilista':'Contable','Administrador':'Administrador','Proprietário':'Propietario',
      'Data':'Fecha','Colaborador':'Colaborador','Função':'Función','Acção':'Acción','Módulo':'Módulo',
      'Detalhes':'Detalles','Actualizar':'Actualizar','Imprimir':'Imprimir','Erro ao abrir o módulo':'Error al abrir el módulo',
      'Tentar novamente':'Intentar de nuevo','Filtrar relatório de vendas':'Filtrar informe de ventas',
      'Período':'Periodo','Dia':'Día','Mês':'Mes','Aplicar filtro':'Aplicar filtro','Relatório geral':'Informe general',
      'Faturamento':'Facturación','Ticket médio':'Ticket medio','Produtos no catálogo':'Productos en catálogo',
      'Clientes cadastrados':'Clientes registrados','Exportações adicionais':'Exportaciones adicionales',
      'Backup JSON':'Copia JSON','Vendas CSV':'Ventas CSV','Produtos Excel':'Productos Excel','Total':'Total',
      'Pagamento':'Pago','Ainda não existem registos de auditoria para apresentar.':'Todavía no hay registros de auditoría.',
      'Idioma guardado.':'Idioma guardado.','Escolha o idioma da sua conta':'Elija el idioma de su cuenta',
      'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'El idioma elegido se aplicará automáticamente a las pantallas y módulos disponibles.'
    },
    zh: {
      'Dashboard':'仪表板','Abertura e Fecho de Caixa':'收银开班与结班','PDV':'销售终端','Vendas':'销售',
      'Orçamentos':'报价','Produtos':'产品','Avaliações':'评价','Categorias':'类别','Serviços':'服务',
      'Tabelas de Preços':'价格表','Carrinho':'购物车','Pedidos':'订单','Pagamento':'付款','Rastreio':'物流跟踪',
      'Estoque':'库存','Produção':'生产','Ordens Produção':'生产订单','Custos Produção':'生产成本',
      'Qualidade':'质量','Planos Produção':'生产计划','Compras':'采购','Clientes':'客户','Fornecedores':'供应商',
      'Transportadoras':'承运商','Pipeline':'销售管道','Automação':'自动化','Marketing':'市场营销',
      'Integrações API':'API 集成','Conformidade':'合规','Licença e Pacotes':'许可证与套餐',
      'Despesas Gerais':'一般费用','Férias e Dispensas':'休假与请假','Reuniões':'会议','Comunicação Interna':'内部沟通',
      'Aprovações':'审批','Departamentos':'部门','Contabilidade':'会计','Financeiro':'财务','Fiscal AGT':'AGT 税务',
      'RH':'人力资源','Recrutamento':'招聘','Desempenho':'绩效','Benefícios':'福利','Projetos':'项目',
      'Ativos':'资产','Frota':'车队','Contratos':'合同','Documentos':'文件','Tickets':'工单',
      'Relatórios':'报表','Relatórios de Gestão':'管理报表','Notificações':'通知','Utilizadores':'用户',
      'Usuários':'用户','Auditoria':'审计日志','Meu Perfil':'我的资料','Idioma do Sistema':'系统语言',
      'Configurações':'设置','Módulos':'模块','Gestão e Relatórios':'管理与报表','Preferências':'偏好设置',
      'Idioma':'语言','Utilizadores e permissões':'用户与权限','Membros da empresa':'企业成员',
      'Convites pendentes':'待处理邀请','Convidar colaborador':'邀请员工','Não foi possível carregar a equipa':'无法加载团队',
      'Ligação cloud necessária':'需要云连接','Sem permissão':'无权限','Nome':'姓名','Email':'电子邮件',
      'Perfil':'角色','Estado':'状态','Ações':'操作','Guardar perfil':'保存角色','Permissões':'权限',
      'Suspender':'停用','Reactivar':'重新启用','Activo':'启用','Suspenso':'已停用',
      'A aguardar activação':'等待激活','Não existem convites pendentes.':'没有待处理的邀请。',
      'Gerente':'经理','Operador':'操作员','Caixa':'收银员','Contabilista':'会计师',
      'Administrador':'管理员','Proprietário':'所有者','Data':'日期','Colaborador':'员工',
      'Função':'职务','Acção':'操作','Módulo':'模块','Detalhes':'详情','Actualizar':'刷新','Imprimir':'打印',
      'Erro ao abrir o módulo':'打开模块时出错','Tentar novamente':'重试','Filtrar relatório de vendas':'筛选销售报表',
      'Período':'期间','Dia':'日','Mês':'月','Aplicar filtro':'应用筛选','Relatório geral':'总报表',
      'Faturamento':'营业额','Ticket médio':'平均客单价','Produtos no catálogo':'目录中的产品',
      'Clientes cadastrados':'已登记客户','Exportações adicionais':'其他导出','Backup JSON':'JSON 备份',
      'Vendas CSV':'销售 CSV','Produtos Excel':'产品 Excel','Total':'总计','Pagamento':'付款',
      'Ainda não existem registos de auditoria para apresentar.':'暂无审计记录。',
      'Idioma guardado.':'语言已保存。','Escolha o idioma da sua conta':'选择您的账户语言',
      'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'所选语言将自动应用于可用页面和模块。'
    },
    ar: {
      'Dashboard':'لوحة التحكم','Abertura e Fecho de Caixa':'فتح وإغلاق الصندوق','PDV':'نقطة البيع','Vendas':'المبيعات',
      'Orçamentos':'عروض الأسعار','Produtos':'المنتجات','Avaliações':'التقييمات','Categorias':'الفئات',
      'Serviços':'الخدمات','Tabelas de Preços':'قوائم الأسعار','Carrinho':'سلة التسوق','Pedidos':'الطلبات',
      'Pagamento':'الدفع','Rastreio':'التتبع','Estoque':'المخزون','Produção':'الإنتاج',
      'Ordens Produção':'أوامر الإنتاج','Custos Produção':'تكاليف الإنتاج','Qualidade':'الجودة',
      'Planos Produção':'خطط الإنتاج','Compras':'المشتريات','Clientes':'العملاء','Fornecedores':'الموردون',
      'Transportadoras':'شركات النقل','Pipeline':'مسار المبيعات','Automação':'الأتمتة','Marketing':'التسويق',
      'Integrações API':'تكاملات API','Conformidade':'الامتثال','Licença e Pacotes':'الترخيص والباقات',
      'Despesas Gerais':'المصروفات العامة','Férias e Dispensas':'الإجازات والغياب','Reuniões':'الاجتماعات',
      'Comunicação Interna':'الاتصال الداخلي','Aprovações':'الموافقات','Departamentos':'الأقسام',
      'Contabilidade':'المحاسبة','Financeiro':'المالية','Fiscal AGT':'ضرائب AGT','RH':'الموارد البشرية',
      'Recrutamento':'التوظيف','Desempenho':'الأداء','Benefícios':'المزايا','Projetos':'المشاريع',
      'Ativos':'الأصول','Frota':'الأسطول','Contratos':'العقود','Documentos':'المستندات','Tickets':'التذاكر',
      'Relatórios':'التقارير','Relatórios de Gestão':'تقارير الإدارة','Notificações':'الإشعارات',
      'Utilizadores':'المستخدمون','Usuários':'المستخدمون','Auditoria':'سجل التدقيق','Meu Perfil':'ملفي الشخصي',
      'Idioma do Sistema':'لغة النظام','Configurações':'الإعدادات','Módulos':'الوحدات',
      'Gestão e Relatórios':'الإدارة والتقارير','Preferências':'التفضيلات','Idioma':'اللغة',
      'Utilizadores e permissões':'المستخدمون والصلاحيات','Membros da empresa':'أعضاء الشركة',
      'Convites pendentes':'الدعوات المعلقة','Convidar colaborador':'دعوة موظف',
      'Não foi possível carregar a equipa':'تعذر تحميل الفريق','Ligação cloud necessária':'يلزم الاتصال بالسحابة',
      'Sem permissão':'لا توجد صلاحية','Nome':'الاسم','Email':'البريد الإلكتروني','Perfil':'الدور',
      'Estado':'الحالة','Ações':'الإجراءات','Guardar perfil':'حفظ الدور','Permissões':'الصلاحيات',
      'Suspender':'تعليق','Reactivar':'إعادة تفعيل','Activo':'نشط','Suspenso':'معلق',
      'A aguardar activação':'بانتظار التفعيل','Não existem convites pendentes.':'لا توجد دعوات معلقة.',
      'Gerente':'مدير','Operador':'مشغل','Caixa':'أمين صندوق','Contabilista':'محاسب',
      'Administrador':'مسؤول','Proprietário':'مالك','Data':'التاريخ','Colaborador':'الموظف',
      'Função':'الوظيفة','Acção':'الإجراء','Módulo':'الوحدة','Detalhes':'التفاصيل','Actualizar':'تحديث',
      'Imprimir':'طباعة','Erro ao abrir o módulo':'حدث خطأ أثناء فتح الوحدة','Tentar novamente':'إعادة المحاولة',
      'Filtrar relatório de vendas':'تصفية تقرير المبيعات','Período':'الفترة','Dia':'اليوم','Mês':'الشهر',
      'Aplicar filtro':'تطبيق التصفية','Relatório geral':'التقرير العام','Faturamento':'الإيرادات',
      'Ticket médio':'متوسط قيمة البيع','Produtos no catálogo':'المنتجات في الكتالوج',
      'Clientes cadastrados':'العملاء المسجلون','Exportações adicionais':'عمليات تصدير إضافية',
      'Backup JSON':'نسخة JSON احتياطية','Vendas CSV':'مبيعات CSV','Produtos Excel':'منتجات Excel',
      'Total':'الإجمالي','Pagamento':'الدفع','Ainda não existem registos de auditoria para apresentar.':'لا توجد سجلات تدقيق لعرضها.',
      'Idioma guardado.':'تم حفظ اللغة.','Escolha o idioma da sua conta':'اختر لغة حسابك',
      'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'سيتم تطبيق اللغة المختارة تلقائياً على الشاشات والوحدات المتاحة.'
    }
  };

  let locale = 'pt';
  let observer = null;
  let preferenceLoaded = false;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  function translate(value) {
    const dictionary = catalogs[locale] || {};
    return dictionary[value] || value;
  }

  function translateTextNode(node) {
    if (!node || !node.parentElement) return;
    const tag = node.parentElement.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE' || tag === 'TEXTAREA') return;
    const source = originalText.has(node) ? originalText.get(node) : node.nodeValue;
    if (!source || !source.trim()) return;
    if (!originalText.has(node)) originalText.set(node, source);
    const trimmed = source.trim();
    const translated = translate(trimmed);
    const next = source.replace(trimmed, translated);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttributes(root) {
    const attributes = ['placeholder', 'title', 'aria-label'];
    const elements = [];
    if (root && root.nodeType === 1) elements.push(root);
    if (root && root.querySelectorAll) elements.push.apply(elements, root.querySelectorAll('*'));
    elements.forEach(function (element) {
      let saved = originalAttributes.get(element);
      if (!saved) {
        saved = {};
        originalAttributes.set(element, saved);
      }
      attributes.forEach(function (name) {
        if (!element.hasAttribute(name)) return;
        const current = element.getAttribute(name);
        if (saved[name] === undefined || current !== translate(saved[name])) saved[name] = current;
        const next = translate(saved[name]);
        if (current !== next) element.setAttribute(name, next);
      });
    });
  }

  function translateTree(root) {
    if (!root || typeof document === 'undefined') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
    translateAttributes(root);
  }

  function setLanguage(nextLocale, options) {
    options = options || {};
    if (!SUPPORTED.includes(nextLocale)) return false;
    locale = nextLocale;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = HTML_LOCALES[locale];
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-language', locale);
      if (document.body) translateTree(document.body);
      const selector = document.getElementById('kanawaLanguageSelect');
      if (selector) selector.value = locale;
    }
    try { localStorage.setItem('kanawa_language_v1', locale); } catch (_) {}
    if (options.persist !== false && window.KanawaCloud && KanawaCloud.ready &&
        typeof KanawaCloud.updatePreferredLanguage === 'function') {
      KanawaCloud.updatePreferredLanguage(locale).catch(function (error) {
        console.warn('A preferência de idioma ficou guardada neste dispositivo; sincronização cloud pendente:', error);
      });
    }
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('kanawa:language-change', { detail: { locale: locale } }));
    }
    return true;
  }

  async function loadPreference() {
    if (preferenceLoaded) return locale;
    let local = null;
    try { local = localStorage.getItem('kanawa_language_v1'); } catch (_) {}
    if (SUPPORTED.includes(local)) setLanguage(local, { persist: false });
    if (window.KanawaCloud && KanawaCloud.ready && typeof KanawaCloud.getPreferredLanguage === 'function') {
      try {
        const remote = await KanawaCloud.getPreferredLanguage();
        if (SUPPORTED.includes(remote)) setLanguage(remote, { persist: false });
      } catch (error) {
        console.warn('Não foi possível carregar a preferência de idioma da conta:', error);
      }
    }
    preferenceLoaded = true;
    return locale;
  }

  function renderLanguageSettings() {
    const options = SUPPORTED.map(function (code) {
      return '<option value="' + code + '"' + (code === locale ? ' selected' : '') + '>' +
        LANGUAGE_NAMES[code] + '</option>';
    }).join('');
    return '<section class="card ks-language-settings" aria-labelledby="ksLanguageHeading">' +
      '<div class="card-header"><h3 class="card-title" id="ksLanguageHeading"><i class="fas fa-language"></i> Idioma do Sistema</h3></div>' +
      '<div class="form-group"><label for="kanawaLanguageSelect">Escolha o idioma da sua conta</label>' +
      '<select id="kanawaLanguageSelect" class="form-control" onchange="KanawaI18n.setLanguage(this.value)">' + options + '</select></div>' +
      '<p class="text-muted">O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.</p>' +
      '<p class="text-muted">Português · English · Français · Español · 中文（普通话） · العربية</p>' +
      '</section>';
  }

  function start() {
    let saved = 'pt';
    try { saved = localStorage.getItem('kanawa_language_v1') || 'pt'; } catch (_) {}
    setLanguage(SUPPORTED.includes(saved) ? saved : 'pt', { persist: false });
    if (document.body && typeof MutationObserver === 'function') {
      observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          if (record.type === 'childList') {
            record.addedNodes.forEach(function (node) {
              if (node.nodeType === 1) translateTree(node);
              else if (node.nodeType === 3) translateTextNode(node);
            });
          } else if (record.type === 'characterData') {
            const node = record.target;
            if (originalText.has(node)) {
              const source = originalText.get(node);
              const expected = source.replace(source.trim(), translate(source.trim()));
              if (node.nodeValue !== expected) originalText.set(node, node.nodeValue);
            }
            translateTextNode(node);
          } else if (record.type === 'attributes') {
            translateAttributes(record.target);
          }
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'aria-label']
      });
      translateTree(document.body);
    }
    const style = document.createElement('style');
    style.id = 'kanawa-i18n-rtl';
    style.textContent = 'html[dir="rtl"] body{direction:rtl;text-align:right}html[dir="rtl"] input,html[dir="rtl"] select,html[dir="rtl"] textarea{direction:rtl;text-align:right}html[dir="rtl"] .sidebar,html[dir="rtl"] .topbar,html[dir="rtl"] .card{direction:rtl}';
    document.head.appendChild(style);
  }

  window.KanawaI18n = {
    supported: SUPPORTED.slice(),
    languageNames: Object.assign({}, LANGUAGE_NAMES),
    getLanguage: function () { return locale; },
    setLanguage: setLanguage,
    loadPreference: loadPreference,
    renderLanguageSettings: renderLanguageSettings,
    translate: translate,
    translateTree: translateTree,
    isPreferenceLoaded: function () { return preferenceLoaded; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();