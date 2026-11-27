-- Kanawa Soft ERP 1.0 — enforce the PDV plan minimum on server-side sale finalization.
-- Restores parity between the module catalog (PDV requires Standard) and the database gate.
-- Review and apply only after confirming the target Supabase migration history.

CREATE OR REPLACE FUNCTION private.ks_module_min_plan(p_module_id text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE lower(trim(coalesce(p_module_id,'')))
    WHEN 'dashboard' THEN 'mini'
    WHEN 'clientes' THEN 'mini'
    WHEN 'crm' THEN 'mini'
    WHEN 'crm-automacao' THEN 'standard'
    WHEN 'crm-pipeline' THEN 'mini'
    WHEN 'crm-remarketing' THEN 'standard'
    WHEN 'crm-score' THEN 'standard'
    WHEN 'vendas' THEN 'mini'
    WHEN 'orcamentos' THEN 'mini'
    WHEN 'vendas-consignadas' THEN 'standard'
    WHEN 'vendas-promocoes' THEN 'standard'
    WHEN 'contratos' THEN 'standard'
    WHEN 'clientes-segmentacao' THEN 'standard'
    WHEN 'projetos' THEN 'standard'
    WHEN 'projetos-custos' THEN 'standard'
    WHEN 'projetos-gantt' THEN 'standard'
    WHEN 'projetos-kanban' THEN 'standard'
    WHEN 'projetos-recursos' THEN 'standard'
    WHEN 'projetos-riscos' THEN 'standard'
    WHEN 'projetos-tarefas' THEN 'standard'
    WHEN 'projetos-timesheet' THEN 'standard'
    WHEN 'tarefas' THEN 'standard'
    WHEN 'reunioes' THEN 'standard'
    WHEN 'marketing-campanhas' THEN 'standard'
    WHEN 'pdv' THEN 'standard'
    WHEN 'produtos' THEN 'mini'
    WHEN 'categorias' THEN 'mini'
    WHEN 'servicos' THEN 'mini'
    WHEN 'tabelas-precos' THEN 'standard'
    WHEN 'produtos-avaliacoes' THEN 'standard'
    WHEN 'estoque' THEN 'mini'
    WHEN 'logistica-armazens' THEN 'standard'
    WHEN 'logistica-etiquetas' THEN 'standard'
    WHEN 'logistica-picking' THEN 'standard'
    WHEN 'logistica-crossdocking' THEN 'premium'
    WHEN 'compras' THEN 'mini'
    WHEN 'fornecedores' THEN 'mini'
    WHEN 'documentos' THEN 'standard'
    WHEN 'financeiro' THEN 'mini'
    WHEN 'contabilidade' THEN 'standard'
    WHEN 'despesas-gerais' THEN 'mini'
    WHEN 'orcamento-empresa' THEN 'standard'
    WHEN 'departamentos-empresa' THEN 'standard'
    WHEN 'ferias-dispensas' THEN 'standard'
    WHEN 'folha-salarial' THEN 'standard'
    WHEN 'rh' THEN 'standard'
    WHEN 'rh-beneficios' THEN 'standard'
    WHEN 'rh-desempenho' THEN 'standard'
    WHEN 'rh-documentos' THEN 'standard'
    WHEN 'rh-onboarding' THEN 'standard'
    WHEN 'rh-plano-carreira' THEN 'standard'
    WHEN 'rh-ponto' THEN 'standard'
    WHEN 'rh-recrutamento' THEN 'standard'
    WHEN 'rh-rescisao' THEN 'standard'
    WHEN 'elearning-certificacoes' THEN 'premium'
    WHEN 'elearning-cursos' THEN 'premium'
    WHEN 'elearning-progresso' THEN 'premium'
    WHEN 'elearning-quizzes' THEN 'premium'
    WHEN 'elearning-relatorios' THEN 'premium'
    WHEN 'bom' THEN 'premium'
    WHEN 'controle-qualidade' THEN 'premium'
    WHEN 'custos-producao' THEN 'premium'
    WHEN 'mrp' THEN 'premium'
    WHEN 'ordens-producao' THEN 'premium'
    WHEN 'planos-producao' THEN 'premium'
    WHEN 'producao' THEN 'premium'
    WHEN 'ativos' THEN 'premium'
    WHEN 'ativos-depreciacao' THEN 'premium'
    WHEN 'ativos-garantia' THEN 'premium'
    WHEN 'ativos-manutencao' THEN 'premium'
    WHEN 'os' THEN 'standard'
    WHEN 'os-calendario' THEN 'standard'
    WHEN 'os-checklist' THEN 'standard'
    WHEN 'os-manutencao' THEN 'standard'
    WHEN 'os-tecnicos' THEN 'standard'
    WHEN 'tickets' THEN 'standard'
    WHEN 'ecommerce' THEN 'mini'
    WHEN 'ecommerce-carrinho' THEN 'standard'
    WHEN 'ecommerce-pagamento' THEN 'standard'
    WHEN 'ecommerce-pedidos' THEN 'standard'
    WHEN 'ecommerce-produtos' THEN 'mini'
    WHEN 'ecommerce-rastreio' THEN 'standard'
    WHEN 'ecommerce-vitrine' THEN 'standard'
    WHEN 'portal-cliente' THEN 'standard'
    WHEN 'clientes-cupons' THEN 'standard'
    WHEN 'clientes-fidelidade' THEN 'standard'
    WHEN 'frota' THEN 'premium'
    WHEN 'frota-combustivel' THEN 'premium'
    WHEN 'frota-desempenho' THEN 'premium'
    WHEN 'frota-documentos' THEN 'premium'
    WHEN 'frota-gps' THEN 'enterprise'
    WHEN 'frota-manutencao' THEN 'premium'
    WHEN 'frota-multas' THEN 'premium'
    WHEN 'frota-rotas' THEN 'premium'
    WHEN 'logistica-rastreio' THEN 'standard'
    WHEN 'logistica-roteirizacao' THEN 'standard'
    WHEN 'transportadoras' THEN 'mini'
    WHEN 'relatorios' THEN 'mini'
    WHEN 'marketing-analise' THEN 'standard'
    WHEN 'auditoria' THEN 'mini'
    WHEN 'dispositivos' THEN 'standard'
    WHEN 'perfil' THEN 'mini'
    WHEN 'aprovacoes-empresa' THEN 'standard'
    WHEN 'comunicacao' THEN 'standard'
    WHEN 'fiscal' THEN 'standard'
    WHEN 'empresa-legal' THEN 'standard'
    WHEN 'agenda' THEN 'standard'
    WHEN 'notificacoes' THEN 'mini'
    WHEN 'conformidade' THEN 'standard'
    WHEN 'integracoes' THEN 'enterprise'
    ELSE 'mini'
  END;
$function$;

REVOKE ALL ON FUNCTION private.ks_module_min_plan(text) FROM PUBLIC,anon,authenticated;

-- Enforce the PDV minimum plan and fail-closed license state for every sale write.
-- Applied to the connected production project; keep this source version in sync.
CREATE OR REPLACE FUNCTION private.ks_enforce_sale_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_license_id uuid;
  v_entitlements jsonb;
  v_limit integer;
  v_used integer;
  v_plan_code text;
  v_required_plan text;
  v_plan_rank integer;
  v_required_rank integer;
BEGIN
  SELECT l.id INTO v_license_id
  FROM public.ks_company_licenses l
  WHERE l.company_id = NEW.company_id
  ORDER BY l.created_at DESC, l.id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LICENCE_REQUIRED: active uma licença antes de emitir facturas.'
      USING errcode = '42501';
  END IF;

  v_entitlements := private.ks_get_company_entitlements(NEW.company_id);

  -- Missing, malformed or non-writable entitlements must never authorize a sale.
  IF coalesce((v_entitlements->>'read_only')::boolean, true) THEN
    IF v_entitlements->>'status' = 'suspended' THEN
      RAISE EXCEPTION 'LICENCE_SUSPENDED: a licença está suspensa; não é possível emitir facturas.'
        USING errcode = '42501';
    ELSIF v_entitlements->>'status' = 'cancelled' THEN
      RAISE EXCEPTION 'LICENCE_CANCELLED: a licença foi cancelada; não é possível emitir facturas.'
        USING errcode = '42501';
    ELSE
      RAISE EXCEPTION 'LICENCE_READ_ONLY: a licença está em modo de leitura ou não pôde ser validada.'
        USING errcode = '42501';
    END IF;
  END IF;

  -- Non-final sale updates (including cancellation) still obey the read-only gate.
  -- Only finalized sales consume invoice quota and require the PDV tier.
  IF NEW.status NOT IN ('finalizada','finalizado') THEN
    RETURN NEW;
  END IF;

  -- The canonical module catalog is the source of truth for the PDV minimum.
  v_required_plan := private.ks_module_min_plan('pdv');
  v_required_rank := CASE v_required_plan
    WHEN 'mini' THEN 1
    WHEN 'standard' THEN 2
    WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 4
    ELSE 0
  END;

  v_plan_code := lower(coalesce(
    v_entitlements #>> '{plan,plan_code}',
    v_entitlements #>> '{license,plan_code}',
    ''
  ));
  v_plan_rank := CASE v_plan_code
    WHEN 'mini' THEN 1
    WHEN 'trial' THEN 4
    WHEN 'standard' THEN 2
    WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 4
    WHEN 'internal_lifetime' THEN 4
    ELSE 0
  END;

  -- Unknown plans and unknown module requirements fail closed.
  IF v_required_rank = 0 OR v_plan_rank = 0 OR v_plan_rank < v_required_rank THEN
    RAISE EXCEPTION 'PLAN_MODULE_REQUIRED: o PDV exige o plano % ou superior; plano actual: %.',
      coalesce(v_required_plan, 'não definido'),
      coalesce(nullif(v_plan_code, ''), 'não validado')
      USING errcode = '42501';
  END IF;

  v_limit := coalesce((v_entitlements->>'invoice_limit')::integer, 0);
  SELECT coalesce(sum(u.invoices_count), 0)::integer INTO v_used
  FROM public.ks_license_usage_daily u
  WHERE u.company_id = NEW.company_id
    AND u.usage_date >= date_trunc('month', now())::date;

  IF v_limit > 0 AND v_used >= v_limit THEN
    RAISE EXCEPTION 'INVOICE_QUOTA_REACHED: o plano atingiu o limite de facturas deste mês.'
      USING errcode = '42501';
  END IF;

  RETURN NEW;
END
$function$;

-- Recheck every sale write for read-only state and every finalized sale for its PDV tier/quota.
-- UPDATE-based finalization is covered; cancellation still uses the secured cancellation RPC.
DROP TRIGGER IF EXISTS ks_sales_entitlement_guard ON public.ks_sales;
CREATE TRIGGER ks_sales_entitlement_guard
BEFORE INSERT OR UPDATE ON public.ks_sales
FOR EACH ROW
EXECUTE FUNCTION private.ks_enforce_sale_entitlement();
