-- KanawaSoft 1.0 — remove permissive RLS overlaps without changing access semantics.
-- Read predicates that were duplicated are combined; FOR ALL admin policies are split
-- into write-only commands so they no longer grant an overlapping SELECT path.

-- Companies: preserve member/owner/branch reads and platform-admin reads in one policy.
DROP POLICY IF EXISTS ks_companies_platform_admin_read ON public.ks_companies;
DROP POLICY IF EXISTS company_read_member ON public.ks_companies;
CREATE POLICY company_read_member
ON public.ks_companies
FOR SELECT TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.ks_company_memberships m
    WHERE m.company_id = ks_companies.id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.ks_company_branches b
    JOIN public.ks_company_memberships m
      ON ((b.parent_company_id = ks_companies.id AND m.company_id = b.branch_company_id)
       OR (b.branch_company_id = ks_companies.id AND m.company_id = b.parent_company_id))
    WHERE b.status = 'active'
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  )
  OR private.ks_is_platform_admin()
);

-- Company memberships: self, company admins and platform admins remain readable.
DROP POLICY IF EXISTS ks_memberships_platform_admin_read ON public.ks_company_memberships;
DROP POLICY IF EXISTS membership_read_self ON public.ks_company_memberships;
DROP POLICY IF EXISTS membership_read_company_admin ON public.ks_company_memberships;
CREATE POLICY membership_read_company_admin
ON public.ks_company_memberships
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR private.ks_has_company_role(company_id, ARRAY['owner','admin']::text[])
  OR private.ks_is_platform_admin()
);

-- Company licenses: preserve platform-admin writes, but make them write-only.
DROP POLICY IF EXISTS ks_company_licenses_admin_write ON public.ks_company_licenses;
CREATE POLICY ks_company_licenses_admin_insert ON public.ks_company_licenses
FOR INSERT TO authenticated
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_company_licenses_admin_update ON public.ks_company_licenses
FOR UPDATE TO authenticated
USING (private.ks_is_platform_admin())
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_company_licenses_admin_delete ON public.ks_company_licenses
FOR DELETE TO authenticated
USING (private.ks_is_platform_admin());

-- Exchange rates: SELECT retains both the read and edit capability that the old FOR ALL policy implied.
DROP POLICY IF EXISTS ks_exchange_rates_read_by_permission ON public.ks_exchange_rates;
DROP POLICY IF EXISTS ks_exchange_rates_write_by_permission ON public.ks_exchange_rates;
CREATE POLICY ks_exchange_rates_read_by_permission ON public.ks_exchange_rates
FOR SELECT TO authenticated
USING (
  private.ks_has_company_permission(company_id,'financeiro','ver')
  OR private.ks_has_company_permission(company_id,'financeiro','editar')
);
CREATE POLICY ks_exchange_rates_insert_by_permission ON public.ks_exchange_rates
FOR INSERT TO authenticated
WITH CHECK (private.ks_has_company_permission(company_id,'financeiro','editar'));
CREATE POLICY ks_exchange_rates_update_by_permission ON public.ks_exchange_rates
FOR UPDATE TO authenticated
USING (private.ks_has_company_permission(company_id,'financeiro','editar'))
WITH CHECK (private.ks_has_company_permission(company_id,'financeiro','editar'));
CREATE POLICY ks_exchange_rates_delete_by_permission ON public.ks_exchange_rates
FOR DELETE TO authenticated
USING (private.ks_has_company_permission(company_id,'financeiro','editar'));

-- Installations: preserve company-member CRUD and platform-admin CRUD, without an admin SELECT policy.
DROP POLICY IF EXISTS ks_installations_admin_write ON public.ks_installations;
CREATE POLICY ks_installations_admin_insert ON public.ks_installations
FOR INSERT TO authenticated
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_installations_admin_update ON public.ks_installations
FOR UPDATE TO authenticated
USING (private.ks_is_platform_admin())
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_installations_admin_delete ON public.ks_installations
FOR DELETE TO authenticated
USING (private.ks_is_platform_admin());

-- Daily license usage: preserve platform-admin writes, with read access handled by the existing read policy.
DROP POLICY IF EXISTS ks_usage_daily_admin_write ON public.ks_license_usage_daily;
CREATE POLICY ks_usage_daily_admin_insert ON public.ks_license_usage_daily
FOR INSERT TO authenticated
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_usage_daily_admin_update ON public.ks_license_usage_daily
FOR UPDATE TO authenticated
USING (private.ks_is_platform_admin())
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_usage_daily_admin_delete ON public.ks_license_usage_daily
FOR DELETE TO authenticated
USING (private.ks_is_platform_admin());

-- Profiles: the company-admin read policy already includes self; remove redundant self policy.
DROP POLICY IF EXISTS profile_read_self ON public.ks_profiles;

-- SaaS plans: preserve platform-admin writes and public plan reads without an overlapping SELECT policy.
DROP POLICY IF EXISTS ks_saas_plans_admin_write ON public.ks_saas_plans;
CREATE POLICY ks_saas_plans_admin_insert ON public.ks_saas_plans
FOR INSERT TO authenticated
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_saas_plans_admin_update ON public.ks_saas_plans
FOR UPDATE TO authenticated
USING (private.ks_is_platform_admin())
WITH CHECK (private.ks_is_platform_admin());
CREATE POLICY ks_saas_plans_admin_delete ON public.ks_saas_plans
FOR DELETE TO authenticated
USING (private.ks_is_platform_admin());

-- Tax rules: SELECT retains the prior effective read OR edit capability.
DROP POLICY IF EXISTS ks_tax_rules_read_by_permission ON public.ks_tax_rules;
DROP POLICY IF EXISTS ks_tax_rules_write_by_permission ON public.ks_tax_rules;
CREATE POLICY ks_tax_rules_read_by_permission ON public.ks_tax_rules
FOR SELECT TO authenticated
USING (
  private.ks_has_company_permission(company_id,'fiscal','ver')
  OR private.ks_has_company_permission(company_id,'fiscal','editar')
);
CREATE POLICY ks_tax_rules_insert_by_permission ON public.ks_tax_rules
FOR INSERT TO authenticated
WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','editar'));
CREATE POLICY ks_tax_rules_update_by_permission ON public.ks_tax_rules
FOR UPDATE TO authenticated
USING (private.ks_has_company_permission(company_id,'fiscal','editar'))
WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','editar'));
CREATE POLICY ks_tax_rules_delete_by_permission ON public.ks_tax_rules
FOR DELETE TO authenticated
USING (private.ks_has_company_permission(company_id,'fiscal','editar'));
