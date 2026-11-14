-- Enforce the PDV minimum plan and fail-closed license state for every sale write.
-- This migration is committed for review only; do not apply it to production.
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
    WHEN 'trial' THEN 1
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
