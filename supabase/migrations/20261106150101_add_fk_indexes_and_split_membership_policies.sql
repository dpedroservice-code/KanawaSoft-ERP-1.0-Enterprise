-- Supporting indexes and explicit membership write policies.
create index if not exists ks_companies_owner_user_idx on public.ks_companies(owner_user_id);
create index if not exists ks_company_branches_branch_company_idx on public.ks_company_branches(branch_company_id);
create index if not exists ks_exchange_rates_company_idx on public.ks_exchange_rates(company_id);
create index if not exists ks_installations_user_idx on public.ks_installations(user_id);
create index if not exists ks_sale_items_company_idx on public.ks_sale_items(company_id);
create index if not exists ks_sale_items_sale_idx on public.ks_sale_items(sale_id);

drop policy if exists ks_memberships_admin_write on public.ks_company_memberships;
create policy ks_memberships_admin_insert on public.ks_company_memberships
for insert to authenticated with check(private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_memberships_admin_update on public.ks_company_memberships
for update to authenticated using(private.ks_has_company_role(company_id,array['owner','admin']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_memberships_admin_delete on public.ks_company_memberships
for delete to authenticated using(private.ks_has_company_role(company_id,array['owner','admin']::text[]));
