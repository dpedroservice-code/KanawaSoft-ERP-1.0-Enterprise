-- Match the security hardening applied to the dedicated Supabase project.
grant usage on schema private to authenticated;
revoke all on function public.ks_handle_new_user() from public,anon,authenticated;
revoke all on function public.ks_sync_product(uuid,jsonb) from public,anon;
revoke all on function public.ks_finalize_sale(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.ks_get_company_entitlements(uuid) from public,anon;
grant execute on function public.ks_sync_product(uuid,jsonb) to authenticated;
grant execute on function public.ks_finalize_sale(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.ks_get_company_entitlements(uuid) to authenticated;
grant execute on function private.ks_is_platform_admin() to authenticated;
grant execute on function private.ks_has_company_role(uuid,text[]) to authenticated;
grant execute on function private.ks_has_company_permission(uuid,text,text) to authenticated;

create or replace function public.ks_get_company_entitlements(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]) then
  raise exception 'Sem acesso aos limites desta empresa';
 end if;
 return (select jsonb_build_object(
  'company_id',p_company_id,
  'license',(select to_jsonb(l) from public.ks_company_licenses l where l.company_id=p_company_id order by l.created_at desc limit 1),
  'plan',(select to_jsonb(p) from public.ks_saas_plans p join public.ks_company_licenses l on l.plan_code=p.plan_code where l.company_id=p_company_id order by l.created_at desc limit 1)
 ));
end $$;
revoke all on function public.ks_get_company_entitlements(uuid) from public,anon;
grant execute on function public.ks_get_company_entitlements(uuid) to authenticated;
