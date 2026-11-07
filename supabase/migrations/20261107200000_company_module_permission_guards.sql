
-- Central server-side role defaults and restrictive module guards for all company-scoped data.
CREATE TABLE IF NOT EXISTS private.ks_role_module_defaults (
  role text NOT NULL,
  module_id text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  can_cancel boolean NOT NULL DEFAULT false,
  can_configure boolean NOT NULL DEFAULT false,
  PRIMARY KEY(role,module_id)
);
REVOKE ALL ON private.ks_role_module_defaults FROM PUBLIC,anon,authenticated;

INSERT INTO private.ks_role_module_defaults(role,module_id,can_view,can_create,can_edit,can_delete,can_export,can_approve,can_cancel,can_configure)
VALUES
('manager','dashboard',true,true,true,false,true,true,true,false),
('manager','pdv',true,true,true,false,true,true,true,false),
('manager','vendas',true,true,true,false,true,true,true,false),
('manager','produtos',true,true,true,false,true,true,true,false),
('manager','categorias',true,true,true,false,true,true,true,false),
('manager','ecommerce',true,true,true,false,true,true,true,false),
('manager','estoque',true,true,true,false,true,true,true,false),
('manager','compras',true,true,true,false,true,true,true,false),
('manager','clientes',true,true,true,false,true,true,true,false),
('manager','fornecedores',true,true,true,false,true,true,true,false),
('manager','crm',true,true,true,false,true,true,true,false),
('manager','financeiro',true,true,true,false,true,true,true,false),
('manager','fiscal',true,true,true,false,true,true,true,false),
('manager','contabilidade',true,true,true,false,true,true,true,false),
('manager','rh',true,true,true,false,true,true,true,false),
('manager','projetos',true,true,true,false,true,true,true,false),
('manager','tarefas',true,true,true,false,true,true,true,false),
('manager','ativos',true,true,true,false,true,true,true,false),
('manager','frota',true,true,true,false,true,true,true,false),
('manager','os',true,true,true,false,true,true,true,false),
('manager','documentos',true,true,true,false,true,true,true,false),
('manager','relatorios',true,true,true,false,true,true,true,false),
('manager','notificacoes',true,true,true,false,true,true,true,false),
('manager','orcamentos',true,true,true,false,true,true,true,false),
('manager','transportadoras',true,true,true,false,true,true,true,false),
('manager','contratos',true,true,true,false,true,true,true,false),
('manager','tickets',true,true,true,false,true,true,true,false),
('manager','perfil',true,true,true,false,true,true,true,false),
('manager','dispositivos',true,true,true,false,true,true,true,false),
('manager','producao',true,true,true,false,true,true,true,false),
('manager','ordens-producao',true,true,true,false,true,true,true,false),
('manager','mrp',true,true,true,false,true,true,true,false),
('manager','bom',true,true,true,false,true,true,true,false),
('manager','custos-producao',true,true,true,false,true,true,true,false),
('manager','controle-qualidade',true,true,true,false,true,true,true,false),
('manager','planos-producao',true,true,true,false,true,true,true,false),
('manager','logistica-roteirizacao',true,true,true,false,true,true,true,false),
('manager','logistica-etiquetas',true,true,true,false,true,true,true,false),
('manager','logistica-picking',true,true,true,false,true,true,true,false),
('manager','logistica-armazens',true,true,true,false,true,true,true,false),
('manager','logistica-crossdocking',true,true,true,false,true,true,true,false),
('manager','logistica-rastreio',true,true,true,false,true,true,true,false),
('manager','ecommerce-vitrine',true,true,true,false,true,true,true,false),
('manager','ecommerce-carrinho',true,true,true,false,true,true,true,false),
('manager','ecommerce-pedidos',true,true,true,false,true,true,true,false),
('manager','ecommerce-produtos',true,true,true,false,true,true,true,false),
('manager','ecommerce-pagamento',true,true,true,false,true,true,true,false),
('manager','ecommerce-rastreio',true,true,true,false,true,true,true,false),
('manager','rh-recrutamento',true,true,true,false,true,true,true,false),
('manager','rh-desempenho',true,true,true,false,true,true,true,false),
('manager','rh-beneficios',true,true,true,false,true,true,true,false),
('manager','rh-onboarding',true,true,true,false,true,true,true,false),
('manager','rh-ponto',true,true,true,false,true,true,true,false),
('manager','rh-rescisao',true,true,true,false,true,true,true,false),
('manager','rh-plano-carreira',true,true,true,false,true,true,true,false),
('manager','projetos-tarefas',true,true,true,false,true,true,true,false),
('manager','projetos-kanban',true,true,true,false,true,true,true,false),
('manager','projetos-gantt',true,true,true,false,true,true,true,false),
('manager','projetos-recursos',true,true,true,false,true,true,true,false),
('manager','projetos-timesheet',true,true,true,false,true,true,true,false),
('manager','projetos-custos',true,true,true,false,true,true,true,false),
('manager','projetos-riscos',true,true,true,false,true,true,true,false),
('manager','ativos-depreciacao',true,true,true,false,true,true,true,false),
('manager','ativos-manutencao',true,true,true,false,true,true,true,false),
('manager','ativos-garantia',true,true,true,false,true,true,true,false),
('manager','frota-manutencao',true,true,true,false,true,true,true,false),
('manager','frota-rotas',true,true,true,false,true,true,true,false),
('manager','frota-gps',true,true,true,false,true,true,true,false),
('manager','frota-combustivel',true,true,true,false,true,true,true,false),
('manager','frota-documentos',true,true,true,false,true,true,true,false),
('manager','frota-multas',true,true,true,false,true,true,true,false),
('manager','frota-desempenho',true,true,true,false,true,true,true,false),
('manager','os-manutencao',true,true,true,false,true,true,true,false),
('manager','os-checklist',true,true,true,false,true,true,true,false),
('manager','os-calendario',true,true,true,false,true,true,true,false),
('manager','os-tecnicos',true,true,true,false,true,true,true,false),
('manager','produtos-avaliacoes',true,true,true,false,true,true,true,false),
('manager','tabelas-precos',true,true,true,false,true,true,true,false),
('manager','vendas-consignadas',true,true,true,false,true,true,true,false),
('manager','vendas-promocoes',true,true,true,false,true,true,true,false),
('manager','clientes-fidelidade',true,true,true,false,true,true,true,false),
('manager','clientes-cupons',true,true,true,false,true,true,true,false),
('manager','portal-cliente',true,true,true,false,true,true,true,false),
('manager','clientes-segmentacao',true,true,true,false,true,true,true,false),
('manager','crm-pipeline',true,true,true,false,true,true,true,false),
('manager','crm-automacao',true,true,true,false,true,true,true,false),
('manager','crm-score',true,true,true,false,true,true,true,false),
('manager','crm-remarketing',true,true,true,false,true,true,true,false),
('manager','marketing-campanhas',true,true,true,false,true,true,true,false),
('manager','marketing-analise',true,true,true,false,true,true,true,false),
('manager','empresa-legal',true,true,true,false,true,true,true,false),
('manager','despesas-gerais',true,true,true,false,true,true,true,false),
('manager','ferias-dispensas',true,true,true,false,true,true,true,false),
('manager','agenda',true,true,true,false,true,true,true,false),
('manager','reunioes',true,true,true,false,true,true,true,false),
('manager','comunicacao',true,true,true,false,true,true,true,false),
('manager','aprovacoes-empresa',true,true,true,false,true,true,true,false),
('manager','departamentos-empresa',true,true,true,false,true,true,true,false),
('manager','orcamento-empresa',true,true,true,false,true,true,true,false),
('manager','rh-documentos',true,true,true,false,true,true,true,false),
('manager','folha-salarial',true,true,true,false,true,true,true,false),
('manager','elearning-cursos',true,true,true,false,true,true,true,false),
('manager','elearning-certificacoes',true,true,true,false,true,true,true,false),
('manager','elearning-quizzes',true,true,true,false,true,true,true,false),
('manager','elearning-progresso',true,true,true,false,true,true,true,false),
('manager','elearning-relatorios',true,true,true,false,true,true,true,false),
('manager','servicos',true,true,true,false,true,true,true,false),
('cashier','pdv',true,true,true,false,false,false,false,false),
('cashier','vendas',true,true,true,false,true,false,false,false),
('cashier','clientes',true,true,true,false,false,false,false,false),
('cashier','notificacoes',true,false,false,false,false,false,false,false),
('cashier','perfil',true,false,false,false,false,false,false,false),
('cashier','ecommerce-vitrine',true,false,false,false,false,false,false,false),
('cashier','ecommerce-carrinho',true,true,true,false,false,false,false,false),
('cashier','ecommerce-pedidos',true,true,true,false,false,false,false,false),
('operator','dashboard',true,false,false,false,false,false,false,false),
('operator','pdv',true,true,true,false,false,false,false,false),
('operator','vendas',true,true,true,false,false,false,false,false),
('operator','produtos',true,true,true,false,false,false,false,false),
('operator','clientes',true,false,false,false,false,false,false,false),
('operator','estoque',true,true,true,false,false,false,false,false),
('operator','notificacoes',true,false,false,false,false,false,false,false),
('operator','perfil',true,false,false,false,false,false,false,false),
('operator','producao',true,true,true,false,false,false,false,false),
('operator','ordens-producao',true,true,true,false,false,false,false,false),
('operator','controle-qualidade',true,true,true,false,false,false,false,false),
('operator','os',true,true,true,false,false,false,false,false),
('operator','os-manutencao',true,true,true,false,false,false,false,false),
('operator','os-checklist',true,true,true,false,false,false,false,false),
('operator','os-calendario',true,true,true,false,false,false,false,false),
('operator','agenda',true,true,true,false,false,false,false,false),
('operator','reunioes',true,true,true,false,false,false,false,false),
('operator','comunicacao',true,true,true,false,false,false,false,false),
('operator','ferias-dispensas',true,true,true,false,false,false,false,false),
('operator','projetos-tarefas',true,true,true,false,false,false,false,false),
('operator','projetos-kanban',true,true,true,false,false,false,false,false),
('operator','tarefas',true,true,true,false,false,false,false,false),
('accountant','dashboard',true,false,false,false,false,false,false,false),
('accountant','contabilidade',true,true,true,false,true,true,false,false),
('accountant','fiscal',true,true,true,false,true,true,false,false),
('accountant','financeiro',true,true,true,false,true,true,false,false),
('accountant','relatorios',true,true,true,false,true,false,false,false),
('accountant','documentos',true,false,false,false,true,false,false,false),
('accountant','auditoria',true,false,false,false,false,false,false,false),
('accountant','perfil',true,false,false,false,false,false,false,false),
('accountant','ativos',true,true,true,false,false,false,false,false),
('accountant','orcamentos',true,true,true,false,false,false,false,false),
('accountant','folha-salarial',true,true,true,false,false,false,false,false),
('accountant','despesas-gerais',true,true,true,false,false,false,false,false),
('accountant','notificacoes',true,false,false,false,false,false,false,false),
('accountant','vendas',true,false,false,false,false,false,false,false),
('accountant','compras',true,false,false,false,false,false,false,false),
('accountant','produtos',true,false,false,false,false,false,false,false),
('accountant','clientes',true,false,false,false,false,false,false,false),
('accountant','fornecedores',true,false,false,false,false,false,false,false),
('accountant','estoque',true,false,false,false,false,false,false,false)
ON CONFLICT(role,module_id) DO UPDATE SET
  can_view=excluded.can_view,can_create=excluded.can_create,can_edit=excluded.can_edit,
  can_delete=excluded.can_delete,can_export=excluded.can_export,can_approve=excluded.can_approve,
  can_cancel=excluded.can_cancel,can_configure=excluded.can_configure;

CREATE OR REPLACE FUNCTION private.ks_has_company_permission(
  p_company_id uuid,p_module text,p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_role text; v_permissions jsonb; v_override jsonb; v_enabled boolean;
  v_module text:=lower(trim(coalesce(p_module,'')));
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_allowed boolean;
BEGIN
  IF private.ks_is_platform_admin() THEN RETURN true; END IF;
  SELECT lower(coalesce(m.role,'')),coalesce(m.permissions,'{}'::jsonb)
    INTO v_role,v_permissions
  FROM public.ks_company_memberships m
  WHERE m.company_id=p_company_id AND m.user_id=auth.uid() AND m.status='active'
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_role IN ('owner','admin') THEN RETURN true; END IF;
  IF v_role='gerente' THEN v_role:='manager'; END IF;
  IF v_role='contabilista' THEN v_role:='accountant'; END IF;
  IF v_role='operador' THEN v_role:='operator'; END IF;
  IF v_role='caixa' THEN v_role:='cashier'; END IF;

  -- Sensitive administration modules can never be delegated through a JSON override.
  IF v_module IN ('usuarios','modulos','integracoes','licenca','config') THEN RETURN false; END IF;
  IF v_action IN ('configure','configuration') THEN v_action:='configurar'; END IF;
  IF v_action IN ('view','read') THEN v_action:='ver'; END IF;
  IF v_action='create' THEN v_action:='criar'; END IF;
  IF v_action='edit' THEN v_action:='editar'; END IF;
  IF v_action='delete' THEN v_action:='excluir'; END IF;
  IF v_action='export' THEN v_action:='exportar'; END IF;
  IF v_action='approve' THEN v_action:='aprovar'; END IF;
  IF v_action='cancel' THEN v_action:='cancelar'; END IF;

  SELECT s.enabled INTO v_enabled FROM public.ks_company_module_settings s
  WHERE s.company_id=p_company_id AND s.module_id=v_module;
  IF v_enabled IS FALSE THEN RETURN false; END IF;

  v_override:=v_permissions #> ARRAY['modules',v_module,v_action];
  IF v_override IS NULL THEN v_override:=v_permissions #> ARRAY[v_module,v_action]; END IF;
  IF v_override IS NOT NULL AND jsonb_typeof(v_override)='boolean' THEN
    RETURN (v_override::text)::boolean;
  END IF;
  SELECT CASE v_action
    WHEN 'ver' THEN d.can_view
    WHEN 'criar' THEN d.can_create
    WHEN 'editar' THEN d.can_edit
    WHEN 'excluir' THEN d.can_delete
    WHEN 'exportar' THEN d.can_export
    WHEN 'aprovar' THEN d.can_approve
    WHEN 'cancelar' THEN d.can_cancel
    WHEN 'configurar' THEN d.can_configure
    ELSE false END
  INTO v_allowed
  FROM private.ks_role_module_defaults d
  WHERE d.role=v_role AND d.module_id=v_module;
  RETURN coalesce(v_allowed,false);
END;
$function$;

CREATE OR REPLACE FUNCTION private.ks_company_table_module(p_table_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
  SELECT CASE p_table_name
    WHEN 'ks_approval_requests' THEN 'aprovacoes-empresa'
    WHEN 'ks_approval_steps' THEN 'aprovacoes-empresa'
    WHEN 'ks_approval_workflows' THEN 'aprovacoes-empresa'
    WHEN 'ks_assets' THEN 'ativos'
    WHEN 'ks_attendance' THEN 'rh-ponto'
    WHEN 'ks_audit_events' THEN 'auditoria'
    WHEN 'ks_automation_rules' THEN 'crm-automacao'
    WHEN 'ks_bank_accounts' THEN 'financeiro'
    WHEN 'ks_bank_reconciliations' THEN 'financeiro'
    WHEN 'ks_budget_lines' THEN 'orcamentos'
    WHEN 'ks_budgets' THEN 'orcamentos'
    WHEN 'ks_calendar_events' THEN 'agenda'
    WHEN 'ks_chart_of_accounts' THEN 'contabilidade'
    WHEN 'ks_communication_channels' THEN 'comunicacao'
    WHEN 'ks_company_documents' THEN 'documentos'
    WHEN 'ks_company_legal_profiles' THEN 'empresa-legal'
    WHEN 'ks_company_licenses' THEN 'licenca'
    WHEN 'ks_company_parties' THEN 'empresa-legal'
    WHEN 'ks_compliance_tasks' THEN 'conformidade'
    WHEN 'ks_connector_events' THEN 'integracoes'
    WHEN 'ks_connector_registry' THEN 'integracoes'
    WHEN 'ks_cost_centers' THEN 'contabilidade'
    WHEN 'ks_customer_addresses' THEN 'clientes'
    WHEN 'ks_customers' THEN 'clientes'
    WHEN 'ks_delivery_events' THEN 'logistica-roteirizacao'
    WHEN 'ks_delivery_routes' THEN 'logistica-roteirizacao'
    WHEN 'ks_departments' THEN 'departamentos-empresa'
    WHEN 'ks_ecommerce_api_keys' THEN 'integracoes'
    WHEN 'ks_ecommerce_orders' THEN 'ecommerce-pedidos'
    WHEN 'ks_ecommerce_stores' THEN 'ecommerce-vitrine'
    WHEN 'ks_ecommerce_webhooks' THEN 'integracoes'
    WHEN 'ks_employee_compensation_history' THEN 'folha-salarial'
    WHEN 'ks_employee_documents' THEN 'rh-documentos'
    WHEN 'ks_employees' THEN 'folha-salarial'
    WHEN 'ks_exchange_rates' THEN 'financeiro'
    WHEN 'ks_expenses' THEN 'despesas-gerais'
    WHEN 'ks_general_expenses' THEN 'despesas-gerais'
    WHEN 'ks_installations' THEN 'os'
    WHEN 'ks_internal_messages' THEN 'comunicacao'
    WHEN 'ks_journal_entries' THEN 'contabilidade'
    WHEN 'ks_journal_lines' THEN 'contabilidade'
    WHEN 'ks_knowledge_articles' THEN 'elearning-cursos'
    WHEN 'ks_leave_balances' THEN 'ferias-dispensas'
    WHEN 'ks_leave_requests' THEN 'ferias-dispensas'
    WHEN 'ks_leave_types' THEN 'ferias-dispensas'
    WHEN 'ks_legal_register' THEN 'empresa-legal'
    WHEN 'ks_license_activation_audit' THEN 'licenca'
    WHEN 'ks_license_usage_daily' THEN 'licenca'
    WHEN 'ks_maintenance_orders' THEN 'os-manutencao'
    WHEN 'ks_maintenance_plans' THEN 'os-manutencao'
    WHEN 'ks_manufacturing_routings' THEN 'producao'
    WHEN 'ks_marketing_campaigns' THEN 'marketing-campanhas'
    WHEN 'ks_marketing_leads' THEN 'marketing-campanhas'
    WHEN 'ks_marketing_messages' THEN 'marketing-campanhas'
    WHEN 'ks_marketing_segments' THEN 'marketing-campanhas'
    WHEN 'ks_marketing_templates' THEN 'marketing-campanhas'
    WHEN 'ks_meeting_attendees' THEN 'reunioes'
    WHEN 'ks_meetings' THEN 'reunioes'
    WHEN 'ks_payment_requests' THEN 'financeiro'
    WHEN 'ks_payment_transactions' THEN 'financeiro'
    WHEN 'ks_payroll_items' THEN 'folha-salarial'
    WHEN 'ks_payroll_runs' THEN 'folha-salarial'
    WHEN 'ks_products' THEN 'produtos'
    WHEN 'ks_project_tasks' THEN 'projetos-tarefas'
    WHEN 'ks_projects' THEN 'projetos'
    WHEN 'ks_purchase_items' THEN 'compras'
    WHEN 'ks_purchase_orders' THEN 'compras'
    WHEN 'ks_quotation_items' THEN 'vendas'
    WHEN 'ks_quotations' THEN 'vendas'
    WHEN 'ks_records' THEN 'documentos'
    WHEN 'ks_sale_items' THEN 'vendas'
    WHEN 'ks_sales' THEN 'vendas'
    WHEN 'ks_sales_returns' THEN 'vendas'
    WHEN 'ks_service_orders' THEN 'os'
    WHEN 'ks_shared_files' THEN 'documentos'
    WHEN 'ks_stock_movements' THEN 'estoque'
    WHEN 'ks_suppliers' THEN 'fornecedores'
    WHEN 'ks_support_tickets' THEN 'tickets'
    WHEN 'ks_tax_return_lines' THEN 'fiscal'
    WHEN 'ks_tax_returns' THEN 'fiscal'
    WHEN 'ks_tax_rules' THEN 'fiscal'
    WHEN 'ks_vehicles' THEN 'frota'
    WHEN 'ks_warehouses' THEN 'estoque'
    WHEN 'ks_work_centers' THEN 'producao'
    ELSE NULL END;
$function$;

-- Keep the audit trail writable by operational users, but restrict reading to the audit module.
DROP POLICY IF EXISTS mg_ks_audit_events_sel ON public.ks_audit_events;
CREATE POLICY mg_ks_audit_events_sel ON public.ks_audit_events AS RESTRICTIVE
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'auditoria','ver'));

-- Add restrictive guards without replacing existing row-level rules.
DO $$
DECLARE r record; v_module text; v_name text;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
      AND EXISTS (SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema='public' AND col.table_name=c.relname AND col.column_name='company_id')
      AND private.ks_company_table_module(c.relname) IS NOT NULL
      AND c.relname<>'ks_audit_events'
  LOOP
    v_module:=private.ks_company_table_module(r.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.relname);

    v_name:='mg_'||r.relname||'_sel';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_name,r.relname);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,%L,''ver''))',v_name,r.relname,v_module);

    v_name:='mg_'||r.relname||'_ins';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_name,r.relname);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,%L,''criar''))',v_name,r.relname,v_module);

    v_name:='mg_'||r.relname||'_upd';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_name,r.relname);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,%L,''editar'')) WITH CHECK (private.ks_has_company_permission(company_id,%L,''editar''))',v_name,r.relname,v_module,v_module);

    v_name:='mg_'||r.relname||'_del';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_name,r.relname);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,%L,''excluir''))',v_name,r.relname,v_module);
  END LOOP;
END $$;
