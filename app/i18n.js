(function () {
  'use strict';

  const SUPPORTED = ['pt', 'en', 'fr', 'es'];
  const LANGUAGE_NAMES = { pt: 'Português (Angola)', en: 'English', fr: 'Français', es: 'Español' };
  const HTML_LOCALES = { pt: 'pt-AO', en: 'en', fr: 'fr', es: 'es' };
  // Keep "pt" as the stored compatibility code while accepting the explicit BCP 47 tag.
  const LOCALE_ALIASES = { 'pt-AO': 'pt', 'pt-ao': 'pt', 'pt_ao': 'pt' };
  function normalizeLocale(code) {
    const value = String(code || '').trim();
    const canonical = LOCALE_ALIASES[value] || LOCALE_ALIASES[value.toLowerCase()] || value;
    return SUPPORTED.includes(canonical) ? canonical : null;
  }

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


  // Standalone compliance and integration workspaces.
  Object.assign(catalogs.en, {
    'Conformidade e legislação':'Compliance and legislation',
    'Registo de diplomas, políticas internas e tarefas de conformidade.':'Register legislation, internal policies and compliance tasks.',
    'Atenção:':'Attention:','A carregar referências…':'Loading references…',
    'Termos de utilização — resumo da minuta':'Terms of use — draft summary',
    'O cliente é responsável pelos dados e pelas permissões dos seus utilizadores.':'The customer is responsible for its data and user permissions.',
    'As credenciais de integrações só podem ser usadas em contas que a empresa controla ou está autorizada a gerir.':'Integration credentials may only be used for accounts the company controls or is authorised to manage.',
    'O utilizador deve proteger códigos de autenticação e comunicar incidentes.':'Users must protect authentication codes and report incidents.',
    'O ERP fornece ferramentas de apoio e não substitui a validação contabilística, fiscal ou jurídica.':'The ERP provides support tools and does not replace accounting, tax or legal validation.',
    'É proibido utilizar o sistema para fraude, spam ou tratamento ilícito de dados.':'The system must not be used for fraud, spam or unlawful data processing.',
    'Preços, limites, disponibilidade e suporte devem constar do contrato comercial aplicável.':'Prices, limits, availability and support must be stated in the applicable commercial agreement.',
    'Política de privacidade — requisitos':'Privacy policy — requirements',
    'Identificar o responsável pelo tratamento e os seus contactos reais.':'Identify the data controller and its actual contact details.',
    'Definir prazos de retenção, eliminação, cópias e resposta aos direitos dos titulares.':'Define retention, deletion, backup and data-subject request periods.',
    'Documentar segurança, acessos, incidentes e transferências internacionais.':'Document security, access, incidents and international transfers.',
    'Para marketing, documentar autorização/base legal e mecanismos de oposição.':'For marketing, document consent/legal basis and opt-out mechanisms.',
    'Entrada + saída':'Inbound + outbound','Próxima fase':'Next phase','Centro de Integrações | Kanawa Soft':'Integration Centre | Kanawa Soft',
    'Centro de Integrações':'Integration Centre','Segurança:':'Security:','A validar sessão e empresa…':'Validating session and company…',
    'ID da aplicação':'Application ID','Introduza o segredo da aplicação':'Enter the application secret',
    'ID do número WhatsApp':'WhatsApp phone number ID','Token de verificação':'Verification token',
    'Identificador ou chave pública':'Identifier or public key','Segredo para validar notificações':'Secret for validating notifications',
    'Versão da API (opcional)':'API version (optional)',
    'Gere uma chave para ligar uma loja externa ao Kanawa Soft. A chave completa só aparece uma vez.':'Generate a key to connect an external store to Kanawa Soft. The full key is shown only once.',
    'Nome da integração':'Integration name','Ler catálogo':'Read catalogue','Copie agora — não será mostrada novamente.':'Copy it now — it will not be shown again.',
    'Conectores e automações':'Connectors and automations',
    'Arquitetura preparada para receber ligações de entrada e saída.':'Architecture prepared for inbound and outbound connections.',
    'Direção':'Direction','Base preparada para explicações guiadas por módulo, procedimentos e ajuda contextual.':'Foundation prepared for module-guided explanations, procedures and contextual help.',
    'Guias de utilização por módulo.':'User guides by module.','Explicação de indicadores e fórmulas.':'Explanation of indicators and formulas.',
    'Sugestões de configuração e melhoria.':'Configuration and improvement suggestions.',
    'Respeito pelas permissões da empresa e do utilizador.':'Respect for company and user permissions.',
    'Kanawa Soft · As credenciais não devem ser partilhadas por chat, email ou capturas de ecrã.':'Kanawa Soft · Credentials must not be shared through chat, email or screenshots.',
    'Ligações guardadas':'Saved connections','Ainda não existem credenciais guardadas.':'No credentials have been saved yet.'
  });
  Object.assign(catalogs.fr, {
    'Conformidade e legislação':'Conformité et législation',
    'Registo de diplomas, políticas internas e tarefas de conformidade.':'Enregistrement des textes, politiques internes et tâches de conformité.',
    'Atenção:':'Attention :','A carregar referências…':'Chargement des références…',
    'Termos de utilização — resumo da minuta':'Conditions d’utilisation — résumé du projet',
    'O cliente é responsável pelos dados e pelas permissões dos seus utilizadores.':'Le client est responsable de ses données et des autorisations de ses utilisateurs.',
    'As credenciais de integrações só podem ser usadas em contas que a empresa controla ou está autorizada a gerir.':'Les identifiants d’intégration ne peuvent être utilisés que pour des comptes contrôlés ou gérés avec autorisation par l’entreprise.',
    'O utilizador deve proteger códigos de autenticação e comunicar incidentes.':'L’utilisateur doit protéger les codes d’authentification et signaler les incidents.',
    'O ERP fornece ferramentas de apoio e não substitui a validação contabilística, fiscal ou jurídica.':'L’ERP fournit des outils d’assistance et ne remplace pas la validation comptable, fiscale ou juridique.',
    'É proibido utilizar o sistema para fraude, spam ou tratamento ilícito de dados.':'Il est interdit d’utiliser le système à des fins de fraude, de spam ou de traitement illicite des données.',
    'Preços, limites, disponibilidade e suporte devem constar do contrato comercial aplicável.':'Les prix, limites, disponibilités et services d’assistance doivent figurer dans le contrat commercial applicable.',
    'Política de privacidade — requisitos':'Politique de confidentialité — exigences',
    'Identificar o responsável pelo tratamento e os seus contactos reais.':'Identifier le responsable du traitement et ses coordonnées réelles.',
    'Definir prazos de retenção, eliminação, cópias e resposta aos direitos dos titulares.':'Définir les délais de conservation, suppression, sauvegarde et réponse aux droits des personnes.',
    'Documentar segurança, acessos, incidentes e transferências internacionais.':'Documenter la sécurité, les accès, les incidents et les transferts internationaux.',
    'Para marketing, documentar autorização/base legal e mecanismos de oposição.':'Pour le marketing, documenter le consentement/la base légale et les mécanismes d’opposition.',
    'Entrada + saída':'Entrée + sortie','Próxima fase':'Prochaine étape','Centro de Integrações | Kanawa Soft':'Centre d’intégrations | Kanawa Soft',
    'Centro de Integrações':'Centre d’intégrations','Segurança:':'Sécurité :','A validar sessão e empresa…':'Vérification de la session et de l’entreprise…',
    'ID da aplicação':'ID de l’application','Introduza o segredo da aplicação':'Saisissez le secret de l’application',
    'ID do número WhatsApp':'ID du numéro WhatsApp','Token de verificação':'Jeton de vérification',
    'Identificador ou chave pública':'Identifiant ou clé publique','Segredo para validar notificações':'Secret de validation des notifications',
    'Versão da API (opcional)':'Version de l’API (facultatif)',
    'Nome da integração':'Nom de l’intégration','Ler catálogo':'Lire le catalogue',
    'Conectores e automações':'Connecteurs et automatisations','Direção':'Direction',
    'Guias de utilização por módulo.':'Guides d’utilisation par module.','Explicação de indicadores e fórmulas.':'Explication des indicateurs et des formules.',
    'Sugestões de configuração e melhoria.':'Suggestions de configuration et d’amélioration.',
    'Ligações guardadas':'Connexions enregistrées','Ainda não existem credenciais guardadas.':'Aucun identifiant n’a encore été enregistré.'
  });
  Object.assign(catalogs.es, {
    'Conformidade e legislação':'Cumplimiento y legislación',
    'Registo de diplomas, políticas internas e tarefas de conformidade.':'Registro de leyes, políticas internas y tareas de cumplimiento.',
    'Atenção:':'Atención:','A carregar referências…':'Cargando referencias…',
    'Termos de utilização — resumo da minuta':'Condiciones de uso — resumen del borrador',
    'O cliente é responsável pelos dados e pelas permissões dos seus utilizadores.':'El cliente es responsable de sus datos y de los permisos de sus usuarios.',
    'As credenciais de integrações só podem ser usadas em contas que a empresa controla ou está autorizada a gerir.':'Las credenciales de integración solo pueden utilizarse en cuentas que la empresa controla o está autorizada a gestionar.',
    'O utilizador deve proteger códigos de autenticação e comunicar incidentes.':'El usuario debe proteger los códigos de autenticación y comunicar los incidentes.',
    'O ERP fornece ferramentas de apoio e não substitui a validação contabilística, fiscal ou jurídica.':'El ERP ofrece herramientas de apoyo y no sustituye la validación contable, fiscal o jurídica.',
    'É proibido utilizar o sistema para fraude, spam ou tratamento ilícito de dados.':'Está prohibido utilizar el sistema para fraude, spam o tratamiento ilícito de datos.',
    'Preços, limites, disponibilidade e suporte devem constar do contrato comercial aplicável.':'Los precios, límites, disponibilidad y soporte deben constar en el contrato comercial aplicable.',
    'Política de privacidade — requisitos':'Política de privacidad — requisitos',
    'Identificar o responsável pelo tratamento e os seus contactos reais.':'Identificar al responsable del tratamiento y sus datos de contacto reales.',
    'Definir prazos de retenção, eliminação, cópias e resposta aos direitos dos titulares.':'Definir plazos de conservación, eliminación, copias de seguridad y respuesta a los derechos de los interesados.',
    'Documentar segurança, acessos, incidentes e transferências internacionais.':'Documentar seguridad, accesos, incidentes y transferencias internacionales.',
    'Para marketing, documentar autorização/base legal e mecanismos de oposição.':'Para marketing, documentar el consentimiento/base legal y los mecanismos de oposición.',
    'Entrada + saída':'Entrada + salida','Próxima fase':'Próxima fase','Centro de Integrações | Kanawa Soft':'Centro de Integraciones | Kanawa Soft',
    'Centro de Integrações':'Centro de Integraciones','Segurança:':'Seguridad:','A validar sessão e empresa…':'Validando sesión y empresa…',
    'ID da aplicação':'ID de la aplicación','Introduza o segredo da aplicação':'Introduzca el secreto de la aplicación',
    'ID do número WhatsApp':'ID del número de WhatsApp','Token de verificação':'Token de verificación',
    'Identificador ou chave pública':'Identificador o clave pública','Segredo para validar notificações':'Secreto para validar notificaciones',
    'Versão da API (opcional)':'Versión de API (opcional)',
    'Nome da integração':'Nombre de la integración','Ler catálogo':'Leer catálogo',
    'Conectores e automações':'Conectores y automatizaciones','Direção':'Dirección',
    'Guias de utilização por módulo.':'Guías de uso por módulo.','Explicação de indicadores e fórmulas.':'Explicación de indicadores y fórmulas.',
    'Sugestões de configuração e melhoria.':'Sugerencias de configuración y mejora.',
    'Ligações guardadas':'Conexiones guardadas','Ainda não existem credenciais guardadas.':'Todavía no hay credenciales guardadas.'
  });


  Object.assign(catalogs.en, {
    'Excel indisponível':'Excel support unavailable','Administrador de Demonstração':'Demo Administrator',
    'Imagem muito grande (máx 2MB)':'Image too large (max 2 MB)','Cartão':'Card','Transferência':'Transfer',
    'Descrição da conta':'Account description','Rectificação da factura':'Invoice adjustment',
    'erro de ligação':'connection error','Introduza uma matéria colectável válida.':'Enter a valid taxable amount.',
    'Chave criada, mas não enviada por email:':'Key created, but not emailed:',
    'configure o serviço de email.':'configure the email service.','Ordem de produção':'Production order',
    'Preço fixo':'Fixed price','operação(ões) offline pendente(s)':'pending offline operation(s)',
    'ainda pendentes. A fila só é enviada pela conta e empresa que originaram cada operação.':'still pending. The queue is sent only by the account and company that originated each operation.',
    'documento(s) expirado(s) ou a vencer nos próximos 30 dias. Consulte Empresa e Documentos Legais.':'document(s) expired or expiring within the next 30 days. Check Company and Legal Documents.',
    'Área de conteúdo do módulo. Use a roda do rato ou Page Up/Page Down para navegar.':'Module content area. Use the mouse wheel or Page Up/Page Down to navigate.',
    'Gráfico Kanawa:':'Kanawa chart:','sem custo histórico':'no historical cost',
    'Detecção nativa de impressoras:':'Native printer detection:',
    '🔍 A procurar impressoras e periféricos autorizados...':'🔍 Searching for authorised printers and peripherals...',
    'NOTA DE CRÉDITO:':'CREDIT NOTE:','Sessões e autorizações':'Sessions and authorisations',
    '. Solicite autorização para este valor.':'. Request authorisation for this amount.',
    '. Disponível:':'. Available:','📷 Câmera ativa':'📷 Camera active',
    '⚠️ Não cadastrado:':'⚠️ Not registered:','⚡ Cadastro Rápido':'⚡ Quick Add',
    '🏷️ Impressão em Lote':'🏷️ Batch Printing',
    'Nome, NIF, telefone, email ou município...':'Name, tax ID, phone, email or municipality...',
    'Rua, avenida, bairro, edifício...':'Street, avenue, neighbourhood, building...',
    'Área de trabalho do contabilista · Angola':'Accountant workspace · Angola',
    'Lançamento':'Journal entry','📄 Inventário exportado':'📄 Inventory exported',
    'funcionários':'employees','O valor ultrapassa o saldo ainda não rectificado da factura.':'The amount exceeds the invoice balance not yet adjusted.',
    'Rectificação / devolução referente à':'Adjustment / return relating to',
    '. O stock físico continua pendente de conferência.':'. Physical stock is still pending verification.',
    'Emitir Nota de Crédito (NC) —':'Issue Credit Note (CN) —',
    'O valor/IVA ultrapassa o saldo ainda não rectificado.':'The amount/VAT exceeds the balance not yet adjusted.',
    'Esta pró-forma não contém artigos. Abra a proposta, adicione produtos e guarde novamente.':'This pro forma contains no items. Open the quote, add products and save again.',
    'Não foi possível calcular o valor desta pró-forma. Confirme os preços e quantidades dos artigos.':'Could not calculate this pro forma total. Check item prices and quantities.',
    'Erro de ligação':'Connection error','Não foi possível criar o convite:':'Could not create the invitation:',
    'Telefone Auth confirmado; atualização do cadastro da empresa requer perfil de administrador.':'Auth phone confirmed; updating the company profile requires an administrator role.',
    'Cadastro da empresa ainda não sincronizado:':'Company profile not yet synchronised:',
    'A ligação central é gerida automaticamente pelo Kanawa Soft Cloud.':'The central connection is managed automatically by Kanawa Soft Cloud.',
    'O formulário de confirmação ainda não está pronto. Atualize a página e solicite um novo código.':'The confirmation form is not ready yet. Refresh the page and request a new code.',
    'Não foi possível criar a conta:':'Could not create the account:',
    'Nome exacto do material no catálogo':'Exact material name in the catalogue',
    'Fornecedor, ordem de produção, lote ou notas':'Supplier, production order, batch or notes',
    'inspeções':'inspections','capturada com precisão aproximada de':'captured with approximate accuracy of',
    'km · Duração estimada:':'km · Estimated duration:','min. Trânsito em tempo real não incluído neste cálculo.':'min. Real-time traffic is not included in this calculation.',
    'Base de dados local ainda não está inicializada.':'Local database has not been initialised yet.',
    'concluída':'completed','transferências executadas numa transação local única.':'transfers executed in a single local transaction.',
    'Falha durante transferência. Verifique o histórico antes de repetir:':'Transfer failed. Check the history before retrying:',
    'Ex.: CCTV, servidor, viatura, máquina':'E.g. CCTV, server, vehicle, machine',
    'Ex.: Instalação de CCTV':'E.g. CCTV installation','Sessão cloud:':'Cloud session:',
    'Código de acesso enviado por':'Access code sent by',
    'Seleccione um período válido para exportar.':'Select a valid period to export.',
    'Número':'Number','Não é seguro guardar a declaração: falta IVA discriminado nas vendas/notas de crédito ou compras.':'It is unsafe to save the return: itemised VAT is missing from sales/credit notes or purchases.',
    'Declaração fiscal —':'Tax return —',
    'seleccionado. Crie a conta e depois envie o comprovativo em Licença e Pacotes.':'selected. Create the account, then submit proof under License and Plans.',
    'Não foi possível carregar os dados legais:':'Could not load legal details:',
    'N.º publicação online GUE':'GUE online publication number','Data publicação GUE':'GUE publication date',
    'Link publicação GUE':'GUE publication link','Código de actividade':'Business activity code',
    'Licença:':'License:','Referência da operação':'Operation reference','mês(es)':'month(s)',
    'Total: orçamento sob consulta':'Total: quote on request',
    'Pedido de activação enviado para validação. Referência':'Activation request sent for validation. Reference',
    'Licença':'License','Chave inválida.':'Invalid key.','Acções':'Actions',
    'Agenda central indisponível:':'Central calendar unavailable:','Nome do orçamento:':'Budget name:',
    'Não foi possível criar orçamento.':'Could not create the budget.',
    'Não foi possível abrir o comprovativo.':'Could not open the proof document.',
    'Apenas o proprietário da plataforma pode gerar esta licença.':'Only the platform owner can generate this license.',
    'Chave vitalícia interna emitida':'Internal lifetime key issued','Vitalícia':'Lifetime',
    'Chave de licença emitida':'License key issued','Folha mensal, bónus, subsídios, IRT e INSS':'Monthly payroll, bonuses, allowances, IRT and INSS',
    'Taxa de imposto inválida. Use uma percentagem entre 0 e 100.':'Invalid tax rate. Use a percentage between 0 and 100.',
    'Quantidade e preço inválidos na linha':'Invalid quantity and price on row',
    'Logótipo da empresa':'Company logo','BOM excede a profundidade máxima de':'BOM exceeds the maximum depth of',
    'níveis.':'levels.','Componente da BOM não existe no catálogo:':'BOM component does not exist in the catalogue:',
    'Código do centro de trabalho':'Work centre code','Capacidade diária':'Daily capacity',
    'Já existe um centro de trabalho com este código.':'A work centre with this code already exists.',
    'Nome da operação':'Operation name','Tempo da operação':'Operation time',
    'Centro de trabalho não encontrado na operação':'Work centre not found in operation',
    'Não atribuído':'Unassigned','Duração da paragem':'Downtime duration','Lote de produção':'Production batch',
    'Produto da ordem não encontrado.':'Order product not found.',
    'Já existe um lote com este código para o produto.':'A batch with this code already exists for this product.',
    'Descrição da manutenção':'Maintenance description',
    'Centro de trabalho/equipamento não encontrado.':'Work centre/equipment not found.',
    'Data prevista inválida.':'Invalid planned date.',
    'O produto acabado e o componente devem existir no catálogo.':'The finished product and component must exist in the catalogue.',
    'Este componente já está registado na ficha técnica deste produto.':'This component is already registered in this product bill of materials.',
    'Produto acabado não encontrado no catálogo.':'Finished product not found in the catalogue.',
    'O produto ainda não tem ficha técnica (BOM).':'The product does not yet have a bill of materials (BOM).',
    'Inspecção inválida: aprovadas não podem exceder as inspeccionadas.':'Invalid inspection: approved quantity cannot exceed inspected quantity.',
    'Em execução':'In progress','Concluído':'Completed',
    'Equipa de projectos indisponível no serviço central:':'Project team unavailable in the central service:',
    'Sem título':'Untitled','Gestão de entregas, prazos, equipa e rentabilidade':'Delivery, deadlines, team and profitability management',
    'Ex.: 50% na adjudicação, 50% na entrega':'E.g. 50% on award, 50% on delivery',
    'Projecto criado com a referência':'Project created with reference',
    'Não associado':'Not linked','Adicione as etapas e tarefas de execução deste projecto.':'Add the project execution stages and tasks.',
    'Registe combustível, materiais, deslocações e outros custos directos.':'Record fuel, materials, travel and other direct costs.',
    'Atribuído em':'Assigned on','Técnico':'Technician',
    'Associe os técnicos e responsáveis deste projecto.':'Assign technicians and managers to this project.',
    'Ex.: combustível, cabos, consumíveis':'E.g. fuel, cables, consumables',
    'Número de registo':'Registration number','Faturação e design':'Billing and design',
    'Segurança e acesso':'Security and access','Sincronização e dados':'Synchronisation and data',
    'Código de acesso de seis dígitos':'Six-digit access code','Pesquisar módulos':'Search modules',
    'Área de trabalho pronta — abra um módulo no menu para começar':'Workspace ready — open a module from the menu to get started',
    'Kanawa: cache offline indisponível':'Kanawa: offline cache unavailable'
  });


  Object.assign(catalogs.en, {
    'Alguns conteúdos específicos podem permanecer em português enquanto as traduções são revistas.':'Some messages may still appear in English while translation review is being completed.'
  });
  Object.assign(catalogs.fr, {
    'A tradução ainda está em revisão; algumas mensagens podem permanecer em português ou inglês, sobretudo nos idiomas nacionais.':'Certains messages peuvent encore apparaître en anglais pendant la finalisation de la révision des traductions.'
  });
  Object.assign(catalogs.es, {
    'A tradução ainda está em revisão; algumas mensagens podem permanecer em português ou inglês, sobretudo nos idiomas nacionais.':'Algunos mensajes todavía pueden aparecer en inglés mientras se completa la revisión de las traducciones.'
  });

  // until reviewed vocabulary is available; do not substitute English or invented terms.



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
        let entry = saved[name];
        if (!entry) {
          entry = { source: current, lastApplied: current };
          saved[name] = entry;
        } else if (current !== entry.lastApplied) {
          entry.source = current;
        }
        const next = translate(entry.source);
        if (current !== next) element.setAttribute(name, next);
        entry.lastApplied = next;
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
    nextLocale = normalizeLocale(nextLocale);
    if (!nextLocale) return false;
    locale = nextLocale;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = HTML_LOCALES[locale];
      document.documentElement.dir = 'ltr';
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
    if (normalizeLocale(local)) setLanguage(local, { persist: false });
    if (window.KanawaCloud && KanawaCloud.ready && typeof KanawaCloud.getPreferredLanguage === 'function') {
      try {
        const remote = await KanawaCloud.getPreferredLanguage();
        if (normalizeLocale(remote)) setLanguage(remote, { persist: false });
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
      '<p class="text-muted">A tradução ainda está em revisão; algumas mensagens podem permanecer em português ou inglês, sobretudo nos idiomas nacionais.</p>' +
      '<p class="text-muted">Português (Angola) · English · Français · Español</p>' +
      '</section>';
  }

  function start() {
    let saved = 'pt';
    try { saved = localStorage.getItem('kanawa_language_v1') || 'pt'; } catch (_) {}
    setLanguage(normalizeLocale(saved) || 'pt', { persist: false });
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