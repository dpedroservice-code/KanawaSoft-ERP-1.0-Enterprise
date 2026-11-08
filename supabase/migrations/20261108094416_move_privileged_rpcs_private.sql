-- Keep PostgREST RPC names stable while moving privileged implementations out of public.
begin;

alter function public.ks_accounting_reports(uuid,date,date) set schema private;
alter function private.ks_accounting_reports(uuid,date,date) rename to ks_accounting_reports_secure_impl;
revoke all on function private.ks_accounting_reports_secure_impl(uuid,date,date) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.ks_accounting_reports_secure_impl(uuid,date,date) to authenticated;
create or replace function public.ks_accounting_reports(p_company_id uuid,p_from_date date,p_to_date date)
returns jsonb language sql stable security invoker set search_path to ''
as $$ select private.ks_accounting_reports_secure_impl($1,$2,$3); $$;
revoke all on function public.ks_accounting_reports(uuid,date,date) from public, anon;
grant execute on function public.ks_accounting_reports(uuid,date,date) to authenticated;

alter function public.ks_seed_angola_chart_of_accounts(uuid,jsonb) set schema private;
alter function private.ks_seed_angola_chart_of_accounts(uuid,jsonb) rename to ks_seed_angola_chart_of_accounts_secure_impl;
revoke all on function private.ks_seed_angola_chart_of_accounts_secure_impl(uuid,jsonb) from public, anon;
grant execute on function private.ks_seed_angola_chart_of_accounts_secure_impl(uuid,jsonb) to authenticated;
create or replace function public.ks_seed_angola_chart_of_accounts(p_company_id uuid,p_accounts jsonb)
returns jsonb language sql security invoker set search_path to ''
as $$ select private.ks_seed_angola_chart_of_accounts_secure_impl($1,$2); $$;
revoke all on function public.ks_seed_angola_chart_of_accounts(uuid,jsonb) from public, anon;
grant execute on function public.ks_seed_angola_chart_of_accounts(uuid,jsonb) to authenticated;

alter function public.ks_set_company_module_enabled(uuid,text,boolean) set schema private;
alter function private.ks_set_company_module_enabled(uuid,text,boolean) rename to ks_set_company_module_enabled_secure_impl;
revoke all on function private.ks_set_company_module_enabled_secure_impl(uuid,text,boolean) from public, anon;
grant execute on function private.ks_set_company_module_enabled_secure_impl(uuid,text,boolean) to authenticated;
create or replace function public.ks_set_company_module_enabled(p_company_id uuid,p_module_id text,p_enabled boolean)
returns jsonb language sql security invoker set search_path to ''
as $$ select private.ks_set_company_module_enabled_secure_impl($1,$2,$3); $$;
revoke all on function public.ks_set_company_module_enabled(uuid,text,boolean) from public, anon;
grant execute on function public.ks_set_company_module_enabled(uuid,text,boolean) to authenticated;

commit;
