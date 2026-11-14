-- Keep public add-on catalog reads available without exposing the private schema to anon.
DROP POLICY IF EXISTS ks_saas_addons_read ON public.ks_saas_addons;
DROP POLICY IF EXISTS ks_saas_addons_public_read ON public.ks_saas_addons;
DROP POLICY IF EXISTS ks_saas_addons_authenticated_read ON public.ks_saas_addons;

CREATE POLICY ks_saas_addons_public_read
  ON public.ks_saas_addons FOR SELECT TO anon
  USING (is_active AND is_public);

CREATE POLICY ks_saas_addons_authenticated_read
  ON public.ks_saas_addons FOR SELECT TO authenticated
  USING ((is_active AND is_public) OR private.ks_is_platform_admin());

GRANT SELECT ON public.ks_saas_addons TO anon,authenticated;
