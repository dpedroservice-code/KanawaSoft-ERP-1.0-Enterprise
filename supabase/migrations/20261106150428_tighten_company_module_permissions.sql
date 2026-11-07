-- Tighten role/module checks for company finance and tax configuration.
create or replace function private.ks_has_company_permission(p_company_id uuid,p_module text,p_action text)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.ks_is_platform_admin()
 or private.ks_has_company_role(p_company_id,array['owner','admin']::text[])
 or (p_action='ver' and private.ks_has_company_role(p_company_id,array['manager','gerente','cashier','caixa','operator','operador']::text[]))
 or (p_action='editar' and p_module in ('financeiro','fiscal') and private.ks_has_company_role(p_company_id,array['manager','gerente']::text[]));
$$;
drop policy if exists ks_exchange_rates_member on public.ks_exchange_rates;
drop policy if exists ks_tax_rules_member on public.ks_tax_rules;
revoke all on function private.ks_has_company_permission(uuid,text,text) from public,anon;
grant execute on function private.ks_has_company_permission(uuid,text,text) to authenticated;
