-- Bind each issued activation key to the exact payment request reviewed by the platform admin.
alter table public.ks_license_keys
 add column if not exists payment_request_id uuid references public.ks_payment_requests(id) on delete set null;
drop function if exists public.ks_issue_license_key(text,integer);
create or replace function public.ks_issue_license_key(p_plan_code text,p_duration_months integer,p_payment_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_key text; v_plan public.ks_saas_plans%rowtype; v_id uuid; v_request public.ks_payment_requests%rowtype;
begin
 if not private.ks_is_platform_admin() then raise exception 'Apenas o administrador da plataforma pode emitir chaves'; end if;
 if p_duration_months not in (1,12,24,36) then raise exception 'Duração inválida'; end if;
 select * into v_plan from public.ks_saas_plans where plan_code=p_plan_code and is_active=true;
 if not found then raise exception 'Pacote não encontrado'; end if;
 if p_payment_request_id is not null then
  select * into v_request from public.ks_payment_requests where id=p_payment_request_id for update;
  if not found or v_request.status<>'pending' or v_request.plan_code<>p_plan_code or v_request.duration_months<>p_duration_months then
   raise exception 'Pedido de pagamento não corresponde ao pacote ou já foi processado';
  end if;
 end if;
 v_key := 'KANAWA-' || upper(encode(gen_random_bytes(4),'hex')) || '-' || upper(encode(gen_random_bytes(4),'hex')) || '-' || upper(encode(gen_random_bytes(4),'hex'));
 insert into public.ks_license_keys(key_hash,key_prefix,plan_code,duration_months,max_invoices_period,max_users,issued_by,expires_at,payment_request_id)
 values(encode(digest(v_key,'sha256'),'hex'),left(v_key,12),p_plan_code,p_duration_months,v_plan.max_invoices_period,v_plan.max_users,(select auth.uid()),now()+interval '90 days',p_payment_request_id)
 returning id into v_id;
 return jsonb_build_object('id',v_id,'license_key',v_key,'plan_code',p_plan_code,'duration_months',p_duration_months,'max_invoices_period',v_plan.max_invoices_period);
end $$;
revoke all on function public.ks_issue_license_key(text,integer,uuid) from public,anon;
grant execute on function public.ks_issue_license_key(text,integer,uuid) to authenticated;
drop function if exists public.ks_redeem_license_key(text);
create or replace function public.ks_redeem_license_key(p_license_key text,p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_key public.ks_license_keys%rowtype; v_license_id uuid; v_expiry timestamptz;
begin
 v_company:=p_company_id;
 if v_company is null or not private.ks_has_company_role(v_company,array['owner','admin']::text[]) then
  raise exception 'Apenas o proprietário ou administrador da empresa pode activar a licença';
 end if;
 select * into v_key from public.ks_license_keys
 where key_hash=encode(digest(trim(p_license_key),'sha256'),'hex') for update;
 if not found or v_key.status <> 'issued' or v_key.expires_at <= now() then raise exception 'Chave inválida, expirada ou já utilizada'; end if;
 if v_key.payment_request_id is not null and not exists(
  select 1 from public.ks_payment_requests r where r.id=v_key.payment_request_id and r.company_id=v_company and r.status='pending'
 ) then raise exception 'Esta chave não corresponde ao pedido de pagamento desta empresa'; end if;
 v_expiry:=now()+make_interval(months=>v_key.duration_months);
 insert into public.ks_company_licenses(company_id,plan_code,status,starts_at,expires_at,max_users_override,max_invoices_override,term_months_override)
 values(v_company,v_key.plan_code,'active',now(),v_expiry,v_key.max_users,v_key.max_invoices_period,v_key.duration_months)
 returning id into v_license_id;
 update public.ks_license_keys set status='redeemed',redeemed_by_company=v_company,redeemed_at=now() where id=v_key.id;
 if v_key.payment_request_id is not null then
  update public.ks_payment_requests set status='approved',reviewed_at=now()
  where id=v_key.payment_request_id and company_id=v_company;
 end if;
 insert into public.ks_license_activation_audit(company_id,license_id,action,actor_user_id,metadata)
 values(v_company,v_license_id,'license_redeemed',(select auth.uid()),jsonb_build_object('plan_code',v_key.plan_code,'duration_months',v_key.duration_months,'key_prefix',v_key.key_prefix));
 return jsonb_build_object('success',true,'plan_code',v_key.plan_code,'expires_at',v_expiry,'max_invoices_period',v_key.max_invoices_period);
end $$;
revoke all on function public.ks_redeem_license_key(text,uuid) from public,anon;
grant execute on function public.ks_redeem_license_key(text,uuid) to authenticated;
