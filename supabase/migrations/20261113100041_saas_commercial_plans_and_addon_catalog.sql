-- Kanawa Soft ERP 1.0 — commercial SaaS plans and add-on catalog.
-- Isolated project only. Existing trial and internal lifetime plans are deliberately untouched.
-- Plan module access remains compatible with the current all_modules=true behavior until
-- a plan-by-plan module matrix is explicitly approved and server-enforced.

UPDATE public.ks_saas_plans
SET name='Start',
    price=15000,
    currency_code='AOA',
    max_users=3,
    max_installations=1,
    max_invoices_period=500,
    billing_period='monthly',
    duration_months=1,
    is_active=true,
    is_public=true,
    features=coalesce(features,'{}'::jsonb) || jsonb_build_object(
      'plan_tier','start',
      'module_catalog_version','1.0.0',
      'limits',jsonb_build_object('max_users',3,'max_installations',1,'max_invoices_period',500),
      'all_modules',true,
      'unlimited_usage',false,
      'read_only_after_expiry',true
    ),
    display_order=1
WHERE plan_code='mini';

UPDATE public.ks_saas_plans
SET name='Comercial',
    price=35000,
    currency_code='AOA',
    max_users=10,
    max_installations=3,
    max_invoices_period=2500,
    billing_period='monthly',
    duration_months=1,
    is_active=true,
    is_public=true,
    features=coalesce(features,'{}'::jsonb) || jsonb_build_object(
      'plan_tier','commercial',
      'module_catalog_version','1.0.0',
      'limits',jsonb_build_object('max_users',10,'max_installations',3,'max_invoices_period',2500),
      'all_modules',true,
      'unlimited_usage',false,
      'read_only_after_expiry',true
    ),
    display_order=2
WHERE plan_code='standard';

UPDATE public.ks_saas_plans
SET name='Gestão Pro',
    price=75000,
    currency_code='AOA',
    max_users=25,
    max_installations=10,
    max_invoices_period=10000,
    billing_period='monthly',
    duration_months=1,
    is_active=true,
    is_public=true,
    features=coalesce(features,'{}'::jsonb) || jsonb_build_object(
      'plan_tier','management_pro',
      'module_catalog_version','1.0.0',
      'limits',jsonb_build_object('max_users',25,'max_installations',10,'max_invoices_period',10000),
      'all_modules',true,
      'unlimited_usage',false,
      'read_only_after_expiry',true
    ),
    display_order=3
WHERE plan_code='premium';

UPDATE public.ks_saas_plans
SET name='Enterprise',
    price=0,
    currency_code='AOA',
    max_users=0,
    max_installations=0,
    max_invoices_period=0,
    billing_period='monthly',
    duration_months=1,
    is_active=true,
    is_public=true,
    features=coalesce(features,'{}'::jsonb) || jsonb_build_object(
      'plan_tier','enterprise',
      'module_catalog_version','1.0.0',
      'limits',jsonb_build_object('max_users',0,'max_installations',0,'max_invoices_period',0),
      'all_modules',true,
      'unlimited_usage',true,
      'custom_quote',true,
      'read_only_after_expiry',true
    ),
    display_order=4
WHERE plan_code='enterprise';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.ks_saas_plans
      WHERE plan_code IN ('mini','standard','premium','enterprise')) <> 4 THEN
    RAISE EXCEPTION 'Expected all four existing commercial plan codes before seeding.';
  END IF;
END
$$;

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

ALTER TABLE public.ks_saas_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ks_saas_addons_public_read ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_public_read
  ON public.ks_saas_addons FOR SELECT TO anon, authenticated
  USING (is_active AND is_public);

DROP POLICY IF EXISTS ks_saas_addons_admin_read ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_admin_read
  ON public.ks_saas_addons FOR SELECT TO authenticated
  USING (private.ks_is_platform_admin());

DROP POLICY IF EXISTS ks_saas_addons_admin_insert ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_admin_insert
  ON public.ks_saas_addons FOR INSERT TO authenticated
  WITH CHECK (private.ks_is_platform_admin());

DROP POLICY IF EXISTS ks_saas_addons_admin_update ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_admin_update
  ON public.ks_saas_addons FOR UPDATE TO authenticated
  USING (private.ks_is_platform_admin())
  WITH CHECK (private.ks_is_platform_admin());

DROP POLICY IF EXISTS ks_saas_addons_admin_delete ON public.ks_saas_addons;
CREATE POLICY ks_saas_addons_admin_delete
  ON public.ks_saas_addons FOR DELETE TO authenticated
  USING (private.ks_is_platform_admin());

GRANT SELECT ON public.ks_saas_addons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ks_saas_addons TO authenticated;

INSERT INTO public.ks_saas_addons
  (addon_code,name,description,unit_code,pricing_model,unit_price,currency_code,is_active,is_public,features,display_order)
VALUES
  ('extra_user','Utilizador adicional','Aumenta o número de utilizadores autorizados da empresa.','user','quote',NULL,'AOA',true,false,'{"entitlement":"max_users","unit":"user"}'::jsonb,10),
  ('extra_installation','Filial ou instalação adicional','Aumenta o limite de instalações/filiais autorizadas.','installation','quote',NULL,'AOA',true,false,'{"entitlement":"max_installations","unit":"installation"}'::jsonb,20),
  ('invoice_pack_1000','Pacote adicional de 1.000 facturas','Acrescenta um bloco de 1.000 facturas ao limite do período.','1000_invoices','quote',NULL,'AOA',true,false,'{"entitlement":"max_invoices_period","quantity":1000}'::jsonb,30),
  ('storage_10gb','Armazenamento adicional de 10 GB','Capacidade adicional para documentos e anexos.','10_gb','quote',NULL,'AOA',true,false,'{"entitlement":"storage_bytes","quantity_gb":10}'::jsonb,40),
  ('whatsapp_api','Integração WhatsApp/API','Activação e configuração de integração de mensagens e API.','company','quote',NULL,'AOA',true,false,'{"entitlement":"integration_whatsapp"}'::jsonb,50),
  ('production_mrp','Indústria e MRP avançado','Activação de funcionalidades avançadas de produção e MRP.','company','quote',NULL,'AOA',true,false,'{"module_group":"M10_industria_producao_mrp"}'::jsonb,60),
  ('gps_fleet','GPS e gestão avançada de frota','Activação de localização e funcionalidades avançadas de frota.','company','quote',NULL,'AOA',true,false,'{"module_group":"M13_logistica_entregas_frota"}'::jsonb,70)
ON CONFLICT (addon_code) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  unit_code=EXCLUDED.unit_code,
  features=EXCLUDED.features,
  display_order=EXCLUDED.display_order,
  updated_at=now();

