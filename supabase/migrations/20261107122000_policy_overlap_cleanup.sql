-- Consolidate overlapping foundation policies and remove the stale malformed company SELECT policy.
drop policy if exists ks_companies_select_member on public.ks_companies;

drop policy if exists ks_memberships_read_self on public.ks_company_memberships;
-- Keep membership_read_company_admin: self, company admins and platform admins.

drop policy if exists ks_installations_admin_delete on public.ks_installations;
drop policy if exists ks_installations_admin_insert on public.ks_installations;
drop policy if exists ks_installations_admin_update on public.ks_installations;
drop policy if exists ks_installations_member on public.ks_installations;
create policy ks_installations_member on public.ks_installations for all to authenticated
 using(private.ks_is_platform_admin() or private.ks_has_company_role(company_id,array['owner','admin','manager','cashier','operator','gerente','caixa','operador']::text[]))
 with check(private.ks_is_platform_admin() or private.ks_has_company_role(company_id,array['owner','admin','manager','cashier','operator','gerente','caixa','operador']::text[]));

drop policy if exists ks_profiles_company_admin_read on public.ks_profiles;
create policy ks_profiles_company_admin_read on public.ks_profiles for select to authenticated
 using(user_id<>(select auth.uid()) and exists(
  select 1 from public.ks_company_memberships m
  where m.user_id=ks_profiles.user_id and m.status in ('active','invited')
   and private.ks_has_company_role(m.company_id,array['owner','admin']::text[])
 ));
