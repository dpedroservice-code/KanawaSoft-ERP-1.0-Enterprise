-- Map generic client-side stores to their real ERP modules for row-level access control.
CREATE OR REPLACE FUNCTION private.ks_store_module(p_store_key text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
  SELECT CASE lower(coalesce(p_store_key,''))
    WHEN 'vendas' THEN 'vendas'
    WHEN 'produtos' THEN 'produtos'
    WHEN 'categorias' THEN 'produtos'
    WHEN 'unidades' THEN 'produtos'
    WHEN 'tabelasprecos' THEN 'tabelas-precos'
    WHEN 'clientes' THEN 'clientes'
    WHEN 'clientesportal' THEN 'portal-cliente'
    WHEN 'fornecedores' THEN 'fornecedores'
    WHEN 'compras' THEN 'compras'
    WHEN 'recebimentos' THEN 'compras'
    WHEN 'estoque' THEN 'estoque'
    WHEN 'movimentacoesestoque' THEN 'estoque'
    WHEN 'estoquearmazens' THEN 'logistica-armazens'
    WHEN 'armazens' THEN 'logistica-armazens'
    WHEN 'inventarios' THEN 'estoque'
    WHEN 'transferencias' THEN 'estoque'
    WHEN 'lotes' THEN 'estoque'
    WHEN 'pecasestoque' THEN 'estoque'
    WHEN 'contasreceber' THEN 'financeiro'
    WHEN 'contaspagar' THEN 'financeiro'
    WHEN 'pagamentos' THEN 'financeiro'
    WHEN 'budgets' THEN 'orcamento-empresa'
    WHEN 'forecasts' THEN 'financeiro'
    WHEN 'conciliacoes' THEN 'financeiro'
    WHEN 'transacoesbancarias' THEN 'financeiro'
    WHEN 'planocontas' THEN 'contabilidade'
    WHEN 'documentosfiscais' THEN 'fiscal'
    WHEN 'ivas' THEN 'fiscal'
    WHEN 'irts' THEN 'fiscal'
    WHEN 'faturas' THEN 'fiscal'
    WHEN 'funcionarios' THEN 'rh'
    WHEN 'ferias' THEN 'ferias-dispensas'
    WHEN 'feriasfuncionarios' THEN 'ferias-dispensas'
    WHEN 'folhaspagamento' THEN 'folha-salarial'
    WHEN 'pagamentosfuncionarios' THEN 'folha-salarial'
    WHEN 'turnos' THEN 'rh-ponto'
    WHEN 'frequencias' THEN 'rh-ponto'
    WHEN 'vagas' THEN 'rh-recrutamento'
    WHEN 'candidatos' THEN 'rh-recrutamento'
    WHEN 'desempenhorh' THEN 'rh-desempenho'
    WHEN 'beneficios' THEN 'rh-beneficios'
    WHEN 'planoscarreira' THEN 'rh-plano-carreira'
    WHEN 'onboarding' THEN 'rh-onboarding'
    WHEN 'pontodigital' THEN 'rh-ponto'
    WHEN 'rescisoes' THEN 'rh-rescisao'
    WHEN 'projetos' THEN 'projetos-tarefas'
    WHEN 'tarefas' THEN 'tarefas'
    WHEN 'ganttprojetos' THEN 'projetos-gantt'
    WHEN 'timesheets' THEN 'projetos-timesheet'
    WHEN 'tarefasprojetos' THEN 'projetos-tarefas'
    WHEN 'membrosprojetos' THEN 'projetos-tarefas'
    WHEN 'atividadesprojetos' THEN 'projetos-tarefas'
    WHEN 'ativos' THEN 'ativos'
    WHEN 'manutencoesativos' THEN 'ativos-manutencao'
    WHEN 'depreciacoes' THEN 'ativos-depreciacao'
    WHEN 'garantias' THEN 'ativos-garantia'
    WHEN 'manutencoes' THEN 'ativos-manutencao'
    WHEN 'frotas' THEN 'frota'
    WHEN 'motoristas' THEN 'frota'
    WHEN 'gpstracking' THEN 'frota-gps'
    WHEN 'abastecimentos' THEN 'frota-combustivel'
    WHEN 'multas' THEN 'frota-multas'
    WHEN 'ordensservico' THEN 'os'
    WHEN 'ordensmanutencao' THEN 'os-manutencao'
    WHEN 'tecnicos' THEN 'os-tecnicos'
    WHEN 'historicoos' THEN 'os'
    WHEN 'leads' THEN 'crm'
    WHEN 'scoreleads' THEN 'crm-score'
    WHEN 'campanhasmarketing' THEN 'marketing-campanhas'
    WHEN 'segmentacoes' THEN 'clientes-segmentacao'
    WHEN 'promocoes' THEN 'vendas-promocoes'
    WHEN 'servicos' THEN 'servicos'
    WHEN 'notificacoes' THEN 'notificacoes'
    WHEN 'orcamentos' THEN 'orcamentos'
    WHEN 'transportadoras' THEN 'transportadoras'
    WHEN 'contratos' THEN 'contratos'
    WHEN 'tickets' THEN 'tickets'
    WHEN 'departamentos' THEN 'departamentos-empresa'
    WHEN 'auditoria' THEN 'auditoria'
    WHEN 'mensagens' THEN 'comunicacao'
    WHEN 'eventos' THEN 'agenda'
    WHEN 'eventoscalendar' THEN 'agenda'
    WHEN 'ecommerce' THEN 'ecommerce-vitrine'
    WHEN 'ecommerceprodutos' THEN 'ecommerce-produtos'
    WHEN 'ecommercepedidos' THEN 'ecommerce-pedidos'
    WHEN 'ecommercecarrinhos' THEN 'ecommerce-carrinho'
    WHEN 'pagamentosecommerce' THEN 'ecommerce-pagamento'
    WHEN 'integracoesagt' THEN 'integracoes'
    WHEN 'assinaturasdigitais' THEN 'documentos'
    WHEN 'documentos' THEN 'documentos'
    ELSE 'documentos'
  END;
$function$;
REVOKE ALL ON FUNCTION private.ks_store_module(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_store_module(text) TO authenticated;

-- Replace broad company-wide record access with module-specific policies.
DROP POLICY IF EXISTS ks_records_member ON public.ks_records;
DROP POLICY IF EXISTS mg_ks_records_sel ON public.ks_records;
DROP POLICY IF EXISTS mg_ks_records_ins ON public.ks_records;
DROP POLICY IF EXISTS mg_ks_records_upd ON public.ks_records;
DROP POLICY IF EXISTS mg_ks_records_del ON public.ks_records;
CREATE POLICY ks_records_module_select ON public.ks_records FOR SELECT TO authenticated USING (
  private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'ver')
  AND (
    store_key<>'vendas'
    OR NOT private.ks_has_company_role(company_id,ARRAY['cashier','caixa'])
    OR payload->>'cashierUserId'=(select auth.uid())::text
    OR payload->>'operatorUserId'=(select auth.uid())::text
  )
);
CREATE POLICY ks_records_module_insert ON public.ks_records FOR INSERT TO authenticated WITH CHECK (
  private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'criar')
  AND (
    store_key<>'vendas'
    OR private.ks_has_company_role(company_id,ARRAY['owner','admin'])
    OR (
      private.ks_has_company_role(company_id,ARRAY['cashier','caixa'])
      AND payload->>'cashierUserId'=(select auth.uid())::text
    )
  )
  AND (
    store_key<>'vendas'
    OR EXISTS(SELECT 1 FROM public.ks_sales s
      WHERE s.company_id=ks_records.company_id AND s.external_id=ks_records.record_id
        AND s.cashier_user_id=(select auth.uid()))
    OR private.ks_has_company_role(company_id,ARRAY['owner','admin'])
  )
);
CREATE POLICY ks_records_module_update ON public.ks_records FOR UPDATE TO authenticated USING (
  store_key<>'vendas' AND private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'editar')
) WITH CHECK (
  store_key<>'vendas' AND private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'editar')
);
CREATE POLICY ks_records_module_delete ON public.ks_records FOR DELETE TO authenticated USING (
  store_key<>'vendas' AND private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'excluir')
);

-- Sales and sale lines are visible only to the cashier who made the sale, or supervisors.
DROP POLICY IF EXISTS ks_sales_member ON public.ks_sales;
DROP POLICY IF EXISTS mg_ks_sales_sel ON public.ks_sales;
DROP POLICY IF EXISTS mg_ks_sales_ins ON public.ks_sales;
DROP POLICY IF EXISTS mg_ks_sales_upd ON public.ks_sales;
DROP POLICY IF EXISTS mg_ks_sales_del ON public.ks_sales;
CREATE POLICY ks_sales_role_scoped_select ON public.ks_sales FOR SELECT TO authenticated USING (
  private.ks_has_company_permission(company_id,'vendas','ver')
  AND (
    NOT private.ks_has_company_role(company_id,ARRAY['cashier','caixa'])
    OR cashier_user_id=(select auth.uid())
  )
);
DROP POLICY IF EXISTS ks_sales_role_scoped_insert ON public.ks_sales;
-- No direct insert, update or delete of a finalized sale. Sales are created through the stock/licence-checked RPC.

DROP POLICY IF EXISTS ks_sale_items_member ON public.ks_sale_items;
DROP POLICY IF EXISTS mg_ks_sale_items_sel ON public.ks_sale_items;
DROP POLICY IF EXISTS mg_ks_sale_items_ins ON public.ks_sale_items;
DROP POLICY IF EXISTS mg_ks_sale_items_upd ON public.ks_sale_items;
DROP POLICY IF EXISTS mg_ks_sale_items_del ON public.ks_sale_items;
CREATE POLICY ks_sale_items_role_scoped_select ON public.ks_sale_items FOR SELECT TO authenticated USING (
  private.ks_has_company_permission(company_id,'vendas','ver')
  AND EXISTS(SELECT 1 FROM public.ks_sales s
    WHERE s.id=ks_sale_items.sale_id AND s.company_id=ks_sale_items.company_id
      AND (NOT private.ks_has_company_role(s.company_id,ARRAY['cashier','caixa']) OR s.cashier_user_id=(select auth.uid())))
);
DROP POLICY IF EXISTS ks_sale_items_role_scoped_insert ON public.ks_sale_items;

-- Only a cashier or administrator can finalize a sale. The operator approves cancellations separately.
CREATE OR REPLACE FUNCTION private.ks_finalize_sale(p_company_id uuid,p_sale jsonb,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_sale_id uuid; v_item jsonb; v_product public.ks_products%rowtype; v_qty numeric;
  v_license public.ks_company_licenses%rowtype; v_plan public.ks_saas_plans%rowtype;
  v_limit integer; v_used integer;
BEGIN
  IF NOT private.ks_has_company_role(p_company_id,ARRAY['owner','admin','cashier','caixa']) THEN
    RAISE EXCEPTION 'Apenas o Caixa ou Administrador pode finalizar vendas.' USING errcode='42501';
  END IF;
  INSERT INTO public.ks_sales(company_id,external_id,invoice_number,customer_name,customer_tax_id,customer_phone,
    subtotal,discount_value,tax_amount,total,amount_received,change_amount,payment_method,tax_regime,status,notes,
    operator_name,sold_at,cashier_user_id,cash_session_id,customer_address)
  VALUES(p_company_id,p_sale->>'external_id',coalesce(p_sale->>'invoice_number','FT'),p_sale->>'customer_name',
    p_sale->>'customer_tax_id',p_sale->>'customer_phone',coalesce((p_sale->>'subtotal')::numeric,0),
    coalesce((p_sale->>'discount_value')::numeric,0),coalesce((p_sale->>'tax_amount')::numeric,0),
    coalesce((p_sale->>'total')::numeric,0),coalesce((p_sale->>'amount_received')::numeric,0),
    coalesce((p_sale->>'change_amount')::numeric,0),p_sale->>'payment_method',p_sale->>'tax_regime',
    'finalizada',p_sale->>'notes',p_sale->>'operator_name',coalesce((p_sale->>'sold_at')::timestamptz,now()),
    coalesce(nullif(p_sale->>'cashier_user_id','')::uuid,auth.uid()),
    nullif(p_sale->>'cash_session_id','')::uuid,p_sale->>'customer_address')
  ON CONFLICT(company_id,external_id) DO UPDATE SET external_id=excluded.external_id
  RETURNING id INTO v_sale_id;
  IF EXISTS(SELECT 1 FROM public.ks_sale_items WHERE sale_id=v_sale_id) THEN RETURN v_sale_id; END IF;

  SELECT * INTO v_license FROM public.ks_company_licenses WHERE company_id=p_company_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_license.status NOT IN ('trial','active') THEN
    RAISE EXCEPTION 'LICENCE_REQUIRED: a licença não está activa. Solicite uma chave de activação.';
  END IF;
  IF v_license.expires_at IS NULL OR v_license.expires_at<=now() THEN
    RAISE EXCEPTION 'LICENCE_EXPIRED: o período de utilização terminou. As consultas e exportações continuam disponíveis; active uma licença para emitir novas facturas.';
  END IF;
  SELECT * INTO v_plan FROM public.ks_saas_plans WHERE plan_code=v_license.plan_code;
  v_limit:=coalesce(v_license.max_invoices_override,v_plan.max_invoices_period,0);
  SELECT coalesce(sum(invoices_count),0)::integer INTO v_used FROM public.ks_license_usage_daily
    WHERE company_id=p_company_id AND usage_date>=date_trunc('month',now())::date;
  IF v_limit>0 AND v_used>=v_limit THEN
    RAISE EXCEPTION 'INVOICE_QUOTA_REACHED: o pacote atingiu o limite de facturas deste mês. Actualize o pacote ou aguarde o próximo período.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty:=(v_item->>'quantity')::numeric;
    IF coalesce((v_item->>'stock_tracked')::boolean,true) THEN
      SELECT * INTO v_product FROM public.ks_products
        WHERE company_id=p_company_id AND external_id=v_item->>'product_external_id' FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado: %',v_item->>'product_external_id'; END IF;
      IF v_product.stock_quantity<v_qty THEN
        RAISE EXCEPTION 'Stock insuficiente para % (disponível %, solicitado %)',v_product.name,v_product.stock_quantity,v_qty;
      END IF;
      UPDATE public.ks_products SET stock_quantity=stock_quantity-v_qty,updated_at=now() WHERE id=v_product.id;
    END IF;
    INSERT INTO public.ks_sale_items(sale_id,company_id,product_external_id,product_name,quantity,unit_price,line_total,stock_tracked)
    VALUES(v_sale_id,p_company_id,v_item->>'product_external_id',coalesce(v_item->>'product_name','Artigo'),
      v_qty,coalesce((v_item->>'unit_price')::numeric,0),coalesce((v_item->>'line_total')::numeric,0),
      coalesce((v_item->>'stock_tracked')::boolean,true));
  END LOOP;
  INSERT INTO public.ks_license_usage_daily(company_id,usage_date,invoices_count) VALUES(p_company_id,current_date,1)
  ON CONFLICT(company_id,usage_date) DO UPDATE SET invoices_count=public.ks_license_usage_daily.invoices_count+1;
  RETURN v_sale_id;
END;
$function$;
REVOKE ALL ON FUNCTION private.ks_finalize_sale(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_finalize_sale(uuid,jsonb,jsonb) TO authenticated;

-- Operators supervise the cashiers they invited and may review their audit activity.
DROP POLICY IF EXISTS ks_audit_events_read ON public.ks_audit_events;
CREATE POLICY ks_audit_events_read ON public.ks_audit_events FOR SELECT TO authenticated USING (
  actor_user_id=(select auth.uid())
  OR EXISTS(SELECT 1 FROM public.ks_company_memberships admin_member
    WHERE admin_member.company_id=ks_audit_events.company_id AND admin_member.user_id=(select auth.uid())
      AND admin_member.status='active' AND admin_member.role IN ('owner','admin'))
  OR EXISTS(
    SELECT 1 FROM public.ks_company_memberships supervisor
    JOIN public.ks_company_memberships target ON target.company_id=supervisor.company_id
    WHERE supervisor.company_id=ks_audit_events.company_id AND supervisor.user_id=(select auth.uid())
      AND supervisor.status='active' AND supervisor.role IN ('manager','gerente','operator','operador')
      AND target.user_id=ks_audit_events.actor_user_id
      AND (target.supervisor_user_id=(select auth.uid()) OR (
        supervisor.role IN ('manager','gerente') AND target.supervisor_user_id IN (
          SELECT child.user_id FROM public.ks_company_memberships child
          WHERE child.company_id=ks_audit_events.company_id AND child.supervisor_user_id=(select auth.uid())
        )
      ))
  )
);
