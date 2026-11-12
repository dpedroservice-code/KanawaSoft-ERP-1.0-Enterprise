-- Make admin sale cancellation explicitly tenant-scoped and hide the privileged implementation.
-- The old public(text,text) SECURITY DEFINER signature selected the user's oldest active
-- company membership, which is ambiguous for users belonging to more than one company.

drop function if exists public.ks_admin_cancel_sale(text, text);

create or replace function private.ks_admin_cancel_sale_internal(
  p_company_id uuid,
  p_sale_external_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sale public.ks_sales%rowtype;
begin
  if p_company_id is null
     or not private.ks_has_company_role(p_company_id, array['owner','admin','administrator']) then
    raise exception 'Apenas o administrador da empresa seleccionada pode cancelar uma venda.' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 then
    raise exception 'Indique um motivo com pelo menos 5 caracteres.' using errcode='22023';
  end if;

  select * into v_sale
  from public.ks_sales
  where company_id = p_company_id
    and external_id = p_sale_external_id
  for update;

  if not found then
    raise exception 'Venda não encontrada na empresa seleccionada.' using errcode='P0002';
  end if;
  if v_sale.status not in ('finalizada','finalizado') then
    raise exception 'A venda já foi cancelada ou não está finalizada.' using errcode='22023';
  end if;

  update public.ks_sales
    set status='cancelada',
        cancelled_at=now(),
        cancelled_by=(select auth.uid()),
        cancellation_reason=trim(p_reason)
  where id=v_sale.id and company_id=p_company_id;

  update public.ks_records
    set payload=jsonb_set(payload,'{status}','"cancelada"'::jsonb,true),
        updated_at=now()
  where company_id=p_company_id
    and store_key='vendas'
    and record_id=p_sale_external_id;

  insert into public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  values(
    p_company_id,
    (select auth.uid()),
    'sale_cancelled_by_admin',
    'sale',
    p_sale_external_id,
    jsonb_build_object(
      'invoice_number',v_sale.invoice_number,
      'reason',trim(p_reason),
      'source','admin_sales_screen'
    )
  );

  return jsonb_build_object(
    'sale_id',v_sale.id,
    'invoice_number',v_sale.invoice_number,
    'status','cancelada',
    'company_id',p_company_id
  );
end;
$function$;

create or replace function public.ks_admin_cancel_sale(
  p_company_id uuid,
  p_sale_external_id text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.ks_admin_cancel_sale_internal(
    p_company_id,
    p_sale_external_id,
    p_reason
  );
$function$;

revoke all on function private.ks_admin_cancel_sale_internal(uuid,text,text) from public, anon;
grant execute on function private.ks_admin_cancel_sale_internal(uuid,text,text) to authenticated;

revoke all on function public.ks_admin_cancel_sale(uuid,text,text) from public, anon;
grant execute on function public.ks_admin_cancel_sale(uuid,text,text) to authenticated;
