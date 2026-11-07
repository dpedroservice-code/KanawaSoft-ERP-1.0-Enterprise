-- Merge self and company-admin profile visibility into a single SELECT policy.
drop policy if exists ks_profiles_self on public.ks_profiles;
drop policy if exists ks_profiles_company_admin_read on public.ks_profiles;
create policy ks_profiles_select_self_or_company_admin on public.ks_profiles for select to authenticated
 using(
  user_id=(select auth.uid())
  or exists(
   select 1 from public.ks_company_memberships m
   where m.user_id=ks_profiles.user_id and m.status in ('active','invited')
    and private.ks_has_company_role(m.company_id,array['owner','admin']::text[])
  )
 );
create policy ks_profiles_self_insert on public.ks_profiles for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy ks_profiles_self_update on public.ks_profiles for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy ks_profiles_self_delete on public.ks_profiles for delete to authenticated
 using(user_id=(select auth.uid()));
