-- Kanawa Soft ERP 1.0 — additive reconciliation for the isolated APP Supabase project.
-- Prepared from APP schema inventory and production schema metadata.
-- DO NOT apply to production. This migration intentionally preserves legacy columns,
-- foreign keys, current company rows, subscription dates, and license status/expiry.

BEGIN;

-- 1) Extend the legacy plan catalog without dropping/renaming its referenced "code" key.
ALTER TABLE public.ks_saas_plans
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS plan_code text,
  ADD COLUMN IF NOT EXISTS price numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'AOA',
  ADD COLUMN IF NOT EXISTS max_records integer,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS max_invoices_period integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS duration_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.ks_saas_plans
SET id = coalesce(id, gen_random_uuid()),
    plan_code = coalesce(nullif(plan_code,''), code),
    price = coalesce(price, 0),
    currency_code = coalesce(nullif(currency_code,''), 'AOA'),
    max_invoices_period = coalesce(max_invoices_period, max_invoices_month, 100),
    features = coalesce(features, '{}'::jsonb)
      || jsonb_build_object('legacy_allowed_modules', coalesce(to_jsonb(allowed_modules), '[]'::jsonb)),
    is_active = coalesce(is_active, true);

ALTER TABLE public.ks_saas_plans
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN plan_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ks_saas_plans_id_uidx ON public.ks_saas_plans(id);
CREATE UNIQUE INDEX IF NOT EXISTS ks_saas_plans_plan_code_uidx ON public.ks_saas_plans(plan_code);

-- New rows are keyed by the same value in both catalog generations, preserving
-- legacy FKs from subscriptions/licenses to ks_saas_plans.code.
INSERT INTO public.ks_saas_plans
  (code,name,monthly_price_usd,annual_price_usd,max_users,max_products,
   max_invoices_month,max_monthly_revenue_usd,storage_mb,allowed_modules,is_public,
   max_installations,id,plan_code,price,currency_code,max_records,features,
   max_invoices_period,billing_period,duration_months,display_order,is_active)
VALUES
  ('trial','Avaliação gratuita (14 dias)',NULL,NULL,3,NULL,100,NULL,1024,ARRAY[]::text[],false,2,
   gen_random_uuid(),'trial',0,'AOA',NULL,
   '{"all_modules":true,"trial_days":14,"read_only_after_expiry":true,"limits":{"max_users":3,"max_installations":2,"max_invoices_period":100}}'::jsonb,
   100,'monthly',1,0,true),
  ('mini','Start',NULL,NULL,3,NULL,500,NULL,1024,ARRAY[]::text[],true,1,
   gen_random_uuid(),'mini',15000,'AOA',NULL,
   '{"plan_tier":"start","all_modules":true,"read_only_after_expiry":true,"limits":{"max_users":3,"max_installations":1,"max_invoices_period":500}}'::jsonb,
   500,'monthly',1,1,true),
  ('standard','Comercial',NULL,NULL,10,NULL,2500,NULL,5120,ARRAY[]::text[],true,3,
   gen_random_uuid(),'standard',35000,'AOA',NULL,
   '{"plan_tier":"commercial","all_modules":true,"read_only_after_expiry":true,"limits":{"max_users":10,"max_installations":3,"max_invoices_period":2500}}'::jsonb,
   2500,'monthly',1,2,true),
  ('premium','Gestão Pro',NULL,NULL,25,NULL,10000,NULL,20480,ARRAY[]::text[],true,10,
   gen_random_uuid(),'premium',75000,'AOA',NULL,
   '{"plan_tier":"management_pro","all_modules":true,"read_only_after_expiry":true,"limits":{"max_users":25,"max_installations":10,"max_invoices_period":10000}}'::jsonb,
   10000,'monthly',1,3,true),
  ('enterprise','Enterprise',NULL,NULL,0,NULL,0,NULL,NULL,ARRAY[]::text[],true,0,
   gen_random_uuid(),'enterprise',0,'AOA',NULL,
   '{"plan_tier":"enterprise","all_modules":true,"unlimited_usage":true,"custom_quote":true,"read_only_after_expiry":true}'::jsonb,
   0,'monthly',1,4,true)
ON CONFLICT (code) DO UPDATE SET
  plan_code = coalesce(public.ks_saas_plans.plan_code, EXCLUDED.plan_code),
  id = coalesce(public.ks_saas_plans.id, EXCLUDED.id);

-- Preserve existing commercial configuration on reruns; only seed missing plan rows above.
-- The existing APP starter row is intentionally configured as the 14-day full-access trial.
UPDATE public.ks_saas_plans
SET name='Avaliação gratuita (14 dias)',
    max_users=3,
    max_installations=2,
    max_invoices_month=100,
    max_invoices_period=100,
    billing_period='monthly',
    duration_months=1,
    is_active=true,
    is_public=false,
    features=coalesce(features,'{}'::jsonb) || jsonb_build_object(
      'all_modules',true,'trial_days',14,'read_only_after_expiry',true,
      'limits',jsonb_build_object('max_users',3,'max_installations',2,'max_invoices_period',100)
    )
WHERE code='starter';

-- 2) License terms catalog.
CREATE TABLE IF NOT EXISTS public.ks_license_terms (
  term_code text PRIMARY KEY,
  name text NOT NULL,
  duration_days integer NOT NULL DEFAULT 0,
  duration_months integer NOT NULL DEFAULT 0,
  is_lifetime boolean NOT NULL DEFAULT false,
  internal_only boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ks_license_terms_duration_check
    CHECK (duration_days >= 0 AND duration_months >= 0
      AND (NOT is_lifetime OR (duration_days=0 AND duration_months=0)))
);

INSERT INTO public.ks_license_terms
  (term_code,name,duration_days,duration_months,is_lifetime,internal_only,is_active,display_order)
VALUES
  ('trial_14d','Avaliação — 14 dias',14,0,false,false,true,1),
  ('monthly','Mensal',0,1,false,false,true,10),
  ('annual','Anual',0,12,false,false,true,20),
  ('lifetime_internal','Vitalícia interna',0,0,true,true,true,100)
ON CONFLICT (term_code) DO NOTHING;

-- 3) Payment requests: tenant can submit/read its own request; only platform admins review.
CREATE TABLE IF NOT EXISTS public.ks_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.ks_saas_plans(plan_code),
  duration_months integer NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency_code text NOT NULL DEFAULT 'AOA',
  payment_method text NOT NULL,
  transaction_reference text,
  proof_path text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  term_code text REFERENCES public.ks_license_terms(term_code),
  duration_days integer NOT NULL DEFAULT 0,
  CONSTRAINT ks_payment_requests_duration_months_check CHECK (duration_months >= 0),
  CONSTRAINT ks_payment_requests_duration_days_check CHECK (duration_days >= 0),
  CONSTRAINT ks_payment_requests_payment_method_check
    CHECK (payment_method IN ('bank_transfer','multicaixa_express','cash','other'))
);

-- 4) License keys store only hashes. Plaintext keys must be shown once by a trusted
-- server-side issuance flow; they must never be returned by ordinary SELECT policies.
CREATE TABLE IF NOT EXISTS public.ks_license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  plan_code text NOT NULL REFERENCES public.ks_saas_plans(plan_code),
  duration_months integer NOT NULL,
  max_invoices_period integer NOT NULL,
  max_users integer NOT NULL,
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','redeemed','revoked','expired')),
  expires_at timestamptz,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_by_company uuid REFERENCES public.ks_companies(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  payment_request_id uuid REFERENCES public.ks_payment_requests(id) ON DELETE SET NULL,
  term_code text REFERENCES public.ks_license_terms(term_code),
  duration_days integer NOT NULL DEFAULT 0,
  CONSTRAINT ks_license_keys_duration_months_check CHECK (duration_months >= 0),
  CONSTRAINT ks_license_keys_duration_days_check CHECK (duration_days >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ks_license_keys_payment_request_id_uidx
  ON public.ks_license_keys(payment_request_id)
  WHERE payment_request_id IS NOT NULL;

-- Add optional term reference to the current license rows without changing their state.
ALTER TABLE public.ks_company_licenses
  ADD COLUMN IF NOT EXISTS term_code text,
  ADD COLUMN IF NOT EXISTS term_months_override integer,
  ADD COLUMN IF NOT EXISTS term_days_override integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='ks_company_licenses_term_code_fkey'
      AND conrelid='public.ks_company_licenses'::regclass
  ) THEN
    ALTER TABLE public.ks_company_licenses
      ADD CONSTRAINT ks_company_licenses_term_code_fkey
      FOREIGN KEY (term_code) REFERENCES public.ks_license_terms(term_code);
  END IF;
END $$;

-- 5) Add the new read-compatible usage name as a generated alias. Legacy writes keep
-- using invoice_count; entitlement reads can safely aggregate invoices_count.
ALTER TABLE public.ks_license_usage_daily
  ADD COLUMN IF NOT EXISTS invoices_count integer
  GENERATED ALWAYS AS (invoice_count) STORED;

-- 6) Add-on catalog.
CREATE TABLE IF NOT EXISTS public.ks_saas_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit_code text NOT NULL,
  pricing_model text NOT NULL DEFAULT 'quote'
    CHECK (pricing_model IN ('monthly','one_time','quote')),
  unit_price numeric(14,2),
  currency_code text NOT NULL DEFAULT 'AOA',
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ks_saas_addons_price_nonnegative CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT ks_saas_addons_quote_without_price CHECK (pricing_model <> 'quote' OR unit_price IS NULL)
);

-- 7) RLS: keep license keys private to server-side/admin workflows.
ALTER TABLE public.ks_license_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ks_license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ks_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ks_saas_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ks_license_terms_public_read ON public.ks_license_terms;
CREATE POLICY ks_license_terms_public_read ON public.ks_license_terms
  FOR SELECT TO anon,authenticated USING (is_active AND NOT internal_only);
DROP POLICY IF EXISTS ks_license_terms_admin_all ON public.ks_license_terms;
CREATE POLICY ks_license_terms_admin_all ON public.ks_license_terms
  FOR ALL TO authenticated USING (private.ks_is_platform_admin())
  WITH CHECK (private.ks_is_platform_admin());

DROP POLICY IF EXISTS ks_license_keys_admin_all ON public.ks_license_keys;
CREATE POLICY ks_license_keys_admin_all ON public.ks_license_keys
  FOR ALL TO authenticated USING (private.ks_is_platform_admin())
  WITH CHECK (private.ks_is_platform_admin());

DROP POLICY IF EXISTS ks_payment_requests_company_read ON public.ks_payment_requests;
CREATE POLICY ks_payment_requests_company_read ON public.ks_payment_requests
  FOR SELECT TO authenticated
  USING (private.ks_is_company_member(company_id) OR private.ks_is_platform_admin());
DROP POLICY IF EXISTS ks_payment_requests_company_insert ON public.ks_payment_requests;
CREATE POLICY ks_payment_requests_company_insert ON public.ks_payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND private.ks_is_company_member(company_id)
  );
DROP POLICY IF EXISTS ks_payment_requests_admin_update ON public.ks_payment_requests;
CREATE POLICY ks_payment_requests_admin_update ON public.ks_payment_requests
  FOR UPDATE TO authenticated USING (private.ks_is_platform_admin())
  WITH CHECK (private.ks_is_platform_admin());

DROP POLICY IF EXISTS ks_saas_addons_read ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_read ON public.ks_saas_addons
  FOR SELECT TO anon,authenticated
  USING ((is_active AND is_public) OR private.ks_is_platform_admin());
DROP POLICY IF EXISTS ks_saas_addons_admin_write ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_admin_write ON public.ks_saas_addons
  FOR ALL TO authenticated USING (private.ks_is_platform_admin())
  WITH CHECK (private.ks_is_platform_admin());

GRANT SELECT ON public.ks_license_terms TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.ks_license_terms TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ks_payment_requests TO authenticated;
GRANT SELECT ON public.ks_saas_addons TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.ks_saas_addons TO authenticated;
REVOKE ALL ON public.ks_license_keys FROM anon,authenticated;

COMMIT;
