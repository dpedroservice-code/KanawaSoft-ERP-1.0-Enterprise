-- Keep privileged SECURITY DEFINER implementations outside exposed API schemas.
-- Public RPC names remain as SECURITY INVOKER wrappers for the existing client contract.
alter function public.ks_issue_license_key(text,integer,uuid) set schema private;
alter function public.ks_redeem_license_key(text,uuid) set schema private;
alter function public.ks_get_company_entitlements(uuid) set schema private;
alter function public.ks_finalize_sale(uuid,jsonb,jsonb) set schema private;
alter function public.ks_handle_new_user() set schema private;

grant usage on schema private to authenticated;
revoke all on function private.ks_issue_license_key(text,integer,uuid) from public,anon;
revoke all on function private.ks_redeem_license_key(text,uuid) from public,anon;
revoke all on function private.ks_get_company_entitlements(uuid) from public,anon;
revoke all on function private.ks_finalize_sale(uuid,jsonb,jsonb) from public,anon;
grant execute on function private.ks_issue_license_key(text,integer,uuid) to authenticated;
grant execute on function private.ks_redeem_license_key(text,uuid) to authenticated;
grant execute on function private.ks_get_company_entitlements(uuid) to authenticated;
grant execute on function private.ks_finalize_sale(uuid,jsonb,jsonb) to authenticated;

create or replace function public.ks_issue_license_key(p_plan_code text,p_duration_months integer,p_payment_request_id uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.ks_issue_license_key(p_plan_code,p_duration_months,p_payment_request_id);
$$;
create or replace function public.ks_redeem_license_key(p_license_key text,p_company_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.ks_redeem_license_key(p_license_key,p_company_id);
$$;
create or replace function public.ks_get_company_entitlements(p_company_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select private.ks_get_company_entitlements(p_company_id);
$$;
create or replace function public.ks_finalize_sale(p_company_id uuid,p_sale jsonb,p_items jsonb)
returns uuid language sql security invoker set search_path = '' as $$
 select private.ks_finalize_sale(p_company_id,p_sale,p_items);
$$;

revoke all on function public.ks_issue_license_key(text,integer,uuid) from public,anon;
revoke all on function public.ks_redeem_license_key(text,uuid) from public,anon;
revoke all on function public.ks_get_company_entitlements(uuid) from public,anon;
revoke all on function public.ks_finalize_sale(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.ks_issue_license_key(text,integer,uuid) to authenticated;
grant execute on function public.ks_redeem_license_key(text,uuid) to authenticated;
grant execute on function public.ks_get_company_entitlements(uuid) to authenticated;
grant execute on function public.ks_finalize_sale(uuid,jsonb,jsonb) to authenticated;
