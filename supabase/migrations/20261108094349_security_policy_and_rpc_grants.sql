-- Consolidate overlapping permissive policies without broadening tenant access.
-- Also remove anonymous execution from public SECURITY DEFINER RPCs.
begin;

-- Membership creation/update: one policy per operation, including accountant roles.
drop policy if exists ks_memberships_admin_insert on public.ks_company_memberships;
drop policy if exists ks_memberships_admin_insert_accountant on public.ks_company_memberships;
create policy ks_memberships_admin_insert on public.ks_company_memberships
for insert to authenticated with check (
  private.ks_has_company_role(company_id,array['owner','admin']::text[])
  and role = any(array['manager','operator','cashier','accountant','gerente','operador','caixa','contabilista']::text[])
);

drop policy if exists ks_memberships_admin_update on public.ks_company_memberships;
drop policy if exists ks_memberships_admin_update_accountant on public.ks_company_memberships;
create policy ks_memberships_admin_update on public.ks_company_memberships
for update to authenticated
using (
  private.ks_has_company_role(company_id,array['owner','admin']::text[])
  and role <> all(array['owner','admin']::text[])
  and user_id <> (select auth.uid())
)
with check (
  private.ks_has_company_role(company_id,array['owner','admin']::text[])
  and role = any(array['manager','operator','cashier','accountant','gerente','operador','caixa','contabilista']::text[])
  and user_id <> (select auth.uid())
);

-- Module settings: read once for members, write only for company owners/admins.
drop policy if exists ks_company_modules_admin_write on public.ks_company_module_settings;
drop policy if exists ks_company_modules_member_read on public.ks_company_module_settings;
create policy ks_company_modules_read on public.ks_company_module_settings
for select to authenticated using (
  private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','accountant','contabilista','operator','operador','cashier','caixa']::text[])
);
create policy ks_company_modules_insert on public.ks_company_module_settings
for insert to authenticated with check (
  private.ks_has_company_role(company_id,array['owner','admin']::text[])
);
create policy ks_company_modules_update on public.ks_company_module_settings
for update to authenticated
using (private.ks_has_company_role(company_id,array['owner','admin']::text[]))
with check (private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_company_modules_delete on public.ks_company_module_settings
for delete to authenticated using (
  private.ks_has_company_role(company_id,array['owner','admin']::text[])
);

-- Public tax catalog is readable by signed-in users; only platform admins can mutate it.
drop policy if exists ks_tax_rule_catalog_platform_write on public.ks_tax_rule_catalog;
drop policy if exists ks_tax_rule_catalog_read on public.ks_tax_rule_catalog;
create policy ks_tax_rule_catalog_read on public.ks_tax_rule_catalog
for select to authenticated using (true);
create policy ks_tax_rule_catalog_platform_insert on public.ks_tax_rule_catalog
for insert to authenticated with check (private.ks_is_platform_admin());
create policy ks_tax_rule_catalog_platform_update on public.ks_tax_rule_catalog
for update to authenticated using (private.ks_is_platform_admin())
with check (private.ks_is_platform_admin());
create policy ks_tax_rule_catalog_platform_delete on public.ks_tax_rule_catalog
for delete to authenticated using (private.ks_is_platform_admin());

-- Invitation creation preserves creator, pending state and short expiry constraints.
drop policy if exists ks_team_invitations_admin_insert on public.ks_team_invitations;
drop policy if exists ks_team_invitation_admin_insert_accountant on public.ks_team_invitations;
create policy ks_team_invitations_admin_insert on public.ks_team_invitations
for insert to authenticated with check (
  private.ks_has_company_role(company_id,array['owner','admin']::text[])
  and role = any(array['manager','operator','cashier','accountant','gerente','operador','caixa','contabilista']::text[])
  and created_by = (select auth.uid())
  and accepted_at is null
  and accepted_by is null
  and expires_at > now()
  and expires_at <= (now() + interval '7 days')
);

-- Public RPCs retain authenticated use and their in-function company permission checks.
revoke all on function public.ks_accounting_reports(uuid,date,date) from public, anon;
grant execute on function public.ks_accounting_reports(uuid,date,date) to authenticated;
revoke all on function public.ks_seed_angola_chart_of_accounts(uuid,jsonb) from public, anon;
grant execute on function public.ks_seed_angola_chart_of_accounts(uuid,jsonb) to authenticated;
revoke all on function public.ks_set_company_module_enabled(uuid,text,boolean) from public, anon;
grant execute on function public.ks_set_company_module_enabled(uuid,text,boolean) to authenticated;

commit;
