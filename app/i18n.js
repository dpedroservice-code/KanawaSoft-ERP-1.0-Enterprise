(function () {
  'use strict';

  const SUPPORTED = ['pt', 'en', 'fr', 'es', 'zh', 'ar', 'ln', 'cjk'];
  const LANGUAGE_NAMES = {
    pt: 'Português', en: 'English', fr: 'Français', es: 'Español', zh: '中文（普通话）',
    ar: 'العربية', ln: 'Lingála', cjk: 'Cokwe (Chokwe)'
  };
  const HTML_LOCALES = { pt: 'pt-AO', en: 'en', fr: 'fr', es: 'es', zh: 'zh-CN', ar: 'ar', ln: 'ln', cjk: 'cjk' };

  const catalogs = {
    en: {
      'Dashboard':'Dashboard','Abertura e Fecho de Caixa':'Cash Opening and Closing','PDV':'POS','Vendas':'Sales',
      'Orçamentos':'Quotes','Produtos':'Products','Avaliações':'Reviews','Categorias':'Categories','Serviços':'Services',
      'Tabelas de Preços':'Price Lists','E-commerce':'E-commerce','Gestão E-commerce':'E-commerce Management','Vitrine E-commerce':'E-commerce Storefront','Produtos E-commerce':'E-commerce Products','Vendas Consignadas':'Consignment Sales','Promoções de Vendas':'Sales Promotions','Carrinho':'Cart','Pedidos':'Orders','Pagamento':'Payment',
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
      'Serviços':'Services','Tabelas de Preços':'Listes de prix','Carrinho':'Panier','Gestão E-commerce':'Gestion e-commerce','Vitrine E-commerce':'Vitrine e-commerce','Produtos E-commerce':'Produits e-commerce','Vendas Consignadas':'Ventes en consignation','Promoções de Vendas':'Promotions commerciales','Pedidos':'Commandes',
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
      'Serviços':'Servicios','Tabelas de Preços':'Listas de precios','Carrinho':'Carrito','Gestão E-commerce':'Gestión de comercio electrónico','Vitrine E-commerce':'Escaparate de comercio electrónico','Produtos E-commerce':'Productos de comercio electrónico','Vendas Consignadas':'Ventas en consignación','Promoções de Vendas':'Promociones de ventas','Pedidos':'Pedidos',
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
      'Tabelas de Preços':'价格表','Carrinho':'购物车','Gestão E-commerce':'电子商务管理','Vitrine E-commerce':'电商店铺','Produtos E-commerce':'电商产品','Vendas Consignadas':'寄售销售','Promoções de Vendas':'销售促销','Pedidos':'订单','Pagamento':'付款','Rastreio':'物流跟踪',
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
      'Serviços':'الخدمات','Tabelas de Preços':'قوائم الأسعار','Carrinho':'سلة التسوق','Gestão E-commerce':'إدارة التجارة الإلكترونية','Vitrine E-commerce':'واجهة المتجر الإلكتروني','Produtos E-commerce':'منتجات التجارة الإلكترونية','Vendas Consignadas':'مبيعات الأمانة','Promoções de Vendas':'عروض المبيعات','Pedidos':'الطلبات',
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
    },
    ln: {
      'Dashboard':'Etando ya mosala','Abertura e Fecho de Caixa':'Kofungola mpe kokanga caisse','PDV':'Esika ya koteka',
      'Vendas':'Koteka','Orçamentos':'Mabongisi ya ntalo','Produtos':'Biloko','Categorias':'Biteni',
      'Serviços':'Misala','Carrinho':'Kitunga','Gestão E-commerce':'Boyangeli ya mombongo na internet',
      'Vitrine E-commerce':'Eloko ya kolakisa biloko na internet','Produtos E-commerce':'Biloko ya mombongo na internet',
      'Vendas Consignadas':'Koteka biloko na mokili ya mosusu','Promoções de Vendas':'Bakitisi ya ntalo',
      'Pedidos':'Mitindo','Pagamento':'Kofuta','Estoque':'Biloko oyo etikali','Compras':'Kosomba',
      'Clientes':'Bakiliya','Fornecedores':'Bapesi biloko','Financeiro':'Mbongo','Contabilidade':'Botangi ya mbongo',
      'Relatórios':'Mikanda ya botali','Relatórios de Gestão':'Mikanda ya boyangeli','Notificações':'Bansango',
      'Utilizadores':'Bato oyo basalelaka','Usuários':'Bato oyo basalelaka','Auditoria':'Botali ya misala',
      'Meu Perfil':'Profil na ngai','Idioma do Sistema':'Lokota ya système','Configurações':'Bobongisi',
      'Módulos':'Biteni ya système','Gestão e Relatórios':'Boyangeli mpe mikanda','Preferências':'Makambo oyo olingi',
      'Idioma':'Lokota','Utilizadores e permissões':'Bato mpe ndingisa','Membros da empresa':'Bato ya kompanyi',
      'Convidar colaborador':'Kobenga mosali','Não foi possível carregar a equipa':'Tokoki te komema lisanga',
      'Ligação cloud necessária':'Esengeli kozala na boyokani ya cloud','Sem permissão':'Ozali na ndingisa te',
      'Nome':'Nkombo','Email':'Email','Perfil':'Mosala','Estado':'Ezaleli','Ações':'Misala',
      'Guardar perfil':'Kobomba profil','Permissões':'Ndingisa','Suspender':'Kopekisa mpo na mwa ntango',
      'Reactivar':'Kozongisa kosalela','Activo':'Azali kosalela','Suspenso':'Apekisami',
      'A aguardar activação':'Azali kozela kofungwama','Gerente':'Mokambi','Operador':'Mosali',
      'Caixa':'Mokambi ya caisse','Contabilista':'Motaleli ya mbongo','Administrador':'Mokambi monene',
      'Proprietário':'Nkolo','Data':'Mokolo','Colaborador':'Mosali','Função':'Mosala','Acção':'Likambo',
      'Módulo':'Eteni','Detalhes':'Makambo nyonso','Actualizar':'Kobongisa lisusu','Imprimir':'Kobimisa na imprimante',
      'Erro ao abrir o módulo':'Libunga na kofungola eteni','Tentar novamente':'Meka lisusu',
      'Filtrar relatório de vendas':'Kopona mikanda ya koteka','Período':'Eleko','Dia':'Mokolo','Mês':'Sanza',
      'Aplicar filtro':'Kosalela kopona','Relatório geral':'Mokanda ya mobimba','Faturamento':'Mbongo oyo ekoti',
      'Ticket médio':'Mbongo ya mwayene','Produtos no catálogo':'Biloko na liste',
      'Clientes cadastrados':'Bakiliya oyo bakomami','Total':'Nyonso','Idioma guardado.':'Lokota ebombami.',
      'Escolha o idioma da sua conta':'Pona lokota ya compte na yo',
      'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'Lokota oyo oponi ekosalelama na ba écran mpe biteni oyo ezali.'
    },
    cjk: {
      'Dashboard':'Cisalo ca mulimo','Vendas':'Kulandjisa','Produtos':'Mungoso','Serviços':'Mulimo',
      'Estoque':'Mungoso uhana','Compras':'Kulanda','Pagamento':'Kufuta','Gestão E-commerce':'Kuhangula mungoso wa internet',
      'Produtos E-commerce':'Mungoso wa internet','Vendas Consignadas':'Kulandjisa mungoso wa kulomba',
      'Promoções de Vendas':'Kuhungula muxinga wa mungoso','Pedidos':'Kulomba','Clientes':'Alandji',
      'Fornecedores':'Akwanji a mungoso','Financeiro':'Mungoso wa mbongo','Relatórios':'Mikanda ya mulimo',
      'Relatórios de Gestão':'Mikanda ya kuhangula','Notificações':'Kuhanjika','Meu Perfil':'Cisamo cange',
      'Idioma do Sistema':'Ndaka ya sistema','Idioma':'Ndaka','Nome':'Dijina','Email':'Email',
      'Data':'Ditango','Colaborador':'Musali','Função':'Mulimo','Imprimir':'Kusoneka',
      'Idioma guardado.':'Ndaka yakwata.','Escolha o idioma da sua conta':'Sakula ndaka ya cisamo cako',
      'Não foi possível carregar a equipa':'Kuhana kukwata akwetu'
    }
  };


  // Common labels used by operational modules and generated forms. Keep source
  // Portuguese as the fallback where a reviewed translation is not available.
  Object.assign(catalogs.en, {
    'Ações':'Actions','Código':'Code','Descrição':'Description','Preço':'Price','Quantidade':'Quantity',
    'Subtotal':'Subtotal','Cliente':'Customer','Fornecedor':'Supplier','Funcionário':'Employee',
    'Crédito':'Credit','Débito':'Debit','Responsável':'Responsible','Veículo':'Vehicle',
    'Província':'Province','Município':'Municipality','Diário':'Daily','Classificação':'Classification',
    'Histórico':'History','Referência':'Reference','Visão geral':'Overview','Guardar':'Save',
    'Pesquisar':'Search','Filtrar':'Filter','Exportar':'Export','Cancelar':'Cancel',
    'Concluída':'Completed','Manutenção':'Maintenance','Distância':'Distance','Início':'Start',
    'Próxima':'Next','Situação':'Condition','Última Atualização':'Last Updated',
    'Relatório gerado':'Report generated','Código de barras':'Barcode','Condição de pagamento':'Payment Terms',
    'Limite de crédito':'Credit Limit','Não definido':'Not set','Membro não encontrado.':'Member not found.',
    'Não foi possível enviar o pedido.':'Could not send the request.'
  });
  Object.assign(catalogs.fr, {
    'Ações':'Actions','Código':'Code','Descrição':'Description','Preço':'Prix','Quantidade':'Quantité',
    'Subtotal':'Sous-total','Cliente':'Client','Fornecedor':'Fournisseur','Funcionário':'Employé',
    'Crédito':'Crédit','Débito':'Débit','Responsável':'Responsable','Veículo':'Véhicule',
    'Província':'Province','Município':'Municipalité','Diário':'Quotidien','Classificação':'Classification',
    'Histórico':'Historique','Referência':'Référence','Visão geral':'Vue d’ensemble','Guardar':'Enregistrer',
    'Pesquisar':'Rechercher','Filtrar':'Filtrer','Exportar':'Exporter','Cancelar':'Annuler',
    'Concluída':'Terminée','Manutenção':'Maintenance','Distância':'Distance','Início':'Début',
    'Próxima':'Suivante','Situação':'Situation','Última Atualização':'Dernière mise à jour',
    'Relatório gerado':'Rapport généré','Código de barras':'Code-barres','Condição de pagamento':'Conditions de paiement',
    'Limite de crédito':'Limite de crédit','Não definido':'Non défini','Membro não encontrado.':'Membre introuvable.',
    'Não foi possível enviar o pedido.':'Impossible d’envoyer la demande.'
  });
  Object.assign(catalogs.es, {
    'Ações':'Acciones','Código':'Código','Descrição':'Descripción','Preço':'Precio','Quantidade':'Cantidad',
    'Subtotal':'Subtotal','Cliente':'Cliente','Fornecedor':'Proveedor','Funcionário':'Empleado',
    'Crédito':'Crédito','Débito':'Débito','Responsável':'Responsable','Veículo':'Vehículo',
    'Província':'Provincia','Município':'Municipio','Diário':'Diario','Classificação':'Clasificación',
    'Histórico':'Historial','Referência':'Referencia','Visão geral':'Vista general','Guardar':'Guardar',
    'Pesquisar':'Buscar','Filtrar':'Filtrar','Exportar':'Exportar','Cancelar':'Cancelar',
    'Concluída':'Completada','Manutenção':'Mantenimiento','Distância':'Distancia','Início':'Inicio',
    'Próxima':'Siguiente','Situação':'Situación','Última Atualização':'Última actualización',
    'Relatório gerado':'Informe generado','Código de barras':'Código de barras','Condição de pagamento':'Condiciones de pago',
    'Limite de crédito':'Límite de crédito','Não definido':'No definido','Membro não encontrado.':'No se encontró el miembro.',
    'Não foi possível enviar o pedido.':'No se pudo enviar la solicitud.'
  });
  Object.assign(catalogs.zh, {
    'Ações':'操作','Código':'代码','Descrição':'描述','Preço':'价格','Quantidade':'数量',
    'Subtotal':'小计','Cliente':'客户','Fornecedor':'供应商','Funcionário':'员工',
    'Crédito':'贷方','Débito':'借方','Responsável':'负责人','Veículo':'车辆',
    'Província':'省','Município':'市镇','Diário':'每日','Classificação':'分类',
    'Histórico':'历史记录','Referência':'参考编号','Visão geral':'概览','Guardar':'保存',
    'Pesquisar':'搜索','Filtrar':'筛选','Exportar':'导出','Cancelar':'取消',
    'Concluída':'已完成','Manutenção':'维护','Distância':'距离','Início':'开始',
    'Próxima':'下一项','Situação':'情况','Última Atualização':'最后更新',
    'Relatório gerado':'报表已生成','Código de barras':'条形码','Condição de pagamento':'付款条件',
    'Limite de crédito':'信用额度','Não definido':'未设置','Membro não encontrado.':'未找到成员。',
    'Não foi possível enviar o pedido.':'无法发送请求。'
  });
  Object.assign(catalogs.ar, {
    'Ações':'الإجراءات','Código':'الرمز','Descrição':'الوصف','Preço':'السعر','Quantidade':'الكمية',
    'Subtotal':'المجموع الفرعي','Cliente':'العميل','Fornecedor':'المورد','Funcionário':'الموظف',
    'Crédito':'دائن','Débito':'مدين','Responsável':'المسؤول','Veículo':'المركبة',
    'Província':'المقاطعة','Município':'البلدية','Diário':'يومي','Classificação':'التصنيف',
    'Histórico':'السجل','Referência':'المرجع','Visão geral':'نظرة عامة','Guardar':'حفظ',
    'Pesquisar':'بحث','Filtrar':'تصفية','Exportar':'تصدير','Cancelar':'إلغاء',
    'Concluída':'مكتملة','Manutenção':'الصيانة','Distância':'المسافة','Início':'البداية',
    'Próxima':'التالي','Situação':'الوضع','Última Atualização':'آخر تحديث',
    'Relatório gerado':'تم إنشاء التقرير','Código de barras':'الرمز الشريطي','Condição de pagamento':'شروط الدفع',
    'Limite de crédito':'حد الائتمان','Não definido':'غير محدد','Membro não encontrado.':'لم يتم العثور على العضو.',
    'Não foi possível enviar o pedido.':'تعذر إرسال الطلب.'
  });
  Object.assign(catalogs.ln, {
    'Ações':'Misala','Código':'Code','Descrição':'Ndimbola','Preço':'Ntalo',
    'Quantidade':'Motango','Cliente':'Klienta','Fornecedor':'Mopesi biloko',
    'Crédito':'Kredí','Débito':'Débí','Histórico':'Lisolo ya makambo',
    'Início':'Ebandeli','Guardar':'Kobomba'
  });


  // Public landing, account onboarding and global settings copy.
  Object.assign(catalogs.en, {
    'Facturas e operações ilimitadas':'Unlimited invoices and operations','por mês · valor proposto':'per month · proposed price',
    'Preço inicial proposto, sujeito a aprovação comercial.':'Proposed starting price, subject to commercial approval.',
    'Próximo':'Next','Apresentação e pacotes Kanawa Soft':'Kanawa Soft overview and plans',
    'Já tenho conta · Entrar':'I already have an account · Sign in','Gestão empresarial numa só plataforma':'Business management on one platform',
    'Da primeira factura à':'From the first invoice to','Finanças':'Finance','Separação por empresa e permissões.':'Company separation and permissions.',
    'Acesso em vários dispositivos.':'Access on multiple devices.','Integrações':'Integrations',
    'Operação comercial e financeira':'Commercial and financial operations','Gestão de clientes e stock':'Customer and inventory management',
    'Agenda, documentos e relatórios':'Calendar, documents and reports','Multi-filial e operações avançadas':'Multi-branch and advanced operations',
    'Produção, qualidade e integrações':'Production, quality and integrations','Indústria, fábricas e multi-empresa':'Industry, factories and multi-company',
    'Configuração empresarial e apoio de implementação':'Business setup and implementation support',
    'Limites e preço final definidos em contrato.':'Limits and final price defined by contract.',
    'Experimente durante 14 dias. Sem inserir dados de cartão para iniciar o teste.':'Try it for 14 days. No card details are required to start the trial.',
    'Começar teste gratuito':'Start free trial','Duração da licença':'License duration','1 mês':'1 month',
    'Transferência bancária (validação manual)':'Bank transfer (manual validation)',
    'Multicaixa Express (validação manual; API automática ainda não ligada)':'Multicaixa Express (manual validation; automatic API not yet connected)',
    'USD - Dólar':'USD - US Dollar','Endereço':'Address','Sociedade Anónima':'Public Limited Company',
    'Data de constituição':'Date of incorporation','N.º matrícula / registo comercial':'Commercial registration number',
    'Número da Conservatória':'Registry office number','Conservatória / entidade de registo':'Registry office / registration authority',
    'Data da certidão comercial':'Commercial certificate date','Validade da certidão (se indicada)':'Certificate expiry date (if stated)',
    'N.º da publicação online GUE':'GUE online publication number','Referência da publicação':'Publication reference',
    'Data da publicação GUE':'GUE publication date','Link da publicação online GUE':'GUE online publication link',
    'Código de actividade (CAE/sector)':'Business activity code (CAE/sector)','Descrição da actividade principal':'Main business activity description',
    'N.º do alvará/licença':'Permit/license number','Tipo de alvará/licença':'Permit/license type',
    'Comercial, serviços, industrial…':'Commercial, services, industrial…','Data de emissão do alvará':'Permit issue date',
    'Validade do alvará':'Permit expiry date','N.º de inscrição INSS empregador':'Employer INSS registration number',
    'Proprietário da empresa e primeiro utilizador do sistema':'Company owner and first system user',
    'Documento de identificação do proprietário / representante':'Identification document of the owner / representative',
    'Número do BI ou passaporte':'ID card or passport number','NIF do proprietário (se aplicável)':'Owner tax ID (if applicable)',
    'Confirmação':'Confirmation','SMS / Telemóvel':'SMS / Mobile phone',
    'Entrar com código de confirmação de 6 dígitos':'Sign in with a 6-digit verification code',
    'Código de acesso (6 dígitos)':'Access code (6 digits)',
    'Enviámos um código de utilização única para o seu email. Consulte também a pasta de spam.':'We sent a one-time code to your email. Also check your spam folder.',
    'Reenviar código':'Resend code','Já recebeu uma chave de licença?':'Have you received a license key?',
    'Chave de licença':'License key','Código de convite':'Invitation code','Criar senha (mínimo 8 caracteres)':'Create password (at least 8 characters)',
    'Abrir visão geral':'Open overview','VISÃO GERAL':'OVERVIEW','Pesquisar módulos...':'Search modules...',
    'Notificações':'Notifications','Aponte a câmera para o código':'Point the camera at the code',
    'Idioma do Sistema':'System Language','Escolha o idioma da sua conta':'Choose your account language',
    'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'Your selected language will be applied automatically to available screens and modules.'
  });
  Object.assign(catalogs.fr, {
    'Facturas e operações ilimitadas':'Factures et opérations illimitées','por mês · valor proposto':'par mois · prix proposé',
    'Preço inicial proposto, sujeito a aprovação comercial.':'Prix de départ proposé, sous réserve d’approbation commerciale.',
    'Próximo':'Suivant','Apresentação e pacotes Kanawa Soft':'Présentation et forfaits Kanawa Soft',
    'Já tenho conta · Entrar':'J’ai déjà un compte · Se connecter','Gestão empresarial numa só plataforma':'Gestion d’entreprise sur une seule plateforme',
    'Da primeira factura à':'De la première facture à','Finanças':'Finance','Separação por empresa e permissões.':'Séparation par entreprise et permissions.',
    'Acesso em vários dispositivos.':'Accès sur plusieurs appareils.','Integrações':'Intégrations',
    'Operação comercial e financeira':'Opérations commerciales et financières','Gestão de clientes e stock':'Gestion des clients et des stocks',
    'Agenda, documentos e relatórios':'Agenda, documents et rapports','Multi-filial e operações avançadas':'Multi-succursales et opérations avancées',
    'Produção, qualidade e integrações':'Production, qualité et intégrations','Indústria, fábricas e multi-empresa':'Industrie, usines et multi-entreprises',
    'Configuração empresarial e apoio de implementação':'Configuration de l’entreprise et assistance à la mise en œuvre',
    'Limites e preço final definidos em contrato.':'Limites et prix final définis dans le contrat.',
    'Experimente durante 14 dias. Sem inserir dados de cartão para iniciar o teste.':'Essayez pendant 14 jours. Aucune carte bancaire n’est requise pour commencer l’essai.',
    'Começar teste gratuito':'Commencer l’essai gratuit','Duração da licença':'Durée de la licence','1 mês':'1 mois',
    'Transferência bancária (validação manual)':'Virement bancaire (validation manuelle)',
    'Multicaixa Express (validação manual; API automática ainda não ligada)':'Multicaixa Express (validation manuelle ; API automatique non connectée)',
    'USD - Dólar':'USD - Dollar américain','Endereço':'Adresse','Sociedade Anónima':'Société anonyme',
    'Data de constituição':'Date de constitution','N.º matrícula / registo comercial':'Numéro d’immatriculation / registre du commerce',
    'Número da Conservatória':'Numéro du registre','Conservatória / entidade de registo':'Registre / autorité d’enregistrement',
    'Data da certidão comercial':'Date du certificat commercial','Validade da certidão (se indicada)':'Validité du certificat (si indiquée)',
    'N.º da publicação online GUE':'Numéro de publication en ligne GUE','Referência da publicação':'Référence de publication',
    'Data da publicação GUE':'Date de publication GUE','Link da publicação online GUE':'Lien de publication en ligne GUE',
    'Código de actividade (CAE/sector)':'Code d’activité (CAE/secteur)','Descrição da actividade principal':'Description de l’activité principale',
    'N.º do alvará/licença':'Numéro du permis / licence','Tipo de alvará/licença':'Type de permis / licence',
    'Comercial, serviços, industrial…':'Commercial, services, industriel…','Data de emissão do alvará':'Date de délivrance du permis',
    'Validade do alvará':'Validité du permis','N.º de inscrição INSS empregador':'Numéro d’inscription INSS de l’employeur',
    'Proprietário da empresa e primeiro utilizador do sistema':'Propriétaire de l’entreprise et premier utilisateur du système',
    'Documento de identificação do proprietário / representante':'Pièce d’identité du propriétaire / représentant',
    'Número do BI ou passaporte':'Numéro de carte d’identité ou de passeport','NIF do proprietário (se aplicável)':'NIF du propriétaire (si applicable)',
    'Confirmação':'Confirmation','SMS / Telemóvel':'SMS / Téléphone mobile',
    'Entrar com código de confirmação de 6 dígitos':'Se connecter avec un code de vérification à 6 chiffres',
    'Código de acesso (6 dígitos)':'Code d’accès (6 chiffres)',
    'Enviámos um código de utilização única para o seu email. Consulte também a pasta de spam.':'Nous avons envoyé un code à usage unique à votre adresse e-mail. Vérifiez également les courriers indésirables.',
    'Reenviar código':'Renvoyer le code','Já recebeu uma chave de licença?':'Avez-vous reçu une clé de licence?',
    'Chave de licença':'Clé de licence','Código de convite':'Code d’invitation','Criar senha (mínimo 8 caracteres)':'Créer un mot de passe (8 caractères minimum)',
    'Abrir visão geral':'Ouvrir la vue d’ensemble','VISÃO GERAL':'VUE D’ENSEMBLE','Pesquisar módulos...':'Rechercher des modules...',
    'Notificações':'Notifications','Aponte a câmera para o código':'Pointez la caméra vers le code',
    'Idioma do Sistema':'Langue du système','Escolha o idioma da sua conta':'Choisissez la langue de votre compte',
    'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'La langue choisie sera appliquée automatiquement aux écrans et modules disponibles.'
  });
  Object.assign(catalogs.es, {
    'Facturas e operações ilimitadas':'Facturas y operaciones ilimitadas','por mês · valor proposto':'al mes · precio propuesto',
    'Preço inicial proposto, sujeito a aprovação comercial.':'Precio inicial propuesto, sujeto a aprobación comercial.',
    'Próximo':'Siguiente','Apresentação e pacotes Kanawa Soft':'Presentación y planes de Kanawa Soft',
    'Já tenho conta · Entrar':'Ya tengo cuenta · Iniciar sesión','Gestão empresarial numa só plataforma':'Gestión empresarial en una sola plataforma',
    'Da primeira factura à':'Desde la primera factura hasta','Finanças':'Finanzas','Separação por empresa e permissões.':'Separación por empresa y permisos.',
    'Acesso em vários dispositivos.':'Acceso desde varios dispositivos.','Integrações':'Integraciones',
    'Operação comercial e financeira':'Operaciones comerciales y financieras','Gestão de clientes e stock':'Gestión de clientes e inventario',
    'Agenda, documentos e relatórios':'Agenda, documentos e informes','Multi-filial e operações avançadas':'Multisucursal y operaciones avanzadas',
    'Produção, qualidade e integrações':'Producción, calidad e integraciones','Indústria, fábricas e multi-empresa':'Industria, fábricas y multempresa',
    'Configuração empresarial e apoio de implementação':'Configuración empresarial y asistencia de implementación',
    'Limites e preço final definidos em contrato.':'Límites y precio final definidos por contrato.',
    'Experimente durante 14 dias. Sem inserir dados de cartão para iniciar o teste.':'Pruébelo durante 14 días. No se requieren datos de tarjeta para iniciar la prueba.',
    'Começar teste gratuito':'Comenzar prueba gratuita','Duração da licença':'Duración de la licencia','1 mês':'1 mes',
    'Transferência bancária (validação manual)':'Transferencia bancaria (validación manual)',
    'Multicaixa Express (validação manual; API automática ainda não ligada)':'Multicaixa Express (validación manual; API automática aún no conectada)',
    'USD - Dólar':'USD - Dólar estadounidense','Endereço':'Dirección','Sociedade Anónima':'Sociedad anónima',
    'Data de constituição':'Fecha de constitución','N.º matrícula / registo comercial':'N.º de matrícula / registro mercantil',
    'Número da Conservatória':'Número del registro','Conservatória / entidade de registo':'Registro / entidad registradora',
    'Data da certidão comercial':'Fecha del certificado comercial','Validade da certidão (se indicada)':'Validez del certificado (si se indica)',
    'N.º da publicação online GUE':'N.º de publicación en línea GUE','Referência da publicação':'Referencia de publicación',
    'Data da publicação GUE':'Fecha de publicación GUE','Link da publicação online GUE':'Enlace de publicación en línea GUE',
    'Código de actividade (CAE/sector)':'Código de actividad (CAE/sector)','Descrição da actividade principal':'Descripción de la actividad principal',
    'N.º do alvará/licença':'N.º de licencia','Tipo de alvará/licença':'Tipo de licencia',
    'Comercial, serviços, industrial…':'Comercial, servicios, industrial…','Data de emissão do alvará':'Fecha de expedición de la licencia',
    'Validade do alvará':'Validez de la licencia','N.º de inscrição INSS empregador':'N.º de inscripción INSS del empleador',
    'Proprietário da empresa e primeiro utilizador do sistema':'Propietario de la empresa y primer usuario del sistema',
    'Documento de identificação do proprietário / representante':'Documento de identidad del propietario / representante',
    'Número do BI ou passaporte':'Número del documento de identidad o pasaporte','NIF do proprietário (se aplicável)':'NIF del propietario (si procede)',
    'Confirmação':'Confirmación','SMS / Telemóvel':'SMS / Móvil',
    'Entrar com código de confirmação de 6 dígitos':'Iniciar sesión con un código de verificación de 6 dígitos',
    'Código de acesso (6 dígitos)':'Código de acceso (6 dígitos)',
    'Enviámos um código de utilização única para o seu email. Consulte também a pasta de spam.':'Enviamos un código de un solo uso a su correo electrónico. Compruebe también la carpeta de spam.',
    'Reenviar código':'Reenviar código','Já recebeu uma chave de licença?':'¿Ya ha recibido una clave de licencia?',
    'Chave de licença':'Clave de licencia','Código de convite':'Código de invitación','Criar senha (mínimo 8 caracteres)':'Crear contraseña (mínimo 8 caracteres)',
    'Abrir visão geral':'Abrir vista general','VISÃO GERAL':'VISTA GENERAL','Pesquisar módulos...':'Buscar módulos...',
    'Notificações':'Notificaciones','Aponte a câmera para o código':'Apunte la cámara al código',
    'Idioma do Sistema':'Idioma del sistema','Escolha o idioma da sua conta':'Elija el idioma de su cuenta',
    'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'El idioma elegido se aplicará automáticamente a las pantallas y módulos disponibles.'
  });
  Object.assign(catalogs.zh, {
    'Facturas e operações ilimitadas':'发票和业务操作不限量','por mês · valor proposto':'每月 · 建议价格',
    'Preço inicial proposto, sujeito a aprovação comercial.':'建议起始价格，须经商务审批。',
    'Próximo':'下一步','Apresentação e pacotes Kanawa Soft':'Kanawa Soft 介绍与套餐',
    'Já tenho conta · Entrar':'我已有账户 · 登录','Gestão empresarial numa só plataforma':'一体化企业管理平台',
    'Da primeira factura à':'从第一张发票到','Finanças':'财务','Separação por empresa e permissões.':'按公司隔离数据并设置权限。',
    'Acesso em vários dispositivos.':'可在多台设备访问。','Integrações':'集成',
    'Operação comercial e financeira':'商业与财务运营','Gestão de clientes e stock':'客户与库存管理',
    'Agenda, documentos e relatórios':'日程、文件和报表','Multi-filial e operações avançadas':'多分支机构与高级业务',
    'Produção, qualidade e integrações':'生产、质量与集成','Indústria, fábricas e multi-empresa':'工业、工厂与多公司管理',
    'Configuração empresarial e apoio de implementação':'企业配置与实施支持',
    'Limites e preço final definidos em contrato.':'具体限额和最终价格以合同为准。',
    'Experimente durante 14 dias. Sem inserir dados de cartão para iniciar o teste.':'免费试用 14 天。开始试用无需填写银行卡信息。',
    'Começar teste gratuito':'开始免费试用','Duração da licença':'许可证期限','1 mês':'1 个月',
    'Transferência bancária (validação manual)':'银行转账（人工核验）',
    'Multicaixa Express (validação manual; API automática ainda não ligada)':'Multicaixa Express（人工核验；自动 API 尚未接通）',
    'USD - Dólar':'USD - 美元','Endereço':'地址','Sociedade Anónima':'股份有限公司',
    'Data de constituição':'成立日期','N.º matrícula / registo comercial':'商业登记编号',
    'Número da Conservatória':'登记处编号','Conservatória / entidade de registo':'登记处 / 登记机构',
    'Data da certidão comercial':'商业证明日期','Validade da certidão (se indicada)':'证明有效期（如有）',
    'N.º da publicação online GUE':'GUE 在线公告编号','Referência da publicação':'公告参考号',
    'Data da publicação GUE':'GUE 公告日期','Link da publicação online GUE':'GUE 在线公告链接',
    'Código de actividade (CAE/sector)':'经营活动代码（CAE/行业）','Descrição da actividade principal':'主要经营活动说明',
    'N.º do alvará/licença':'许可证编号','Tipo de alvará/licença':'许可证类型',
    'Comercial, serviços, industrial…':'商业、服务、工业……','Data de emissão do alvará':'许可证签发日期',
    'Validade do alvará':'许可证有效期','N.º de inscrição INSS empregador':'雇主 INSS 注册编号',
    'Proprietário da empresa e primeiro utilizador do sistema':'公司所有者及首位系统用户',
    'Documento de identificação do proprietário / representante':'所有者 / 代表身份证明文件',
    'Número do BI ou passaporte':'身份证或护照号码','NIF do proprietário (se aplicável)':'所有者税号（如适用）',
    'Confirmação':'确认','SMS / Telemóvel':'短信 / 手机',
    'Entrar com código de confirmação de 6 dígitos':'使用 6 位验证码登录','Código de acesso (6 dígitos)':'访问代码（6 位）',
    'Enviámos um código de utilização única para o seu email. Consulte também a pasta de spam.':'我们已向您的电子邮箱发送一次性验证码。请同时检查垃圾邮件文件夹。',
    'Reenviar código':'重新发送验证码','Já recebeu uma chave de licença?':'您是否已收到许可证密钥？',
    'Chave de licença':'许可证密钥','Código de convite':'邀请代码','Criar senha (mínimo 8 caracteres)':'创建密码（至少 8 个字符）',
    'Abrir visão geral':'打开总览','VISÃO GERAL':'总览','Pesquisar módulos...':'搜索模块...',
    'Notificações':'通知','Aponte a câmera para o código':'将摄像头对准代码',
    'Idioma do Sistema':'系统语言','Escolha o idioma da sua conta':'选择账户语言',
    'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'所选语言将自动应用于可用页面和模块。'
  });
  Object.assign(catalogs.ar, {
    'Facturas e operações ilimitadas':'فواتير وعمليات غير محدودة','por mês · valor proposto':'شهرياً · السعر المقترح',
    'Preço inicial proposto, sujeito a aprovação comercial.':'السعر الابتدائي المقترح خاضع للموافقة التجارية.',
    'Próximo':'التالي','Apresentação e pacotes Kanawa Soft':'عرض وباقات Kanawa Soft',
    'Já tenho conta · Entrar':'لدي حساب بالفعل · تسجيل الدخول','Gestão empresarial numa só plataforma':'إدارة الأعمال عبر منصة واحدة',
    'Da primeira factura à':'من أول فاتورة إلى','Finanças':'المالية','Separação por empresa e permissões.':'فصل بيانات الشركات وإدارة الصلاحيات.',
    'Acesso em vários dispositivos.':'الوصول من أجهزة متعددة.','Integrações':'التكاملات',
    'Operação comercial e financeira':'العمليات التجارية والمالية','Gestão de clientes e stock':'إدارة العملاء والمخزون',
    'Agenda, documentos e relatórios':'الجدول والمستندات والتقارير','Multi-filial e operações avançadas':'فروع متعددة وعمليات متقدمة',
    'Produção, qualidade e integrações':'الإنتاج والجودة والتكاملات','Indústria, fábricas e multi-empresa':'الصناعة والمصانع وتعدد الشركات',
    'Configuração empresarial e apoio de implementação':'إعداد الأعمال ودعم التنفيذ',
    'Limites e preço final definidos em contrato.':'تُحدد الحدود والسعر النهائي في العقد.',
    'Experimente durante 14 dias. Sem inserir dados de cartão para iniciar o teste.':'جرّب لمدة 14 يوماً. لا يلزم إدخال بيانات البطاقة لبدء التجربة.',
    'Começar teste gratuito':'ابدأ التجربة المجانية','Duração da licença':'مدة الترخيص','1 mês':'شهر واحد',
    'Transferência bancária (validação manual)':'تحويل مصرفي (تحقق يدوي)',
    'Multicaixa Express (validação manual; API automática ainda não ligada)':'Multicaixa Express (تحقق يدوي؛ واجهة API الآلية غير متصلة بعد)',
    'USD - Dólar':'USD - دولار أمريكي','Endereço':'العنوان','Sociedade Anónima':'شركة مساهمة',
    'Data de constituição':'تاريخ التأسيس','N.º matrícula / registo comercial':'رقم السجل التجاري',
    'Número da Conservatória':'رقم مكتب التسجيل','Conservatória / entidade de registo':'مكتب التسجيل / جهة التسجيل',
    'Data da certidão comercial':'تاريخ الشهادة التجارية','Validade da certidão (se indicada)':'صلاحية الشهادة (إن وجدت)',
    'N.º da publicação online GUE':'رقم النشر الإلكتروني لدى GUE','Referência da publicação':'مرجع النشر',
    'Data da publicação GUE':'تاريخ نشر GUE','Link da publicação online GUE':'رابط نشر GUE الإلكتروني',
    'Código de actividade (CAE/sector)':'رمز النشاط (CAE/القطاع)','Descrição da actividade principal':'وصف النشاط الرئيسي',
    'N.º do alvará/licença':'رقم التصريح / الترخيص','Tipo de alvará/licença':'نوع التصريح / الترخيص',
    'Comercial, serviços, industrial…':'تجاري، خدمات، صناعي…','Data de emissão do alvará':'تاريخ إصدار التصريح',
    'Validade do alvará':'صلاحية التصريح','N.º de inscrição INSS empregador':'رقم تسجيل صاحب العمل لدى INSS',
    'Proprietário da empresa e primeiro utilizador do sistema':'مالك الشركة وأول مستخدم للنظام',
    'Documento de identificação do proprietário / representante':'وثيقة هوية المالك / الممثل',
    'Número do BI ou passaporte':'رقم بطاقة الهوية أو جواز السفر','NIF do proprietário (se aplicável)':'الرقم الضريبي للمالك (إن وجد)',
    'Confirmação':'تأكيد','SMS / Telemóvel':'رسالة نصية / هاتف محمول',
    'Entrar com código de confirmação de 6 dígitos':'تسجيل الدخول برمز تحقق من 6 أرقام','Código de acesso (6 dígitos)':'رمز الدخول (6 أرقام)',
    'Enviámos um código de utilização única para o seu email. Consulte também a pasta de spam.':'أرسلنا رمزاً لمرة واحدة إلى بريدك الإلكتروني. تحقق أيضاً من مجلد الرسائل غير المرغوب فيها.',
    'Reenviar código':'إعادة إرسال الرمز','Já recebeu uma chave de licença?':'هل استلمت مفتاح الترخيص؟',
    'Chave de licença':'مفتاح الترخيص','Código de convite':'رمز الدعوة','Criar senha (mínimo 8 caracteres)':'إنشاء كلمة مرور (8 أحرف على الأقل)',
    'Abrir visão geral':'فتح النظرة العامة','VISÃO GERAL':'نظرة عامة','Pesquisar módulos...':'البحث عن الوحدات...',
    'Notificações':'الإشعارات','Aponte a câmera para o código':'وجّه الكاميرا نحو الرمز',
    'Idioma do Sistema':'لغة النظام','Escolha o idioma da sua conta':'اختر لغة حسابك',
    'O idioma escolhido será aplicado automaticamente aos ecrãs e módulos disponíveis.':'سيتم تطبيق اللغة المختارة تلقائياً على الشاشات والوحدات المتاحة.'
  });
  Object.assign(catalogs.ln, {
    'Próximo':'Oyo elandi','Finanças':'Mbongo','Endereço':'Adrɛsi','Confirmação':'Bondimi',
    'Notificações':'Mayebisi','Idioma':'Lokota','Idioma do Sistema':'Lokota ya système',
    'Pesquisar módulos...':'Luka ba module','Guardar':'Bomba','Cancelar':'Longola',
    'Nome':'Kombo','Email':'Email','Data':'Mokolo','Total':'Motango mobimba'
  });
  Object.assign(catalogs.cjk, {
    'Próximo':'Kukwata','Finanças':'Mali','Endereço':'Kumbi','Confirmação':'Kukundulula',
    'Notificações':'Kusakula','Idioma':'Limi','Idioma do Sistema':'Limi lya sistema',
    'Guardar':'Kusweka','Cancelar':'Kuleka','Nome':'Dijina','Email':'Email',
    'Data':'Ditalala','Total':'Wonso'
  });


  // Shared operational feedback and transaction labels used across ERP modules.
  Object.assign(catalogs.en, {
    'Ordem de produção não encontrada.':'Production order not found.','Produto não encontrado no catálogo.':'Product not found in the catalogue.',
    'Cliente não encontrado.':'Customer not found.','Serviço não encontrado.':'Service not found.',
    'Produto acabado não encontrado.':'Finished product not found.','Centro de trabalho não encontrado.':'Work centre not found.',
    'Não foi possível fechar a caixa.':'Could not close the cash register.','Não foi possível guardar a venda.':'Could not save the sale.',
    'Não foi possível guardar a pró-forma.':'Could not save the pro forma invoice.',
    'A venda não pode ser finalizada com total igual a zero.':'The sale cannot be completed with a zero total.',
    'O valor recebido é inferior ao total da venda.':'The amount received is less than the sale total.',
    'Quantidade superior ao stock disponível (':'Quantity exceeds available stock (',
    'Quantidade excede stock geral disponível.':'Quantity exceeds the total available stock.',
    'Importação cancelada; nenhum produto foi gravado.':'Import cancelled; no products were saved.',
    'O preço de compra deve ser um valor válido e não negativo.':'Purchase price must be a valid non-negative amount.',
    'O preço de venda deve ser um valor válido e não negativo.':'Sale price must be a valid non-negative amount.',
    'Cliente Anônimo':'Walk-in Customer','Carrinho vazio — seleccione produtos para começar':'Cart is empty — select products to get started',
    'Sem movimentos no período.':'No movements in this period.','Indique o motivo da movimentação':'Enter the reason for the movement',
    'O total de débito deve ser igual ao total de crédito.':'Total debits must equal total credits.',
    'Preencha a data, o histórico e pelo menos duas linhas.':'Enter the date, description and at least two lines.',
    'Importe ou crie pelo menos duas contas antes de lançar.':'Import or create at least two accounts before posting.',
    'Lançamento recusado pelo servidor.':'Entry rejected by the server.',
    'O valor deve ser positivo e não pode exceder o saldo em dívida.':'The amount must be positive and cannot exceed the outstanding balance.',
    'Não foi possível emitir o recibo.':'Could not issue the receipt.','Inventário':'Inventory',
    'Funcionário guardado. A sincronização dos dados laborais será repetida.':'Employee saved. Employment data synchronisation will be retried.',
    'Funcionário registado':'Employee registered','Admissão':'Hiring date','Salário base':'Base salary',
    'Bónus':'Bonus','Líquido estimado':'Estimated net pay','Patrimônio':'Assets',
    'Registar devolução e emitir Nota de Crédito':'Register return and issue a Credit Note',
    'Cancelar a venda e emitir uma Nota de Crédito integral':'Cancel the sale and issue a full Credit Note',
    'Venda não encontrada ou já cancelada.':'Sale not found or already cancelled.',
    'Esta factura já foi totalmente rectificada por Notas de Crédito.':'This invoice has already been fully adjusted by Credit Notes.',
    'Indique um motivo válido.':'Enter a valid reason.','Nota de Crédito':'Credit Note',
    'Não foi possível cancelar a venda com Nota de Crédito.':'Could not cancel the sale with a Credit Note.',
    'Este navegador não suporta compressão segura de backups.':'This browser does not support secure backup compression.',
    'Este navegador não disponibiliza criptografia segura para o backup.':'This browser does not provide secure backup encryption.',
    'As chaves não coincidem. Backup cancelado.':'The keys do not match. Backup cancelled.',
    'Formato de backup não reconhecido.':'Unrecognised backup format.',
    'O conteúdo não pertence a um backup KanawaSoft válido.':'The content is not a valid KanawaSoft backup.',
    'Backup restaurado no armazenamento local. Execute a sincronização após conferir os dados.':'Backup restored to local storage. Run synchronisation after checking the data.',
    'Convites temporariamente bloqueados por segurança.':'Invitations are temporarily blocked for security reasons.',
    'O seu perfil não pode criar colaboradores.':'Your role cannot create team members.',
    'Não foi possível actualizar o acesso:':'Could not update access:',
    'Dados comerciais guardados localmente; sincronização pendente:':'Business data saved locally; synchronisation pending:',
    'Empresa guardada; sincronização pendente.':'Company saved; synchronisation pending.',
    'Preencha o nome, NIF, telefone e um email válido da empresa.':'Enter the company name, tax ID, phone number and a valid email address.',
    'Conta criada e empresa ligada à base de dados central.':'Account created and company connected to the central database.',
    'Não há procura registada. Crie um Plano de Produção ou uma Previsão de Vendas antes de calcular.':'No demand has been recorded. Create a Production Plan or Sales Forecast before calculating.',
    'Simulação MRP concluída. O stock não foi alterado.':'MRP simulation completed. Inventory was not changed.',
    'Plano guardado. Stock não foi movimentado.':'Plan saved. Inventory was not moved.',
    'Toque no mapa para marcar a localização do cliente.':'Tap the map to mark the customer location.',
    'Este dispositivo não disponibiliza geolocalização.':'This device does not provide geolocation.',
    'Não foi possível obter a localização:':'Could not obtain the location:',
    'Não foi possível calcular a rota.':'Could not calculate the route.',
    'Cadastre pelo menos dois armazéns.':'Register at least two warehouses.',
    'Transferência entre armazéns':'Warehouse transfer','Armazém Central':'Central Warehouse',
    'Importar transferências do Excel':'Import transfers from Excel',
    'Falha na transação local de transferência.':'Local transfer transaction failed.',
    'Transação de transferência cancelada.':'Transfer transaction cancelled.',
    'Não foi possível aceitar o convite.':'Could not accept the invitation.',
    'Convite aceite. Acesso à empresa ativado.':'Invitation accepted. Company access activated.',
    'Novo código enviado. Utilize o código mais recente.':'New code sent. Use the most recent code.',
    'Seleccione um período válido.':'Select a valid period.',
    'Relatório exportado em CSV compatível com Excel.':'Report exported as an Excel-compatible CSV.',
    'Não foi possível exportar o relatório.':'Could not export the report.',
    'SAF-T (AO) exportado. Valide o ficheiro no ambiente oficial antes de produção.':'SAF-T (AO) exported. Validate the file in the official environment before production.',
    'Não foi possível exportar o SAF-T (AO).':'Could not export SAF-T (AO).',
    'Permissões guardadas no servidor.':'Permissions saved on the server.',
    'Não foi possível guardar as permissões.':'Could not save permissions.',
    'Declaração não encontrada.':'Declaration not found.','Não foi possível abrir a declaração.':'Could not open the declaration.',
    'Não foi possível guardar o documento.':'Could not save the document.',
    'Pedido enviado para aprovação.':'Request sent for approval.',
    'Não foi possível decidir o pedido.':'Could not process the request.',
    'Não foi possível processar a folha.':'Could not process payroll.',
    'Produto acabado e componente devem existir no catálogo.':'Finished product and component must exist in the catalogue.',
    'Componente já existe nesta ficha técnica.':'Component already exists in this bill of materials.',
    'Adicione pelo menos uma operação ao roteiro.':'Add at least one operation to the routing.',
    'Produto do roteiro não encontrado no catálogo.':'Routing product not found in the catalogue.',
    'O produto ainda não possui roteiro de fabrico.':'The product does not yet have a manufacturing routing.',
    'Subproduto não existe no catálogo.':'By-product does not exist in the catalogue.',
    'Quantidade aprovada não pode exceder a inspeccionada.':'Approved quantity cannot exceed inspected quantity.',
    'Os custos e horas não podem ser negativos.':'Costs and hours cannot be negative.',
    'Produto e quantidade programada são obrigatórios.':'Product and scheduled quantity are required.',
    'Estado da ordem de produção inválido.':'Invalid production order status.',
    'Tarefa concluída.':'Task completed.','Projecto não encontrado.':'Project not found.',
    'Não foi possível guardar o projecto.':'Could not save the project.',
    'Não existem módulos disponíveis nesta categoria para o seu perfil.':'No modules are available in this category for your role.'
  });
  Object.assign(catalogs.fr, {
    'Ordem de produção não encontrada.':'Ordre de production introuvable.','Produto não encontrado no catálogo.':'Produit introuvable dans le catalogue.',
    'Cliente não encontrado.':'Client introuvable.','Serviço não encontrado.':'Service introuvable.',
    'Produto acabado não encontrado.':'Produit fini introuvable.','Centro de trabalho não encontrado.':'Centre de travail introuvable.',
    'Não foi possível fechar a caixa.':'Impossible de clôturer la caisse.','Não foi possível guardar a venda.':'Impossible d’enregistrer la vente.',
    'Não foi possível guardar a pró-forma.':'Impossible d’enregistrer le pro forma.',
    'A venda não pode ser finalizada com total igual a zero.':'La vente ne peut pas être finalisée avec un total nul.',
    'O valor recebido é inferior ao total da venda.':'Le montant reçu est inférieur au total de la vente.',
    'Quantidade superior ao stock disponível (':'La quantité dépasse le stock disponible (',
    'Quantidade excede stock geral disponível.':'La quantité dépasse le stock total disponible.',
    'Importação cancelada; nenhum produto foi gravado.':'Importation annulée ; aucun produit n’a été enregistré.',
    'O preço de compra deve ser um valor válido e não negativo.':'Le prix d’achat doit être valide et non négatif.',
    'O preço de venda deve ser um valor válido e não negativo.':'Le prix de vente doit être valide et non négatif.',
    'Cliente Anônimo':'Client de passage','Carrinho vazio — seleccione produtos para começar':'Panier vide — sélectionnez des produits pour commencer',
    'Sem movimentos no período.':'Aucun mouvement sur cette période.','Indique o motivo da movimentação':'Indiquez le motif du mouvement',
    'O total de débito deve ser igual ao total de crédito.':'Le total des débits doit être égal au total des crédits.',
    'Preencha a data, o histórico e pelo menos duas linhas.':'Renseignez la date, le libellé et au moins deux lignes.',
    'Importe ou crie pelo menos duas contas antes de lançar.':'Importez ou créez au moins deux comptes avant de comptabiliser.',
    'Lançamento recusado pelo servidor.':'Écriture refusée par le serveur.',
    'O valor deve ser positivo e não pode exceder o saldo em dívida.':'Le montant doit être positif et ne peut pas dépasser le solde dû.',
    'Não foi possível emitir o recibo.':'Impossible d’émettre le reçu.','Inventário':'Inventaire',
    'Funcionário registado':'Employé enregistré','Admissão':'Date d’embauche','Salário base':'Salaire de base',
    'Bónus':'Prime','Líquido estimado':'Net estimé','Patrimônio':'Actifs',
    'Registar devolução e emitir Nota de Crédito':'Enregistrer le retour et émettre une note de crédit',
    'Cancelar a venda e emitir uma Nota de Crédito integral':'Annuler la vente et émettre une note de crédit intégrale',
    'Venda não encontrada ou já cancelada.':'Vente introuvable ou déjà annulée.',
    'Esta factura já foi totalmente rectificada por Notas de Crédito.':'Cette facture a déjà été entièrement rectifiée par des notes de crédit.',
    'Indique um motivo válido.':'Indiquez un motif valide.','Nota de Crédito':'Note de crédit',
    'Não foi possível cancelar a venda com Nota de Crédito.':'Impossible d’annuler la vente avec une note de crédit.',
    'Este navegador não suporta compressão segura de backups.':'Ce navigateur ne prend pas en charge la compression sécurisée des sauvegardes.',
    'Este navegador não disponibiliza criptografia segura para o backup.':'Ce navigateur ne fournit pas de chiffrement sécurisé pour la sauvegarde.',
    'As chaves não coincidem. Backup cancelado.':'Les clés ne correspondent pas. Sauvegarde annulée.',
    'Formato de backup não reconhecido.':'Format de sauvegarde non reconnu.',
    'O conteúdo não pertence a um backup KanawaSoft válido.':'Le contenu ne correspond pas à une sauvegarde KanawaSoft valide.',
    'Backup restaurado no armazenamento local. Execute a sincronização após conferir os dados.':'Sauvegarde restaurée localement. Lancez la synchronisation après vérification des données.',
    'Convites temporariamente bloqueados por segurança.':'Les invitations sont temporairement bloquées pour des raisons de sécurité.',
    'O seu perfil não pode criar colaboradores.':'Votre rôle ne peut pas créer de collaborateurs.',
    'Não foi possível actualizar o acesso:':'Impossible de mettre à jour l’accès :',
    'Dados comerciais guardados localmente; sincronização pendente:':'Données commerciales enregistrées localement ; synchronisation en attente :',
    'Empresa guardada; sincronização pendente.':'Entreprise enregistrée ; synchronisation en attente.',
    'Preencha o nome, NIF, telefone e um email válido da empresa.':'Renseignez le nom, le NIF, le téléphone et une adresse e-mail valide de l’entreprise.',
    'Conta criada e empresa ligada à base de dados central.':'Compte créé et entreprise connectée à la base de données centrale.',
    'Simulação MRP concluída. O stock não foi alterado.':'Simulation MRP terminée. Le stock n’a pas été modifié.',
    'Plano guardado. Stock não foi movimentado.':'Plan enregistré. Le stock n’a pas été déplacé.',
    'Toque no mapa para marcar a localização do cliente.':'Touchez la carte pour indiquer l’emplacement du client.',
    'Este dispositivo não disponibiliza geolocalização.':'Cet appareil ne fournit pas de géolocalisation.',
    'Não foi possível obter a localização:':'Impossible d’obtenir la localisation :',
    'Não foi possível calcular a rota.':'Impossible de calculer l’itinéraire.',
    'Cadastre pelo menos dois armazéns.':'Enregistrez au moins deux entrepôts.',
    'Transferência entre armazéns':'Transfert entre entrepôts','Armazém Central':'Entrepôt central',
    'Importar transferências do Excel':'Importer les transferts depuis Excel',
    'Falha na transação local de transferência.':'Échec de la transaction locale de transfert.',
    'Transação de transferência cancelada.':'Transaction de transfert annulée.',
    'Não foi possível aceitar o convite.':'Impossible d’accepter l’invitation.',
    'Convite aceite. Acesso à empresa ativado.':'Invitation acceptée. Accès à l’entreprise activé.',
    'Novo código enviado. Utilize o código mais recente.':'Nouveau code envoyé. Utilisez le code le plus récent.',
    'Seleccione um período válido.':'Sélectionnez une période valide.',
    'Relatório exportado em CSV compatível com Excel.':'Rapport exporté au format CSV compatible avec Excel.',
    'Não foi possível exportar o relatório.':'Impossible d’exporter le rapport.',
    'SAF-T (AO) exportado. Valide o ficheiro no ambiente oficial antes de produção.':'SAF-T (AO) exporté. Validez le fichier dans l’environnement officiel avant la production.',
    'Não foi possível exportar o SAF-T (AO).':'Impossible d’exporter le SAF-T (AO).',
    'Permissões guardadas no servidor.':'Autorisations enregistrées sur le serveur.',
    'Não foi possível guardar as permissões.':'Impossible d’enregistrer les autorisations.',
    'Declaração não encontrada.':'Déclaration introuvable.','Não foi possível abrir a declaração.':'Impossible d’ouvrir la déclaration.',
    'Não foi possível guardar o documento.':'Impossible d’enregistrer le document.',
    'Pedido enviado para aprovação.':'Demande envoyée pour approbation.',
    'Não foi possível decidir o pedido.':'Impossible de traiter la demande.',
    'Não foi possível processar a folha.':'Impossible de traiter la paie.',
    'Produto acabado e componente devem existir no catálogo.':'Le produit fini et le composant doivent exister dans le catalogue.',
    'Componente já existe nesta ficha técnica.':'Le composant existe déjà dans cette nomenclature.',
    'Adicione pelo menos uma operação ao roteiro.':'Ajoutez au moins une opération à la gamme.',
    'Produto do roteiro não encontrado no catálogo.':'Produit de la gamme introuvable dans le catalogue.',
    'O produto ainda não possui roteiro de fabrico.':'Le produit ne possède pas encore de gamme de fabrication.',
    'Subproduto não existe no catálogo.':'Le sous-produit n’existe pas dans le catalogue.',
    'Quantidade aprovada não pode exceder a inspeccionada.':'La quantité approuvée ne peut pas dépasser la quantité inspectée.',
    'Os custos e horas não podem ser negativos.':'Les coûts et les heures ne peuvent pas être négatifs.',
    'Produto e quantidade programada são obrigatórios.':'Le produit et la quantité planifiée sont obligatoires.',
    'Estado da ordem de produção inválido.':'État de l’ordre de production invalide.',
    'Tarefa concluída.':'Tâche terminée.','Projecto não encontrado.':'Projet introuvable.',
    'Não foi possível guardar o projecto.':'Impossible d’enregistrer le projet.',
    'Não existem módulos disponíveis nesta categoria para o seu perfil.':'Aucun module n’est disponible dans cette catégorie pour votre rôle.'
  });
  Object.assign(catalogs.es, {
    'Ordem de produção não encontrada.':'No se encontró la orden de producción.','Produto não encontrado no catálogo.':'Producto no encontrado en el catálogo.',
    'Cliente não encontrado.':'Cliente no encontrado.','Serviço não encontrado.':'Servicio no encontrado.',
    'Produto acabado não encontrado.':'Producto terminado no encontrado.','Centro de trabalho não encontrado.':'Centro de trabajo no encontrado.',
    'Não foi possível fechar a caixa.':'No se pudo cerrar la caja.','Não foi possível guardar a venda.':'No se pudo guardar la venta.',
    'Não foi possível guardar a pró-forma.':'No se pudo guardar la factura proforma.',
    'A venda não pode ser finalizada com total igual a zero.':'La venta no puede finalizarse con un total igual a cero.',
    'O valor recebido é inferior ao total da venda.':'El importe recibido es inferior al total de la venta.',
    'Quantidade superior ao stock disponível (':'La cantidad supera el inventario disponible (',
    'Quantidade excede stock geral disponível.':'La cantidad supera el inventario total disponible.',
    'Importação cancelada; nenhum produto foi gravado.':'Importación cancelada; no se guardó ningún producto.',
    'O preço de compra deve ser um valor válido e não negativo.':'El precio de compra debe ser válido y no negativo.',
    'O preço de venda deve ser um valor válido e não negativo.':'El precio de venta debe ser válido y no negativo.',
    'Cliente Anônimo':'Cliente ocasional','Carrinho vazio — seleccione produtos para começar':'Carrito vacío: seleccione productos para comenzar',
    'Sem movimentos no período.':'No hay movimientos en este periodo.','Indique o motivo da movimentação':'Indique el motivo del movimiento',
    'O total de débito deve ser igual ao total de crédito.':'El total del debe debe ser igual al total del haber.',
    'Preencha a data, o histórico e pelo menos duas linhas.':'Introduzca la fecha, el concepto y al menos dos líneas.',
    'Importe ou crie pelo menos duas contas antes de lançar.':'Importe o cree al menos dos cuentas antes de contabilizar.',
    'Lançamento recusado pelo servidor.':'Asiento rechazado por el servidor.',
    'O valor deve ser positivo e não pode exceder o saldo em dívida.':'El importe debe ser positivo y no puede superar el saldo pendiente.',
    'Não foi possível emitir o recibo.':'No se pudo emitir el recibo.','Inventário':'Inventario',
    'Funcionário registado':'Empleado registrado','Admissão':'Fecha de contratación','Salário base':'Salario base',
    'Bónus':'Bono','Líquido estimado':'Neto estimado','Patrimônio':'Activos',
    'Registar devolução e emitir Nota de Crédito':'Registrar devolución y emitir nota de crédito',
    'Cancelar a venda e emitir uma Nota de Crédito integral':'Cancelar la venta y emitir una nota de crédito completa',
    'Venda não encontrada ou já cancelada.':'Venta no encontrada o ya cancelada.',
    'Esta factura já foi totalmente rectificada por Notas de Crédito.':'Esta factura ya ha sido rectificada completamente mediante notas de crédito.',
    'Indique um motivo válido.':'Indique un motivo válido.','Nota de Crédito':'Nota de crédito',
    'Não foi possível cancelar a venda com Nota de Crédito.':'No se pudo cancelar la venta mediante una nota de crédito.',
    'Este navegador não suporta compressão segura de backups.':'Este navegador no admite la compresión segura de copias de seguridad.',
    'Este navegador não disponibiliza criptografia segura para o backup.':'Este navegador no proporciona cifrado seguro para la copia de seguridad.',
    'As chaves não coincidem. Backup cancelado.':'Las claves no coinciden. Copia de seguridad cancelada.',
    'Formato de backup não reconhecido.':'Formato de copia de seguridad no reconocido.',
    'O conteúdo não pertence a um backup KanawaSoft válido.':'El contenido no corresponde a una copia de seguridad válida de KanawaSoft.',
    'Backup restaurado no armazenamento local. Execute a sincronização após conferir os dados.':'Copia restaurada en el almacenamiento local. Sincronice después de comprobar los datos.',
    'Convites temporariamente bloqueados por segurança.':'Las invitaciones están bloqueadas temporalmente por seguridad.',
    'O seu perfil não pode criar colaboradores.':'Su perfil no puede crear colaboradores.',
    'Não foi possível actualizar o acesso:':'No se pudo actualizar el acceso:',
    'Dados comerciais guardados localmente; sincronização pendente:':'Datos comerciales guardados localmente; sincronización pendiente:',
    'Empresa guardada; sincronização pendente.':'Empresa guardada; sincronización pendiente.',
    'Preencha o nome, NIF, telefone e um email válido da empresa.':'Introduzca el nombre, NIF, teléfono y un correo electrónico válido de la empresa.',
    'Conta criada e empresa ligada à base de dados central.':'Cuenta creada y empresa conectada a la base de datos central.',
    'Simulação MRP concluída. O stock não foi alterado.':'Simulación MRP completada. El inventario no se ha modificado.',
    'Plano guardado. Stock não foi movimentado.':'Plan guardado. El inventario no se ha movido.',
    'Toque no mapa para marcar a localização do cliente.':'Toque el mapa para marcar la ubicación del cliente.',
    'Este dispositivo não disponibiliza geolocalização.':'Este dispositivo no proporciona geolocalización.',
    'Não foi possível obter a localização:':'No se pudo obtener la ubicación:',
    'Não foi possível calcular a rota.':'No se pudo calcular la ruta.',
    'Cadastre pelo menos dois armazéns.':'Registre al menos dos almacenes.',
    'Transferência entre armazéns':'Transferencia entre almacenes','Armazém Central':'Almacén central',
    'Importar transferências do Excel':'Importar transferencias desde Excel',
    'Falha na transação local de transferência.':'Error en la transacción local de transferencia.',
    'Transação de transferência cancelada.':'Transacción de transferencia cancelada.',
    'Não foi possível aceitar o convite.':'No se pudo aceptar la invitación.',
    'Convite aceite. Acesso à empresa ativado.':'Invitación aceptada. Acceso a la empresa activado.',
    'Novo código enviado. Utilize o código mais recente.':'Nuevo código enviado. Utilice el código más reciente.',
    'Seleccione um período válido.':'Seleccione un periodo válido.',
    'Relatório exportado em CSV compatível com Excel.':'Informe exportado en CSV compatible con Excel.',
    'Não foi possível exportar o relatório.':'No se pudo exportar el informe.',
    'SAF-T (AO) exportado. Valide o ficheiro no ambiente oficial antes de produção.':'SAF-T (AO) exportado. Valide el archivo en el entorno oficial antes de producción.',
    'Não foi possível exportar o SAF-T (AO).':'No se pudo exportar el SAF-T (AO).',
    'Permissões guardadas no servidor.':'Permisos guardados en el servidor.',
    'Não foi possível guardar as permissões.':'No se pudieron guardar los permisos.',
    'Declaração não encontrada.':'Declaración no encontrada.','Não foi possível abrir a declaração.':'No se pudo abrir la declaración.',
    'Não foi possível guardar o documento.':'No se pudo guardar el documento.',
    'Pedido enviado para aprovação.':'Solicitud enviada para aprobación.',
    'Não foi possível decidir o pedido.':'No se pudo procesar la solicitud.',
    'Não foi possível processar a folha.':'No se pudo procesar la nómina.',
    'Produto acabado e componente devem existir no catálogo.':'El producto terminado y el componente deben existir en el catálogo.',
    'Componente já existe nesta ficha técnica.':'El componente ya existe en esta lista de materiales.',
    'Adicione pelo menos uma operação ao roteiro.':'Añada al menos una operación a la ruta de fabricación.',
    'Produto do roteiro não encontrado no catálogo.':'Producto de la ruta no encontrado en el catálogo.',
    'O produto ainda não possui roteiro de fabrico.':'El producto todavía no tiene una ruta de fabricación.',
    'Subproduto não existe no catálogo.':'El subproducto no existe en el catálogo.',
    'Quantidade aprovada não pode exceder a inspeccionada.':'La cantidad aprobada no puede superar la cantidad inspeccionada.',
    'Os custos e horas não podem ser negativos.':'Los costes y las horas no pueden ser negativos.',
    'Produto e quantidade programada são obrigatórios.':'El producto y la cantidad programada son obligatorios.',
    'Estado da ordem de produção inválido.':'Estado de la orden de producción no válido.',
    'Tarefa concluída.':'Tarea completada.','Projecto não encontrado.':'Proyecto no encontrado.',
    'Não foi possível guardar o projecto.':'No se pudo guardar el proyecto.',
    'Não existem módulos disponíveis nesta categoria para o seu perfil.':'No hay módulos disponibles en esta categoría para su perfil.'
  });
  Object.assign(catalogs.zh, {
    'Ordem de produção não encontrada.':'未找到生产订单。','Produto não encontrado no catálogo.':'目录中未找到产品。',
    'Cliente não encontrado.':'未找到客户。','Serviço não encontrado.':'未找到服务。',
    'Produto acabado não encontrado.':'未找到成品。','Centro de trabalho não encontrado.':'未找到工作中心。',
    'Não foi possível fechar a caixa.':'无法关闭收银台。','Não foi possível guardar a venda.':'无法保存销售记录。',
    'Não foi possível guardar a pró-forma.':'无法保存形式发票。',
    'A venda não pode ser finalizada com total igual a zero.':'销售总额为零，无法完成交易。',
    'O valor recebido é inferior ao total da venda.':'实收金额低于销售总额。',
    'Quantidade superior ao stock disponível (':'数量超过可用库存（',
    'Quantidade excede stock geral disponível.':'数量超过总可用库存。',
    'Importação cancelada; nenhum produto foi gravado.':'导入已取消；未保存任何产品。',
    'O preço de compra deve ser um valor válido e não negativo.':'采购价格必须是有效的非负数值。',
    'O preço de venda deve ser um valor válido e não negativo.':'销售价格必须是有效的非负数值。',
    'Cliente Anônimo':'散客','Carrinho vazio — seleccione produtos para começar':'购物车为空 — 请选择产品开始',
    'Sem movimentos no período.':'此期间没有库存变动。','Indique o motivo da movimentação':'请填写变动原因',
    'O total de débito deve ser igual ao total de crédito.':'借方总额必须等于贷方总额。',
    'Preencha a data, o histórico e pelo menos duas linhas.':'请填写日期、摘要和至少两条分录。',
    'Importe ou crie pelo menos duas contas antes de lançar.':'过账前请导入或创建至少两个科目。',
    'Lançamento recusado pelo servidor.':'服务器拒绝了该分录。',
    'O valor deve ser positivo e não pode exceder o saldo em dívida.':'金额必须为正数，且不得超过未偿余额。',
    'Não foi possível emitir o recibo.':'无法开具收据。','Inventário':'库存',
    'Funcionário registado':'员工已登记','Admissão':'入职日期','Salário base':'基本工资',
    'Bónus':'奖金','Líquido estimado':'预计净额','Patrimônio':'资产',
    'Registar devolução e emitir Nota de Crédito':'登记退货并开具贷项通知单',
    'Cancelar a venda e emitir uma Nota de Crédito integral':'取消销售并开具全额贷项通知单',
    'Venda não encontrada ou já cancelada.':'未找到销售记录或该记录已取消。',
    'Esta factura já foi totalmente rectificada por Notas de Crédito.':'此发票已通过贷项通知单全部冲销。',
    'Indique um motivo válido.':'请输入有效原因。','Nota de Crédito':'贷项通知单',
    'Não foi possível cancelar a venda com Nota de Crédito.':'无法通过贷项通知单取消销售。',
    'Este navegador não suporta compressão segura de backups.':'此浏览器不支持安全备份压缩。',
    'Este navegador não disponibiliza criptografia segura para o backup.':'此浏览器不提供安全备份加密功能。',
    'As chaves não coincidem. Backup cancelado.':'密钥不匹配。备份已取消。',
    'Formato de backup não reconhecido.':'无法识别备份格式。',
    'O conteúdo não pertence a um backup KanawaSoft válido.':'内容不是有效的 KanawaSoft 备份。',
    'Backup restaurado no armazenamento local. Execute a sincronização após conferir os dados.':'备份已恢复到本地存储。检查数据后请执行同步。',
    'Convites temporariamente bloqueados por segurança.':'出于安全原因，邀请功能暂时被锁定。',
    'O seu perfil não pode criar colaboradores.':'您的角色无权创建团队成员。',
    'Não foi possível actualizar o acesso:':'无法更新访问权限：',
    'Dados comerciais guardados localmente; sincronização pendente:':'业务数据已保存在本地；等待同步：',
    'Empresa guardada; sincronização pendente.':'公司信息已保存；等待同步。',
    'Preencha o nome, NIF, telefone e um email válido da empresa.':'请填写公司名称、税号、电话和有效电子邮件。',
    'Conta criada e empresa ligada à base de dados central.':'账户已创建，公司已连接到中央数据库。',
    'Simulação MRP concluída. O stock não foi alterado.':'MRP 模拟已完成。库存未发生变化。',
    'Plano guardado. Stock não foi movimentado.':'计划已保存。库存未发生变动。',
    'Toque no mapa para marcar a localização do cliente.':'点击地图标记客户位置。',
    'Este dispositivo não disponibiliza geolocalização.':'此设备不支持地理定位。',
    'Não foi possível obter a localização:':'无法获取位置：','Não foi possível calcular a rota.':'无法计算路线。',
    'Cadastre pelo menos dois armazéns.':'请至少登记两个仓库。',
    'Transferência entre armazéns':'仓库间调拨','Armazém Central':'中央仓库',
    'Importar transferências do Excel':'从 Excel 导入调拨记录',
    'Falha na transação local de transferência.':'本地调拨事务失败。',
    'Transação de transferência cancelada.':'调拨事务已取消。',
    'Não foi possível aceitar o convite.':'无法接受邀请。',
    'Convite aceite. Acesso à empresa ativado.':'邀请已接受。公司访问权限已启用。',
    'Novo código enviado. Utilize o código mais recente.':'新验证码已发送。请使用最新验证码。',
    'Seleccione um período válido.':'请选择有效期间。',
    'Relatório exportado em CSV compatível com Excel.':'报表已导出为兼容 Excel 的 CSV 文件。',
    'Não foi possível exportar o relatório.':'无法导出报表。',
    'SAF-T (AO) exportado. Valide o ficheiro no ambiente oficial antes de produção.':'SAF-T (AO) 已导出。正式使用前请在官方环境验证文件。',
    'Não foi possível exportar o SAF-T (AO).':'无法导出 SAF-T (AO)。',
    'Permissões guardadas no servidor.':'权限已保存在服务器上。',
    'Não foi possível guardar as permissões.':'无法保存权限。',
    'Declaração não encontrada.':'未找到申报表。','Não foi possível abrir a declaração.':'无法打开申报表。',
    'Não foi possível guardar o documento.':'无法保存文件。',
    'Pedido enviado para aprovação.':'申请已提交审批。','Não foi possível decidir o pedido.':'无法处理该申请。',
    'Não foi possível processar a folha.':'无法处理工资单。',
    'Produto acabado e componente devem existir no catálogo.':'成品和组件必须存在于产品目录中。',
    'Componente já existe nesta ficha técnica.':'该组件已存在于此物料清单中。',
    'Adicione pelo menos uma operação ao roteiro.':'请至少向工艺路线添加一道工序。',
    'Produto do roteiro não encontrado no catálogo.':'工艺路线产品未在目录中找到。',
    'O produto ainda não possui roteiro de fabrico.':'该产品尚未设置制造工艺路线。',
    'Subproduto não existe no catálogo.':'目录中不存在该副产品。',
    'Quantidade aprovada não pode exceder a inspeccionada.':'合格数量不能超过检验数量。',
    'Os custos e horas não podem ser negativos.':'成本和工时不能为负数。',
    'Produto e quantidade programada são obrigatórios.':'产品和计划数量为必填项。',
    'Estado da ordem de produção inválido.':'生产订单状态无效。',
    'Tarefa concluída.':'任务已完成。','Projecto não encontrado.':'未找到项目。',
    'Não foi possível guardar o projecto.':'无法保存项目。',
    'Não existem módulos disponíveis nesta categoria para o seu perfil.':'您的角色在此类别中没有可用模块。'
  });
  Object.assign(catalogs.ar, {
    'Ordem de produção não encontrada.':'لم يتم العثور على أمر الإنتاج.','Produto não encontrado no catálogo.':'لم يتم العثور على المنتج في الكتالوج.',
    'Cliente não encontrado.':'لم يتم العثور على العميل.','Serviço não encontrado.':'لم يتم العثور على الخدمة.',
    'Produto acabado não encontrado.':'لم يتم العثور على المنتج النهائي.','Centro de trabalho não encontrado.':'لم يتم العثور على مركز العمل.',
    'Não foi possível fechar a caixa.':'تعذر إغلاق صندوق النقد.','Não foi possível guardar a venda.':'تعذر حفظ عملية البيع.',
    'Não foi possível guardar a pró-forma.':'تعذر حفظ الفاتورة الأولية.',
    'A venda não pode ser finalizada com total igual a zero.':'لا يمكن إتمام البيع إذا كان الإجمالي صفراً.',
    'O valor recebido é inferior ao total da venda.':'المبلغ المستلم أقل من إجمالي البيع.',
    'Quantidade superior ao stock disponível (':'الكمية تتجاوز المخزون المتاح (',
    'Quantidade excede stock geral disponível.':'الكمية تتجاوز إجمالي المخزون المتاح.',
    'Importação cancelada; nenhum produto foi gravado.':'تم إلغاء الاستيراد؛ لم يتم حفظ أي منتج.',
    'O preço de compra deve ser um valor válido e não negativo.':'يجب أن يكون سعر الشراء قيمة صحيحة غير سالبة.',
    'O preço de venda deve ser um valor válido e não negativo.':'يجب أن يكون سعر البيع قيمة صحيحة غير سالبة.',
    'Cliente Anônimo':'عميل نقدي','Carrinho vazio — seleccione produtos para começar':'السلة فارغة — اختر المنتجات للبدء',
    'Sem movimentos no período.':'لا توجد حركات خلال هذه الفترة.','Indique o motivo da movimentação':'أدخل سبب الحركة',
    'O total de débito deve ser igual ao total de crédito.':'يجب أن يساوي إجمالي المدين إجمالي الدائن.',
    'Preencha a data, o histórico e pelo menos duas linhas.':'أدخل التاريخ والوصف وسطرين على الأقل.',
    'Importe ou crie pelo menos duas contas antes de lançar.':'استورد أو أنشئ حسابين على الأقل قبل الترحيل.',
    'Lançamento recusado pelo servidor.':'رفض الخادم القيد.',
    'O valor deve ser positivo e não pode exceder o saldo em dívida.':'يجب أن تكون القيمة موجبة وألا تتجاوز الرصيد المستحق.',
    'Não foi possível emitir o recibo.':'تعذر إصدار الإيصال.','Inventário':'المخزون',
    'Funcionário registado':'تم تسجيل الموظف','Admissão':'تاريخ التوظيف','Salário base':'الراتب الأساسي',
    'Bónus':'مكافأة','Líquido estimado':'صافي المبلغ التقديري','Patrimônio':'الأصول',
    'Registar devolução e emitir Nota de Crédito':'تسجيل الإرجاع وإصدار إشعار دائن',
    'Cancelar a venda e emitir uma Nota de Crédito integral':'إلغاء البيع وإصدار إشعار دائن كامل',
    'Venda não encontrada ou já cancelada.':'لم يتم العثور على البيع أو أنه ملغى بالفعل.',
    'Esta factura já foi totalmente rectificada por Notas de Crédito.':'تمت تسوية هذه الفاتورة بالكامل بإشعارات دائنة.',
    'Indique um motivo válido.':'أدخل سبباً صالحاً.','Nota de Crédito':'إشعار دائن',
    'Não foi possível cancelar a venda com Nota de Crédito.':'تعذر إلغاء البيع باستخدام إشعار دائن.',
    'Este navegador não suporta compressão segura de backups.':'هذا المتصفح لا يدعم ضغط النسخ الاحتياطية الآمن.',
    'Este navegador não disponibiliza criptografia segura para o backup.':'هذا المتصفح لا يوفر تشفيراً آمناً للنسخ الاحتياطي.',
    'As chaves não coincidem. Backup cancelado.':'المفتاحان غير متطابقين. تم إلغاء النسخ الاحتياطي.',
    'Formato de backup não reconhecido.':'تنسيق النسخ الاحتياطي غير معروف.',
    'O conteúdo não pertence a um backup KanawaSoft válido.':'المحتوى ليس نسخة احتياطية صالحة من KanawaSoft.',
    'Backup restaurado no armazenamento local. Execute a sincronização após conferir os dados.':'تمت استعادة النسخة الاحتياطية محلياً. نفّذ المزامنة بعد التحقق من البيانات.',
    'Convites temporariamente bloqueados por segurança.':'تم حظر الدعوات مؤقتاً لأسباب أمنية.',
    'O seu perfil não pode criar colaboradores.':'لا تسمح صلاحيات ملفك بإنشاء أعضاء للفريق.',
    'Não foi possível actualizar o acesso:':'تعذر تحديث صلاحية الوصول:',
    'Dados comerciais guardados localmente; sincronização pendente:':'تم حفظ بيانات الأعمال محلياً؛ المزامنة معلّقة:',
    'Empresa guardada; sincronização pendente.':'تم حفظ الشركة؛ المزامنة معلّقة.',
    'Preencha o nome, NIF, telefone e um email válido da empresa.':'أدخل اسم الشركة والرقم الضريبي والهاتف وبريداً إلكترونياً صالحاً.',
    'Conta criada e empresa ligada à base de dados central.':'تم إنشاء الحساب وربط الشركة بقاعدة البيانات المركزية.',
    'Simulação MRP concluída. O stock não foi alterado.':'اكتملت محاكاة تخطيط متطلبات المواد. لم يتغير المخزون.',
    'Plano guardado. Stock não foi movimentado.':'تم حفظ الخطة. لم يتم تحريك المخزون.',
    'Toque no mapa para marcar a localização do cliente.':'المس الخريطة لتحديد موقع العميل.',
    'Este dispositivo não disponibiliza geolocalização.':'هذا الجهاز لا يوفر تحديد الموقع الجغرافي.',
    'Não foi possível obter a localização:':'تعذر الحصول على الموقع:',
    'Não foi possível calcular a rota.':'تعذر حساب المسار.',
    'Cadastre pelo menos dois armazéns.':'سجّل مستودعين على الأقل.',
    'Transferência entre armazéns':'تحويل بين المستودعات','Armazém Central':'المستودع المركزي',
    'Importar transferências do Excel':'استيراد التحويلات من Excel',
    'Falha na transação local de transferência.':'فشلت معاملة التحويل المحلية.',
    'Transação de transferência cancelada.':'تم إلغاء معاملة التحويل.',
    'Não foi possível aceitar o convite.':'تعذر قبول الدعوة.',
    'Convite aceite. Acesso à empresa ativado.':'تم قبول الدعوة وتفعيل الوصول إلى الشركة.',
    'Novo código enviado. Utilize o código mais recente.':'تم إرسال رمز جديد. استخدم أحدث رمز.',
    'Seleccione um período válido.':'اختر فترة صالحة.',
    'Relatório exportado em CSV compatível com Excel.':'تم تصدير التقرير بصيغة CSV المتوافقة مع Excel.',
    'Não foi possível exportar o relatório.':'تعذر تصدير التقرير.',
    'SAF-T (AO) exportado. Valide o ficheiro no ambiente oficial antes de produção.':'تم تصدير SAF-T (AO). تحقق من الملف في البيئة الرسمية قبل الإنتاج.',
    'Não foi possível exportar o SAF-T (AO).':'تعذر تصدير SAF-T (AO).',
    'Permissões guardadas no servidor.':'تم حفظ الصلاحيات على الخادم.',
    'Não foi possível guardar as permissões.':'تعذر حفظ الصلاحيات.',
    'Declaração não encontrada.':'لم يتم العثور على التصريح.','Não foi possível abrir a declaração.':'تعذر فتح التصريح.',
    'Não foi possível guardar o documento.':'تعذر حفظ المستند.',
    'Pedido enviado para aprovação.':'تم إرسال الطلب للموافقة.','Não foi possível decidir o pedido.':'تعذر معالجة الطلب.',
    'Não foi possível processar a folha.':'تعذرت معالجة كشف الرواتب.',
    'Produto acabado e componente devem existir no catálogo.':'يجب أن يكون المنتج النهائي والمكوّن موجودين في الكتالوج.',
    'Componente já existe nesta ficha técnica.':'المكوّن موجود بالفعل في قائمة المواد هذه.',
    'Adicione pelo menos uma operação ao roteiro.':'أضف عملية واحدة على الأقل إلى مسار التصنيع.',
    'Produto do roteiro não encontrado no catálogo.':'منتج مسار التصنيع غير موجود في الكتالوج.',
    'O produto ainda não possui roteiro de fabrico.':'لا يوجد للمنتج مسار تصنيع حتى الآن.',
    'Subproduto não existe no catálogo.':'المنتج الثانوي غير موجود في الكتالوج.',
    'Quantidade aprovada não pode exceder a inspeccionada.':'لا يمكن أن تتجاوز الكمية المعتمدة الكمية التي تم فحصها.',
    'Os custos e horas não podem ser negativos.':'لا يمكن أن تكون التكاليف والساعات سالبة.',
    'Produto e quantidade programada são obrigatórios.':'المنتج والكمية المجدولة مطلوبان.',
    'Estado da ordem de produção inválido.':'حالة أمر الإنتاج غير صالحة.',
    'Tarefa concluída.':'اكتملت المهمة.','Projecto não encontrado.':'لم يتم العثور على المشروع.',
    'Não foi possível guardar o projecto.':'تعذر حفظ المشروع.',
    'Não existem módulos disponíveis nesta categoria para o seu perfil.':'لا توجد وحدات متاحة في هذه الفئة لصلاحياتك.'
  });


  Object.assign(catalogs.en, {
    'O navegador não disponibilizou o armazenamento local (IndexedDB).':'The browser did not provide local storage (IndexedDB).',
    'Não foi possível abrir a base de dados local.':'Could not open the local database.',
    'Modo de demonstração: gravações estão desactivadas nesta Preview.':'Demo mode: write operations are disabled in this Preview.',
    'Atualização da empresa pendente:':'Company update pending:',
    'Venda guardada localmente; sincronização pendente:':'Sale saved locally; synchronisation pending:',
    'Vendas finalizadas são imutáveis. Use uma Nota de Crédito (NC) para rectificar ou anular.':'Completed sales are immutable. Use a Credit Note (CN) to adjust or cancel.',
    'Auditoria de eliminação:':'Deletion audit:','Não foi possível guardar fila de sincronização:':'Could not save the synchronisation queue:',
    'Fila de sincronização mantida para nova tentativa:':'Synchronisation queue retained for retry:',
    'Sem ligação à base de dados. Os dados ficam guardados neste dispositivo.':'No database connection. Data will be saved on this device.',
    'A preparar sincronização segura...':'Preparing secure synchronisation...',
    'Sincronização parcial:':'Partial synchronisation:','Sincronização concluída:':'Synchronisation completed:',
    'Sincronização pendente':'Synchronisation pending','Falha na sincronização:':'Synchronisation failed:',
    'Sem internet — operações locais em fila':'No internet — local operations queued',
    'Base central indisponível; mantém-se o cache local:':'Central database unavailable; local cache retained:',
    'Migração cloud pendente:':'Cloud migration pending:',
    'Sincronização inicial adiada; será retomada quando houver internet:':'Initial synchronisation postponed; it will resume when internet is available:',
    'Registo de instalação pendente:':'Installation registration pending:',
    'Alertas de validade indisponíveis:':'Expiry alerts unavailable:',
    'A licença ou os limites do plano estão em modo de consulta. Verifique a subscrição.':'The license or plan limits are in read-only mode. Check the subscription.',
    'A licença Kanawa Soft expirou. Contacte a D.PEDRO SOLUÇÕES.':'The Kanawa Soft license has expired. Contact D.PEDRO SOLUÇÕES.',
    'A licença expira em':'The license expires on','Sincronização automática:':'Automatic synchronisation:',
    'Funcionalidade disponível noutro plano':'Feature available on another plan','Este módulo':'This module',
    'Separadores do módulo':'Module tabs','Não existem módulos disponíveis neste grupo.':'There are no modules available in this group.',
    '🔒 Sem permissão':'🔒 No permission','Abrir navegação por módulo':'Open module navigation',
    'Erro inesperado ao abrir o módulo.':'Unexpected error while opening the module.',
    'Não indicado':'Not specified','Utilizador não identificado':'Unidentified user',
    'Ordens de serviço':'Work orders','Operações auditadas':'Audited operations',
    'Gestão global, utilizadores, módulos, segurança e resultados.':'Global management, users, modules, security and results.',
    'Acompanhamento das operações, equipa, compras, vendas e resultados.':'Operations, team, purchases, sales and results monitoring.',
    'Contabilidade, fiscalidade, folha salarial, reconciliação e relatórios.':'Accounting, tax, payroll, reconciliation and reports.',
    'Stock, produtos, compras e execução das operações técnicas.':'Inventory, products, purchases and technical operations.',
    'Perfil atualizado. O cargo e as permissões são geridos pelo administrador.':'Profile updated. Role and permissions are managed by the administrator.',
    'Senhas não coincidem':'Passwords do not match','Meta não atingida':'Target not reached',
    'Confirme o motivo/autorização do cancelamento:':'Confirm the reason/authorisation for cancellation:',
    'Motivo da rejeição:':'Reason for rejection:','produtos disponíveis':'available products',
    'Ler código com a câmara':'Scan code with camera','cliente anônimo':'walk-in customer',
    'NIF conferido apenas quanto à estrutura; a validade deve ser confirmada junto da AGT.':'Tax ID checked for structure only; validity must be confirmed with the AGT.',
    'FT — Factura (crédito)':'Invoice (credit)','Pagamento a prazo: confirmar condições e vencimento.':'Credit payment: confirm terms and due date.',
    'Pró-forma':'Pro forma','guardada. Não é factura fiscal e não movimenta stock nem caixa.':'saved. It is not a tax invoice and does not affect inventory or cash.',
    'Inicie sessão e sincronize a empresa online pelo menos uma vez antes de usar vendas offline.':'Sign in and synchronise the company online at least once before using offline sales.',
    'Código ainda não cadastrado. Preencha os dados do novo produto.':'Code not registered yet. Enter the new product details.',
    'Cadastro Rápido':'Quick Add','Deixe vazio se ainda não souber':'Leave blank if not known yet',
    'Excluído':'Deleted','código repetido dentro do Excel':'duplicate code in the Excel file',
    'código de barras repetido dentro do Excel':'duplicate barcode in the Excel file',
    'código já pertence a um produto cadastrado':'code already belongs to a registered product',
    'código de barras já pertence a um produto cadastrado':'barcode already belongs to a registered product',
    'nome já pertence a um produto cadastrado':'name already belongs to a registered product',
    'Nova conta contabilística':'New ledger account','Descrição do movimento':'Movement description',
    'Autorizações comerciais:':'Commercial authorisations:','Código interno do registo':'Internal record code',
    'Referência da operação (opcional)':'Operation reference (optional)','Recibo referente à':'Receipt for',
    'Tabela fiscal local usada; catálogo fiscal não disponível.':'Local tax table used; tax catalogue unavailable.',
    'Sincronização RH pendente:':'HR synchronisation pending:','Tarefa atribuída a':'Task assigned to',
    'Motivo do cancelamento (mínimo 5 caracteres):':'Cancellation reason (at least 5 characters):',
    'Venda cancelada com Nota de Crédito':'Sale cancelled with a Credit Note',
    'A factura já não tem saldo disponível para rectificação.':'The invoice no longer has a balance available for adjustment.',
    'Explique o motivo da nota de crédito':'Explain the reason for the Credit Note',
    'Proforma comercial — não fiscal':'Commercial pro forma — not a tax invoice',
    'Todo o período':'All time','Não foi possível criar o backup encriptado.':'Could not create the encrypted backup.',
    'Introduza a chave usada na criação deste backup.':'Enter the key used to create this backup.',
    'Estrutura inválida na coleção':'Invalid structure in collection','Registos inválidos na coleção':'Invalid records in collection',
    'Código copiado.':'Code copied.','Selecione e copie o código manualmente.':'Select and copy the code manually.',
    'Definições completas do sistema':'Complete system settings','Ligação gerida pela plataforma Kanawa Soft':'Connection managed by the Kanawa Soft platform',
    'Ex.: Condições de pagamento, garantia, devoluções e contactos':'E.g. payment terms, warranty, returns and contacts',
    'Pré-visualização do modelo de fatura':'Invoice template preview','PRÉ-VISUALIZAÇÃO':'PREVIEW',
    'Última confirmação: pretende apagar todos os dados locais e a fila offline deste dispositivo?':'Final confirmation: do you want to delete all local data and the offline queue on this device?',
    'Cache local limpo por ordem inversa de dependências. A base central não foi apagada.':'Local cache cleared in reverse dependency order. The central database was not deleted.',
    'O reset foi interrompido. Não feche esta janela; verifique o armazenamento local.':'Reset interrupted. Do not close this window; check local storage.',
    'Plano Mestre de Produção':'Master Production Plan','Previsão de vendas':'Sales forecast',
    'Custos de Produção':'Production Costs','Mão de obra':'Labour','Nova Inspeção de Qualidade':'New Quality Inspection',
    'Roteirização':'Routing','Satélite':'Satellite','Minha localização':'My location','Localização selecionada':'Selected location',
    'Localização':'Location','Distância rodoviária:':'Road distance:','Não foi possível calcular a rota.':'Could not calculate the route.',
    'Transferência direta':'Direct transfer','Expedição':'Dispatch','Descrição do risco':'Risk description',
    'Estratégia de mitigação':'Mitigation strategy','Ver histórico':'View history','Degradação por':'Degradation by',
    'Lead disponível no CRM para acompanhamento.':'Lead available in CRM for follow-up.',
    'Assistência técnica':'Technical support','Empresa de Demonstração':'Demo Company',
    'Sessão iniciada. Gmail confirmado e palavra-passe validada.':'Session started. Gmail confirmed and password validated.',
    'Sessão iniciada. Os seus dados estão disponíveis no espaço de trabalho.':'Session started. Your data is available in the workspace.',
    'Não foi possível validar o acesso. Confirme o Gmail e verifique a palavra-passe.':'Could not verify access. Confirm your Gmail and check the password.',
    'A preparar o relatório contabilístico...':'Preparing accounting report...',
    'Débito acumulado':'Accumulated debit','Crédito acumulado':'Accumulated credit','Débito período':'Period debit',
    'Crédito período':'Period credit','Ordem/analítica':'Order / analytical account','Resultado líquido':'Net income',
    'Capital próprio':'Equity','Diferença':'Difference','Não existem linhas para exportar neste separador.':'There are no rows to export in this tab.',
    'Seleccione um período válido para o SAF-T.':'Select a valid period for SAF-T.',
    'XML exportado. Estado pré-certificação: número de validação AGT ainda não configurado.':'XML exported. Pre-certification status: AGT validation number has not been configured.',
    'Débito (Kz)':'Debit (Kz)','Crédito (Kz)':'Credit (Kz)','Retenção na fonte — Grupo B/C':'Withholding tax — Group B/C',
    'Matéria colectável não sujeita a retenção — Grupo B/C':'Taxable amount not subject to withholding — Group B/C',
    'Auto-facturação — Grupo B':'Self-billing — Group B','Auto-facturação — Grupo C':'Self-billing — Group C',
    'Rascunho de retenção IRT guardado no servidor.':'IRT withholding draft saved on the server.',
    'Não foi possível guardar o rascunho IRT B/C.':'Could not save the IRT B/C draft.',
    'Rascunho de IVA guardado com cálculo exacto em cêntimos.':'VAT draft saved with exact cent-based calculation.',
    'Não foi possível guardar o rascunho IVA.':'Could not save the VAT draft.',
    'Não existem funcionários para calcular o IRT.':'There are no employees for IRT calculation.',
    'Não foi possível guardar o rascunho IRT.':'Could not save the IRT draft.',
    'Denominação legal':'Legal name','Lançamentos contabilísticos confirmados':'Confirmed accounting entries',
    'Preparação SAF-T AO':'SAF-T AO preparation','Sessão cloud não confirmada':'Cloud session not confirmed',
    'Natureza jurídica':'Legal form','Data da certidão':'Certificate date','Validade da certidão':'Certificate validity',
    'N.º alvará/licença':'Permit / license number','Tipo de alvará':'Permit type','Emissão alvará':'Permit issue date',
    'Validade alvará':'Permit validity','Pedido de ausência':'Leave request','Férias, Licenças e Dispensas':'Holidays, Leave and Absences',
    'Reunião':'Meeting','Título, local ou responsável':'Title, location or person responsible','Orçamento criado.':'Budget created.'
  });

  let locale = 'pt';
  let observer = null;
  let preferenceLoaded = false;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  function translate(value) {
    const dictionary = catalogs[locale] || {};
    return dictionary[value] || (locale !== 'pt' ? (catalogs.en[value] || value) : value);
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
      '<p class="text-muted">Português · English · Français · Español · 中文（普通话） · العربية · Lingála · Cokwe (Chokwe)</p>' +
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