-- Kanawa Soft ERP 1.0 — effective SaaS entitlements and license-key uniqueness.
-- Target: isolated Supabase project only. Do not apply to production without approval.

-- Remove legacy restrictive tenant-permission policies. The remaining
-- permissive policies allow company owners/admins to read their own licence
-- and reserve licence mutations for the platform administrator.
DROP POLICY IF EXISTS mg_ks_company_licenses_ins ON public.ks_company_licenses;
DROP POLICY IF EXISTS mg_ks_company_licenses_sel ON public.ks_company_licenses;
DROP POLICY IF EXISTS mg_ks_company_licenses_upd ON public.ks_company_licenses;
DROP POLICY IF EXISTS mg_ks_company_licenses_del ON public.ks_company_licenses;

-- Keep exactly one-column unique indexes for both issued-key hashes and
-- activated licence keys. Existing unique constraints satisfy this check;
-- create an index only if a future schema no longer has one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.ks_license_keys'::regclass
      AND i.indisunique
      AND i.indnkeyatts = 1
      AND (
        SELECT array_agg(a.attname::text ORDER BY k.ord)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid AND a.attnum = k.attnum
        WHERE k.ord <= i.indnkeyatts
      ) = ARRAY['key_hash']::text[]
  ) THEN
    CREATE UNIQUE INDEX ks_license_keys_key_hash_uidx
      ON public.ks_license_keys(key_hash);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.ks_company_licenses'::regclass
      AND i.indisunique
      AND i.indnkeyatts = 1
      AND (
        SELECT array_agg(a.attname::text ORDER BY k.ord)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid AND a.attnum = k.attnum
        WHERE k.ord <= i.indnkeyatts
      ) = ARRAY['license_key']::text[]
  ) THEN
    CREATE UNIQUE INDEX ks_company_licenses_license_key_uidx
      ON public.ks_company_licenses(license_key);
  END IF;
END
$$;

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
    ARRAY[
      'owner','admin','manager','gerente',
      'cashier','caixa','operator','operador',
      'accountant','contabilista'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'Acesso negado às permissões desta empresa'
      USING errcode = '42501';
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
    LEFT JOIN public.ks_saas_plans p ON p.plan_code = l.plan_code
    LEFT JOIN public.ks_license_terms t ON t.term_code = l.term_code
    WHERE l.company_id = p_company_id
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT 1
  ),
  evaluated AS (
    SELECT
      cl.*,
      CASE
        WHEN cl.id IS NULL THEN 'expired'
        WHEN cl.status = 'suspended' THEN 'suspended'
        WHEN cl.status IN ('expired','cancelled') THEN 'expired'
        WHEN cl.starts_at > now() THEN 'expired'
        WHEN coalesce(cl.term_is_lifetime, false)
          OR cl.plan_code = 'internal_lifetime'
          THEN CASE WHEN cl.status = 'trial' THEN 'trial' ELSE 'active' END
        WHEN cl.expires_at IS NOT NULL AND cl.expires_at > now()
          THEN CASE WHEN cl.status = 'trial' THEN 'trial' ELSE 'active' END
        WHEN cl.expires_at IS NOT NULL
          AND cl.expires_at <= now()
          AND cl.grace_until IS NOT NULL
          AND cl.grace_until > now()
          THEN 'grace'
        ELSE 'expired'
      END AS effective_status,
      (
        cl.status IN ('trial','active')
        AND cl.expires_at IS NOT NULL
        AND cl.expires_at <= now()
        AND cl.grace_until IS NOT NULL
        AND cl.grace_until > now()
      ) AS effective_in_grace
    FROM current_license cl
  )
  SELECT jsonb_build_object(
    'company_id', p_company_id,
    'license', CASE
      WHEN e.id IS NULL THEN NULL
      ELSE to_jsonb(e) - ARRAY[
        'license_key',
        'plan_invoice_limit','plan_id','plan_name','plan_price',
        'plan_currency','plan_max_users','plan_max_installations',
        'plan_features','plan_is_active','term_is_lifetime',
        'effective_status','effective_in_grace'
      ]::text[]
    END,
    'plan', CASE
      WHEN e.id IS NULL OR e.plan_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id',e.plan_id,
        'plan_code',e.plan_code,
        'name',e.plan_name,
        'price',e.plan_price,
        'currency_code',e.plan_currency,
        'max_users',e.plan_max_users,
        'max_installations',e.plan_max_installations,
        'max_invoices_period',e.plan_invoice_limit,
        'features',e.plan_features,
        'is_active',e.plan_is_active
      )
    END,
    'invoice_limit', CASE
      WHEN e.id IS NULL THEN 0
      ELSE coalesce(e.max_invoices_override,e.plan_invoice_limit,0)
    END,
    'invoice_usage', (
      SELECT coalesce(sum(u.invoices_count),0)
      FROM public.ks_license_usage_daily u
      WHERE u.company_id=p_company_id
        AND u.usage_date >= date_trunc('month',now())::date
    ),
    'status', coalesce(e.effective_status,'expired'),
    'in_grace_period', coalesce(e.effective_in_grace,false),
    'read_only', coalesce(e.effective_status NOT IN ('active','trial','grace'),true)
  )
  INTO v_result
  FROM evaluated e;

  RETURN coalesce(v_result,jsonb_build_object(
    'company_id',p_company_id,
    'license',NULL,
    'plan',NULL,
    'invoice_limit',0,
    'invoice_usage',0,
    'status','expired',
    'in_grace_period',false,
    'read_only',true
  ));
END
$function$;

REVOKE ALL ON FUNCTION private.ks_get_company_entitlements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ks_get_company_entitlements(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ks_get_company_entitlements(p_company_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.ks_get_company_entitlements($1);
$function$;

REVOKE ALL ON FUNCTION public.ks_get_company_entitlements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ks_get_company_entitlements(uuid) TO authenticated;
