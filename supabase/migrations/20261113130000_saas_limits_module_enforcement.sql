-- Kanawa Soft ERP 1.0 — SaaS entitlements, quotas and server-side module gates.
-- Apply only to isolated project kanawasoft-1-0-isolated until Preview and Go-Live approval.

-- One license key per payment request. Existing data was checked: no duplicate request IDs.
CREATE UNIQUE INDEX IF NOT EXISTS ks_license_keys_payment_request_id_uidx
  ON public.ks_license_keys(payment_request_id)
  WHERE payment_request_id IS NOT NULL;

-- Align the plan feature metadata with the tier map enforced below.
UPDATE public.ks_saas_plans
SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('all_modules',false,'module_catalog_version','1.0.0')
WHERE plan_code IN ('mini','standard','premium');
UPDATE public.ks_saas_plans
SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('all_modules',true,'module_catalog_version','1.0.0')
WHERE plan_code IN ('enterprise','trial','internal_lifetime');

-- Effective entitlements expose the real, override-aware user/device limits.
CREATE OR REPLACE FUNCTION private.ks_get_company_entitlements(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT private.ks_has_company_role(
    p_company_id,
    ARRAY['owner','admin','manager','gerente','cashier','caixa','operator','operador','accountant','contabilista']::text[]
  ) THEN
    RAISE EXCEPTION 'Acesso negado às permissões desta empresa' USING errcode='42501';
  END IF;

  WITH current_license AS (
    SELECT
      l.*,
      p.max_invoices_period AS plan_invoice_limit,
      p.id AS plan_id,
      p.name AS plan_name,
      p.price AS plan_price,
      p.currency_code AS plan_currency,
      p.max_users AS plan_max_users,
      p.max_installations AS plan_max_installations,
      p.features AS plan_features,
      p.is_active AS plan_is_active,
      t.is_lifetime AS term_is_lifetime
    FROM public.ks_company_licenses l
    LEFT JOIN public.ks_saas_plans p ON p.plan_code=l.plan_code
    LEFT JOIN public.ks_license_terms t ON t.term_code=l.term_code
    WHERE l.company_id=p_company_id
    ORDER BY l.created_at DESC,l.id DESC
    LIMIT 1
  ),
  evaluated AS (
    SELECT cl.*,
      CASE
        WHEN cl.id IS NULL THEN 'expired'
        WHEN cl.status='suspended' THEN 'suspended'
        WHEN cl.status='cancelled' THEN 'cancelled'
        WHEN cl.starts_at>now() THEN 'expired'
        WHEN cl.status='expired' THEN 'expired'
        WHEN coalesce(cl.term_is_lifetime,false) OR cl.plan_code='internal_lifetime'
          THEN CASE WHEN cl.status='trial' THEN 'trial' ELSE 'active' END
        WHEN cl.expires_at IS NOT NULL AND cl.expires_at>now()
          THEN CASE WHEN cl.status='trial' THEN 'trial' ELSE 'active' END
        WHEN cl.expires_at IS NOT NULL AND cl.expires_at<=now()
          AND cl.grace_until IS NOT NULL AND cl.grace_until>now()
          THEN 'grace'
        ELSE 'expired'
      END AS effective_status
    FROM current_license cl
  )
  SELECT jsonb_build_object(
    'company_id',p_company_id,
    'license',CASE
      WHEN e.id IS NULL THEN NULL
      ELSE to_jsonb(e)-ARRAY[
        'license_key','plan_invoice_limit','plan_id','plan_name','plan_price',
        'plan_currency','plan_max_users','plan_max_installations','plan_features',
        'plan_is_active','term_is_lifetime','effective_status'
      ]::text[]
    END,
    'plan',CASE
      WHEN e.id IS NULL OR e.plan_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id',e.plan_id,
        'plan_code',e.plan_code,
        'name',e.plan_name,
        'price',e.plan_price,
        'currency_code',e.plan_currency,
        'max_users',coalesce(e.max_users_override,e.plan_max_users,0),
        'max_installations',coalesce(e.max_installations_override,e.plan_max_installations,0),
        'max_invoices_period',e.plan_invoice_limit,
        'features',e.plan_features,
        'is_active',e.plan_is_active
      )
    END,
    'invoice_limit',CASE
      WHEN e.id IS NULL THEN 0
      ELSE coalesce(e.max_invoices_override,e.plan_invoice_limit,0)
    END,
    'invoice_usage',(
      SELECT coalesce(sum(u.invoices_count),0)
      FROM public.ks_license_usage_daily u
      WHERE u.company_id=p_company_id
        AND u.usage_date>=date_trunc('month',now())::date
    ),
    'status',coalesce(e.effective_status,'expired'),
    'in_grace_period',coalesce(e.effective_status='grace',false),
    'read_only',coalesce(e.effective_status NOT IN ('active','trial','grace'),true)
  )
  INTO v_result
  FROM evaluated e;

  RETURN coalesce(v_result,jsonb_build_object(
    'company_id',p_company_id,'license',NULL,'plan',NULL,
    'invoice_limit',0,'invoice_usage',0,'status','expired',
    'in_grace_period',false,'read_only',true
  ));
END
$function$;

REVOKE ALL ON FUNCTION private.ks_get_company_entitlements(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_get_company_entitlements(uuid) TO authenticated;

-- The 108 canonical module IDs are explicitly mapped to the minimum commercial tier.
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
    WHEN 'pdv' THEN 'mini'
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

-- Enforce plan tiers and read-only state at the same permission boundary used by RLS/RPCs.
-- Custom ks_company_memberships.permissions remain untouched and are evaluated after plan gates.
CREATE OR REPLACE FUNCTION private.ks_has_company_permission(p_company_id uuid,p_module text,p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_permissions jsonb;
  v_override jsonb;
  v_enabled boolean;
  v_module text:=lower(trim(coalesce(p_module,'')));
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_allowed boolean;
  v_entitlements jsonb;
  v_plan_code text;
  v_plan_rank integer;
  v_required_plan text;
  v_required_rank integer;
  v_read_only boolean;
  v_saft_export boolean;
BEGIN
  IF private.ks_is_platform_admin() THEN RETURN true; END IF;

  SELECT lower(coalesce(m.role,'')),coalesce(m.permissions,'{}'::jsonb)
    INTO v_role,v_permissions
  FROM public.ks_company_memberships m
  WHERE m.company_id=p_company_id AND m.user_id=auth.uid() AND m.status='active'
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_role='gerente' THEN v_role:='manager'; END IF;
  IF v_role='contabilista' THEN v_role:='accountant'; END IF;
  IF v_role='operador' THEN v_role:='operator'; END IF;
  IF v_role='caixa' THEN v_role:='cashier'; END IF;

  IF v_action IN ('configure','configuration') THEN v_action:='configurar'; END IF;
  IF v_action IN ('view','read') THEN v_action:='ver'; END IF;
  IF v_action='create' THEN v_action:='criar'; END IF;
  IF v_action='edit' THEN v_action:='editar'; END IF;
  IF v_action='delete' THEN v_action:='excluir'; END IF;
  IF v_action='export' THEN v_action:='exportar'; END IF;
  IF v_action='approve' THEN v_action:='aprovar'; END IF;
  IF v_action='cancel' THEN v_action:='cancelar'; END IF;

  v_entitlements:=private.ks_get_company_entitlements(p_company_id);
  v_plan_code:=lower(coalesce(v_entitlements #>> '{plan,plan_code}',v_entitlements #>> '{license,plan_code}',''));
  v_plan_rank:=CASE v_plan_code
    WHEN 'mini' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 4 WHEN 'trial' THEN 4 WHEN 'internal_lifetime' THEN 4
    ELSE 0 END;
  v_required_plan:=private.ks_module_min_plan(v_module);
  v_required_rank:=CASE v_required_plan
    WHEN 'mini' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 4 ELSE 0 END;

  v_saft_export:=v_action='exportar'
    AND v_module IN ('contabilidade','fiscal')
    AND v_role='accountant';

  IF NOT v_saft_export AND (v_plan_rank=0 OR v_required_rank=0 OR v_plan_rank<v_required_rank) THEN
    RETURN false;
  END IF;

  v_read_only:=coalesce((v_entitlements->>'read_only')::boolean,true);
  IF v_read_only AND v_action<>'ver' AND NOT v_saft_export THEN
    RETURN false;
  END IF;

  IF v_role IN ('owner','admin') THEN RETURN true; END IF;

  -- Sensitive administration modules cannot be delegated through JSON overrides.
  IF v_module IN ('usuarios','modulos','integracoes','licenca','config') THEN RETURN false; END IF;

  SELECT s.enabled INTO v_enabled
  FROM public.ks_company_module_settings s
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
END
$function$;

-- Membership guard. Initial owner creation is the only permitted bootstrap before a license exists.
CREATE OR REPLACE FUNCTION private.ks_enforce_membership_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_owner uuid;
  v_status text;
  v_plan_code text;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_grace_until timestamptz;
  v_max_users integer;
  v_lifetime boolean;
  v_effective_status text;
  v_used integer;
BEGIN
  IF TG_OP='UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'A associação não pode ser transferida entre empresas.' USING errcode='42501';
  END IF;
  IF NEW.status NOT IN ('active','pending_approval') THEN RETURN NEW; END IF;

  SELECT c.owner_user_id INTO v_owner
  FROM public.ks_companies c
  WHERE c.id=NEW.company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada.' USING errcode='23503'; END IF;

  SELECT l.status,l.plan_code,l.starts_at,l.expires_at,l.grace_until,
         coalesce(l.max_users_override,p.max_users,0),coalesce(t.is_lifetime,false)
    INTO v_status,v_plan_code,v_starts_at,v_expires_at,v_grace_until,v_max_users,v_lifetime
  FROM public.ks_company_licenses l
  LEFT JOIN public.ks_saas_plans p ON p.plan_code=l.plan_code
  LEFT JOIN public.ks_license_terms t ON t.term_code=l.term_code
  WHERE l.company_id=NEW.company_id
  ORDER BY l.created_at DESC,l.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    IF TG_OP='INSERT' AND NEW.role='owner' AND NEW.user_id=v_owner
       AND NOT EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.company_id=NEW.company_id) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'LICENCE_REQUIRED: active uma licença antes de adicionar utilizadores.' USING errcode='42501';
  END IF;

  v_effective_status:=CASE
    WHEN v_status='suspended' THEN 'suspended'
    WHEN v_status='cancelled' THEN 'cancelled'
    WHEN v_starts_at>now() THEN 'expired'
    WHEN v_status='expired' THEN 'expired'
    WHEN coalesce(v_lifetime,false) OR v_plan_code='internal_lifetime' THEN 'active'
    WHEN v_expires_at IS NOT NULL AND v_expires_at>now()
      THEN CASE WHEN v_status='trial' THEN 'trial' ELSE 'active' END
    WHEN v_expires_at IS NOT NULL AND v_expires_at<=now()
      AND v_grace_until IS NOT NULL AND v_grace_until>now() THEN 'grace'
    ELSE 'expired'
  END;
  IF v_effective_status NOT IN ('active','trial','grace') THEN
    RAISE EXCEPTION 'LICENCE_READ_ONLY: a licença está em modo de leitura; não é possível adicionar utilizadores.' USING errcode='42501';
  END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.ks_company_memberships m
  WHERE m.company_id=NEW.company_id
    AND m.status IN ('active','pending_approval')
    AND m.id IS DISTINCT FROM NEW.id;
  IF v_max_users>0 AND v_used>=v_max_users THEN
    RAISE EXCEPTION 'USER_QUOTA_REACHED: o plano atingiu o limite de utilizadores (%).',v_max_users USING errcode='42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS ks_membership_entitlement_guard ON public.ks_company_memberships;
CREATE TRIGGER ks_membership_entitlement_guard
BEFORE INSERT OR UPDATE ON public.ks_company_memberships
FOR EACH ROW EXECUTE FUNCTION private.ks_enforce_membership_entitlement();

-- Invitation guard reserves seats before an invitation is sent.
CREATE OR REPLACE FUNCTION private.ks_enforce_invitation_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text;
  v_plan_code text;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_grace_until timestamptz;
  v_max_users integer;
  v_lifetime boolean;
  v_effective_status text;
  v_used integer;
BEGIN
  PERFORM 1 FROM public.ks_companies c WHERE c.id=NEW.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada.' USING errcode='23503'; END IF;

  SELECT l.status,l.plan_code,l.starts_at,l.expires_at,l.grace_until,
         coalesce(l.max_users_override,p.max_users,0),coalesce(t.is_lifetime,false)
    INTO v_status,v_plan_code,v_starts_at,v_expires_at,v_grace_until,v_max_users,v_lifetime
  FROM public.ks_company_licenses l
  LEFT JOIN public.ks_saas_plans p ON p.plan_code=l.plan_code
  LEFT JOIN public.ks_license_terms t ON t.term_code=l.term_code
  WHERE l.company_id=NEW.company_id
  ORDER BY l.created_at DESC,l.id DESC
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'LICENCE_REQUIRED: active uma licença antes de convidar utilizadores.' USING errcode='42501'; END IF;

  v_effective_status:=CASE
    WHEN v_status='suspended' THEN 'suspended'
    WHEN v_status='cancelled' THEN 'cancelled'
    WHEN v_starts_at>now() THEN 'expired'
    WHEN v_status='expired' THEN 'expired'
    WHEN coalesce(v_lifetime,false) OR v_plan_code='internal_lifetime' THEN 'active'
    WHEN v_expires_at IS NOT NULL AND v_expires_at>now()
      THEN CASE WHEN v_status='trial' THEN 'trial' ELSE 'active' END
    WHEN v_expires_at IS NOT NULL AND v_expires_at<=now()
      AND v_grace_until IS NOT NULL AND v_grace_until>now() THEN 'grace'
    ELSE 'expired'
  END;
  IF v_effective_status NOT IN ('active','trial','grace') THEN
    RAISE EXCEPTION 'LICENCE_READ_ONLY: a licença está em modo de leitura; não é possível criar convites.' USING errcode='42501';
  END IF;

  SELECT
    (SELECT count(*) FROM public.ks_company_memberships m
      WHERE m.company_id=NEW.company_id AND m.status IN ('active','pending_approval'))
    +
    (SELECT count(*) FROM public.ks_team_invitations i
      WHERE i.company_id=NEW.company_id AND i.accepted_at IS NULL
        AND i.expires_at>now() AND i.id IS DISTINCT FROM NEW.id)
  INTO v_used;

  IF v_max_users>0 AND v_used>=v_max_users THEN
    RAISE EXCEPTION 'USER_QUOTA_REACHED: não há lugares disponíveis no plano (% utilizadores).',v_max_users USING errcode='42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS ks_invitation_entitlement_guard ON public.ks_team_invitations;
CREATE TRIGGER ks_invitation_entitlement_guard
BEFORE INSERT ON public.ks_team_invitations
FOR EACH ROW EXECUTE FUNCTION private.ks_enforce_invitation_entitlement();

-- Device installation guard. Existing active devices continue working; new activations consume quota.
CREATE OR REPLACE FUNCTION private.ks_enforce_installation_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text;
  v_plan_code text;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_grace_until timestamptz;
  v_max_installations integer;
  v_lifetime boolean;
  v_effective_status text;
  v_used integer;
BEGIN
  IF NEW.install_status<>'active' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.install_status='active' AND NEW.install_status='active' THEN RETURN NEW; END IF;

  IF TG_OP='INSERT' AND EXISTS(
    SELECT 1 FROM public.ks_installations i
    WHERE i.company_id=NEW.company_id AND i.installation_key=NEW.installation_key
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.ks_companies c WHERE c.id=NEW.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada.' USING errcode='23503'; END IF;

  SELECT l.status,l.plan_code,l.starts_at,l.expires_at,l.grace_until,
         coalesce(l.max_installations_override,p.max_installations,0),coalesce(t.is_lifetime,false)
    INTO v_status,v_plan_code,v_starts_at,v_expires_at,v_grace_until,v_max_installations,v_lifetime
  FROM public.ks_company_licenses l
  LEFT JOIN public.ks_saas_plans p ON p.plan_code=l.plan_code
  LEFT JOIN public.ks_license_terms t ON t.term_code=l.term_code
  WHERE l.company_id=NEW.company_id
  ORDER BY l.created_at DESC,l.id DESC
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'LICENCE_REQUIRED: active uma licença antes de registar uma instalação.' USING errcode='42501'; END IF;

  v_effective_status:=CASE
    WHEN v_status='suspended' THEN 'suspended'
    WHEN v_status='cancelled' THEN 'cancelled'
    WHEN v_starts_at>now() THEN 'expired'
    WHEN v_status='expired' THEN 'expired'
    WHEN coalesce(v_lifetime,false) OR v_plan_code='internal_lifetime' THEN 'active'
    WHEN v_expires_at IS NOT NULL AND v_expires_at>now()
      THEN CASE WHEN v_status='trial' THEN 'trial' ELSE 'active' END
    WHEN v_expires_at IS NOT NULL AND v_expires_at<=now()
      AND v_grace_until IS NOT NULL AND v_grace_until>now() THEN 'grace'
    ELSE 'expired'
  END;
  IF v_effective_status NOT IN ('active','trial','grace') THEN
    RAISE EXCEPTION 'LICENCE_READ_ONLY: a licença está em modo de leitura; não é possível registar novas instalações.' USING errcode='42501';
  END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.ks_installations i
  WHERE i.company_id=NEW.company_id
    AND i.install_status='active'
    AND i.id IS DISTINCT FROM NEW.id;
  IF v_max_installations>0 AND v_used>=v_max_installations THEN
    RAISE EXCEPTION 'INSTALLATION_QUOTA_REACHED: o plano atingiu o limite de instalações (%).',v_max_installations USING errcode='42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS ks_installation_entitlement_guard ON public.ks_installations;
CREATE TRIGGER ks_installation_entitlement_guard
BEFORE INSERT OR UPDATE OF install_status ON public.ks_installations
FOR EACH ROW EXECUTE FUNCTION private.ks_enforce_installation_entitlement();

CREATE INDEX IF NOT EXISTS ks_company_memberships_company_status_idx
  ON public.ks_company_memberships(company_id,status);
CREATE INDEX IF NOT EXISTS ks_team_invitations_company_pending_idx
  ON public.ks_team_invitations(company_id,accepted_at,expires_at);
CREATE INDEX IF NOT EXISTS ks_installations_company_status_idx
  ON public.ks_installations(company_id,install_status);

-- Invoice writes are checked before insertion against the same effective state and quota.
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
BEGIN
  IF NEW.status NOT IN ('finalizada','finalizado') THEN RETURN NEW; END IF;

  SELECT l.id INTO v_license_id
  FROM public.ks_company_licenses l
  WHERE l.company_id=NEW.company_id
  ORDER BY l.created_at DESC,l.id DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LICENCE_REQUIRED: active uma licença antes de emitir facturas.' USING errcode='42501';
  END IF;

  v_entitlements:=private.ks_get_company_entitlements(NEW.company_id);
  IF coalesce((v_entitlements->>'read_only')::boolean,true) THEN
    IF v_entitlements->>'status'='suspended' THEN
      RAISE EXCEPTION 'LICENCE_SUSPENDED: a licença está suspensa; não é possível emitir facturas.' USING errcode='42501';
    ELSIF v_entitlements->>'status'='cancelled' THEN
      RAISE EXCEPTION 'LICENCE_CANCELLED: a licença foi cancelada; não é possível emitir facturas.' USING errcode='42501';
    ELSE
      RAISE EXCEPTION 'LICENCE_EXPIRED: a licença está em modo de leitura; não é possível emitir facturas.' USING errcode='42501';
    END IF;
  END IF;

  v_limit:=coalesce((v_entitlements->>'invoice_limit')::integer,0);
  SELECT coalesce(sum(u.invoices_count),0)::integer INTO v_used
  FROM public.ks_license_usage_daily u
  WHERE u.company_id=NEW.company_id
    AND u.usage_date>=date_trunc('month',now())::date;

  IF v_limit>0 AND v_used>=v_limit THEN
    RAISE EXCEPTION 'INVOICE_QUOTA_REACHED: o plano atingiu o limite de facturas deste mês.' USING errcode='42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS ks_sales_entitlement_guard ON public.ks_sales;
CREATE TRIGGER ks_sales_entitlement_guard
BEFORE INSERT ON public.ks_sales
FOR EACH ROW EXECUTE FUNCTION private.ks_enforce_sale_entitlement();

-- Consolidate add-on read policies to avoid overlapping permissive SELECT policies.
DROP POLICY IF EXISTS ks_saas_addons_public_read ON public.ks_saas_addons;
DROP POLICY IF EXISTS ks_saas_addons_admin_read ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_read
  ON public.ks_saas_addons FOR SELECT TO anon,authenticated
  USING ((is_active AND is_public) OR private.ks_is_platform_admin());

-- Move the privileged sale-cancellation implementation into the private schema.
CREATE OR REPLACE FUNCTION private.ks_admin_cancel_sale_secure_impl(p_sale_external_id text,p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_company uuid;
  v_sale public.ks_sales%rowtype;
  v_entitlements jsonb;
BEGIN
  SELECT m.company_id INTO v_company
  FROM public.ks_company_memberships m
  WHERE m.user_id=auth.uid() AND m.status='active'
    AND m.role IN ('owner','admin','administrator')
  ORDER BY m.created_at LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Apenas o administrador pode cancelar uma venda.' USING errcode='42501';
  END IF;

  v_entitlements:=private.ks_get_company_entitlements(v_company);
  IF coalesce((v_entitlements->>'read_only')::boolean,true) THEN
    RAISE EXCEPTION 'LICENCE_READ_ONLY: não é possível cancelar vendas com a licença em modo de leitura.' USING errcode='42501';
  END IF;
  IF length(trim(coalesce(p_reason,'')))<5 THEN
    RAISE EXCEPTION 'Indique um motivo com pelo menos 5 caracteres.' USING errcode='22023';
  END IF;

  SELECT * INTO v_sale FROM public.ks_sales
   WHERE company_id=v_company AND external_id=p_sale_external_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada.' USING errcode='P0002'; END IF;
  IF v_sale.status NOT IN ('finalizada','finalizado') THEN
    RAISE EXCEPTION 'A venda já foi cancelada ou não está finalizada.' USING errcode='22023';
  END IF;

  UPDATE public.ks_sales
    SET status='cancelada',cancelled_at=now(),cancelled_by=auth.uid(),
        cancellation_reason=trim(p_reason)
    WHERE id=v_sale.id;
  UPDATE public.ks_records
    SET payload=jsonb_set(payload,'{status}','"cancelada"'::jsonb,true),updated_at=now()
    WHERE company_id=v_company AND store_key='vendas' AND record_id=p_sale_external_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
    VALUES(v_company,auth.uid(),'sale_cancelled_by_admin','sale',p_sale_external_id,
      jsonb_build_object('invoice_number',v_sale.invoice_number,'reason',trim(p_reason),'source','admin_sales_screen'));
  RETURN jsonb_build_object('sale_id',v_sale.id,'invoice_number',v_sale.invoice_number,'status','cancelada');
END
$function$;

REVOKE ALL ON FUNCTION private.ks_admin_cancel_sale_secure_impl(text,text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.ks_admin_cancel_sale_secure_impl(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ks_admin_cancel_sale(p_sale_external_id text,p_reason text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.ks_admin_cancel_sale_secure_impl($1,$2);
$function$;

REVOKE ALL ON FUNCTION public.ks_admin_cancel_sale(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_admin_cancel_sale(text,text) TO authenticated;
