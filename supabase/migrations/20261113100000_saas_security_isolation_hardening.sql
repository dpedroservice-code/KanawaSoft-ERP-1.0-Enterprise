-- Kanawa Soft SaaS security hardening.
-- Apply only after review on the isolated Supabase project; this migration is NOT
-- executed by this change. It closes permissive legacy RLS policies and scopes
-- administrative cancellation to the company that owns the selected sale.

begin;

-- Company owners may request a subscription, but cannot issue, edit, approve,
-- or delete licences and payment decisions for themselves.
drop policy if exists mg_ks_company_licenses_ins on public.ks_company_licenses;
drop policy if exists mg_ks_company_licenses_upd on public.ks_company_licenses;
drop policy if exists mg_ks_company_licenses_del on public.ks_company_licenses;

-- Payment requests are submitted by a company owner/admin and reviewed only
-- by the registered platform administrator. Do not allow company-level
-- generic finance permissions to approve or rewrite their own requests.
drop policy if exists mg_ks_payment_requests_ins on public.ks_payment_requests;
drop policy if exists mg_ks_payment_requests_sel on public.ks_payment_requests;
drop policy if exists mg_ks_payment_requests_upd on public.ks_payment_requests;
drop policy if exists mg_ks_payment_requests_del on public.ks_payment_requests;

-- Activation audit is append-only. The SECURITY DEFINER redemption function
-- records events; normal company users cannot fabricate, edit, or erase them.
drop policy if exists ks_license_activation_audit_manager_insert on public.ks_license_activation_audit;
drop policy if exists ks_license_activation_audit_manager_update on public.ks_license_activation_audit;
drop policy if exists ks_license_activation_audit_admin_delete on public.ks_license_activation_audit;
drop policy if exists mg_ks_license_activation_audit_ins on public.ks_license_activation_audit;
drop policy if exists mg_ks_license_activation_audit_upd on public.ks_license_activation_audit;
drop policy if exists mg_ks_license_activation_audit_del on public.ks_license_activation_audit;

-- Keep the platform-only restriction even if private schema exposure changes
-- in the future. The private schema itself remains unavailable to anon.
revoke all on function private.ks_issue_license_key_by_term(text,text,uuid) from public, anon;
grant execute on function private.ks_issue_license_key_by_term(text,text,uuid) to authenticated;

revoke all on function private.ks_has_company_role(uuid,text[]) from public, anon;
grant execute on function private.ks_has_company_role(uuid,text[]) to authenticated;

-- A company administrator is not the Kanawa platform administrator.
-- Keep company licence controls inaccessible to tenant-level roles.
create or replace function private.ks_has_company_permission(
  p_company_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_permissions jsonb;
  v_override jsonb;
  v_enabled boolean;
  v_module text := lower(trim(coalesce(p_module,'')));
  v_action text := lower(trim(coalesce(p_action,'')));
  v_allowed boolean;
begin
  if private.ks_is_platform_admin() then
    return true;
  end if;

  select lower(coalesce(m.role,'')), coalesce(m.permissions,'{}'::jsonb)
    into v_role, v_permissions
  from public.ks_company_memberships m
  where m.company_id=p_company_id
    and m.user_id=auth.uid()
    and m.status='active'
  limit 1;

  if not found then
    return false;
  end if;

  -- Licence administration is platform-owned, never tenant-owned.
  if v_module='licenca' then
    return false;
  end if;

  if v_role in ('owner','admin') then
    return true;
  end if;

  if v_role='gerente' then v_role:='manager'; end if;
  if v_role='contabilista' then v_role:='accountant'; end if;
  if v_role='operador' then v_role:='operator'; end if;
  if v_role='caixa' then v_role:='cashier'; end if;

  -- Other sensitive administration modules cannot be delegated by JSON.
  if v_module in ('usuarios','modulos','integracoes','config') then
    return false;
  end if;

  if v_action in ('configure','configuration') then v_action:='configurar'; end if;
  if v_action in ('view','read') then v_action:='ver'; end if;
  if v_action='create' then v_action:='criar'; end if;
  if v_action='edit' then v_action:='editar'; end if;
  if v_action='delete' then v_action:='excluir'; end if;
  if v_action='export' then v_action:='exportar'; end if;
  if v_action='approve' then v_action:='aprovar'; end if;
  if v_action='cancel' then v_action:='cancelar'; end if;

  select s.enabled into v_enabled
  from public.ks_company_module_settings s
  where s.company_id=p_company_id and s.module_id=v_module;

  if v_enabled is false then
    return false;
  end if;

  v_override:=v_permissions #> array['modules',v_module,v_action];
  if v_override is null then
    v_override:=v_permissions #> array[v_module,v_action];
  end if;

  if v_override is not null and jsonb_typeof(v_override)='boolean' then
    return (v_override::text)::boolean;
  end if;

  select case v_action
    when 'ver' then d.can_view
    when 'criar' then d.can_create
    when 'editar' then d.can_edit
    when 'excluir' then d.can_delete
    when 'exportar' then d.can_export
    when 'aprovar' then d.can_approve
    when 'cancelar' then d.can_cancel
    when 'configurar' then d.can_configure
    else false
  end
  into v_allowed
  from private.ks_role_module_defaults d
  where d.role=v_role and d.module_id=v_module;

  return coalesce(v_allowed,false);
end
$function$;

revoke all on function private.ks_has_company_permission(uuid,text,text) from public, anon;
grant execute on function private.ks_has_company_permission(uuid,text,text) to authenticated;

-- Resolve the sale through the caller's own active owner/admin memberships.
-- If the same external ID matches more than one accessible company, fail closed.
create or replace function public.ks_admin_cancel_sale(
  p_sale_external_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_companies uuid[];
  v_company uuid;
  v_sale public.ks_sales%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.' using errcode='42501';
  end if;

  if length(trim(coalesce(p_reason,''))) < 5 then
    raise exception 'Indique um motivo com pelo menos 5 caracteres.'
      using errcode='22023';
  end if;

  select array_agg(distinct s.company_id)
    into v_companies
  from public.ks_sales s
  join public.ks_company_memberships m
    on m.company_id=s.company_id
   and m.user_id=auth.uid()
   and m.status='active'
   and lower(m.role) in ('owner','admin','administrator')
  where s.external_id=p_sale_external_id;

  if coalesce(cardinality(v_companies),0) <> 1 then
    raise exception 'Venda inexistente, ambígua ou sem permissão nesta empresa.'
      using errcode='42501';
  end if;

  v_company:=v_companies[1];

  select *
    into v_sale
  from public.ks_sales
  where company_id=v_company
    and external_id=p_sale_external_id
  for update;

  if not found then
    raise exception 'Venda não encontrada.' using errcode='P0002';
  end if;

  if v_sale.status not in ('finalizada','finalizado') then
    raise exception 'A venda já foi cancelada ou não está finalizada.'
      using errcode='22023';
  end if;

  update public.ks_sales
  set status='cancelada',
      cancelled_at=now(),
      cancelled_by=auth.uid(),
      cancellation_reason=trim(p_reason)
  where id=v_sale.id and company_id=v_company;

  update public.ks_records
  set payload=jsonb_set(payload,'{status}','"cancelada"'::jsonb,true),
      updated_at=now()
  where company_id=v_company
    and store_key='vendas'
    and record_id=p_sale_external_id;

  insert into public.ks_audit_events(
    company_id,actor_user_id,action,resource_type,resource_id,details
  )
  values(
    v_company,auth.uid(),'sale_cancelled_by_admin','sale',p_sale_external_id,
    jsonb_build_object(
      'invoice_number',v_sale.invoice_number,
      'reason',trim(p_reason),
      'source','admin_sales_screen'
    )
  );

  return jsonb_build_object(
    'sale_id',v_sale.id,
    'invoice_number',v_sale.invoice_number,
    'status','cancelada'
  );
end
$function$;

revoke all on function public.ks_admin_cancel_sale(text,text) from public, anon;
grant execute on function public.ks_admin_cancel_sale(text,text) to authenticated;

commit;
