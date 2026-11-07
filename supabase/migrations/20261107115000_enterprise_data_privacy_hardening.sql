-- Sensitive HR, legal and financial records are visible only to company owners/admins/managers.
do $$
declare t text;
begin
 foreach t in array array[
 'ks_company_legal_profiles','ks_company_parties','ks_company_documents','ks_employee_documents',
 'ks_employee_compensation_history','ks_leave_balances','ks_leave_requests','ks_general_expenses',
 'ks_payroll_runs','ks_payroll_items','ks_approval_requests','ks_approval_steps','ks_budgets',
 'ks_budget_lines','ks_license_activation_audit'
 ] loop
  execute format('drop policy if exists %I on public.%I',t||'_member_read',t);
  execute format('create policy %I on public.%I for select to authenticated using (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'']::text[]))',t||'_manager_read',t);
 end loop;
end $$;

-- Entitlements are scoped to the authenticated user's own active company membership.
create or replace function public.ks_get_company_entitlements(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]) then
  raise exception 'Acesso negado às permissões desta empresa';
 end if;
 return (
  select jsonb_build_object(
   'company_id',p_company_id,
   'license',(select to_jsonb(l)-'license_key' from public.ks_company_licenses l where l.company_id=p_company_id order by l.created_at desc limit 1),
   'plan',(select to_jsonb(p) from public.ks_saas_plans p join public.ks_company_licenses l on l.plan_code=p.plan_code where l.company_id=p_company_id order by l.created_at desc limit 1),
   'invoice_limit',(select coalesce(l.max_invoices_override,p.max_invoices_period) from public.ks_company_licenses l join public.ks_saas_plans p on p.plan_code=l.plan_code where l.company_id=p_company_id order by l.created_at desc limit 1),
   'invoice_usage',(select coalesce(sum(u.invoices_count),0) from public.ks_license_usage_daily u where u.company_id=p_company_id and u.usage_date>=date_trunc('month',now())::date),
   'read_only',not exists(select 1 from public.ks_company_licenses l where l.company_id=p_company_id and l.status in ('trial','active') and l.expires_at>now())
  )
 );
end $$;
revoke all on function public.ks_get_company_entitlements(uuid) from public,anon;
grant execute on function public.ks_get_company_entitlements(uuid) to authenticated;

drop policy if exists ks_leave_requests_manager_read on public.ks_leave_requests;
create policy ks_leave_requests_employee_or_manager_read on public.ks_leave_requests for select to authenticated
 using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
 or requested_by=(select auth.uid()));
