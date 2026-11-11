-- Kanawa Soft external licensing console.
-- Access is bound to auth.uid(); email text supplied by a client is never an authorization source.

create table if not exists public.ks_license_distributors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allowed_plan_codes text[] not null default array['trial','mini','standard','premium','enterprise']::text[],
  status text not null default 'active' check (status in ('active','disabled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ks_license_management_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ks_license_distributors_status_idx
  on public.ks_license_distributors(status);
create index if not exists ks_license_keys_issued_by_created_idx
  on public.ks_license_keys(issued_by, created_at desc);
create index if not exists ks_installations_company_seen_idx
  on public.ks_installations(company_id, last_seen_at desc);

alter table public.ks_license_distributors enable row level security;
alter table public.ks_license_management_audit enable row level security;
revoke all on public.ks_license_distributors from public, anon, authenticated;
revoke all on public.ks_license_management_audit from public, anon, authenticated;

create or replace function private.ks_is_license_distributor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ks_license_distributors d
    where d.user_id = (select auth.uid()) and d.status = 'active'
  );
$$;
revoke all on function private.ks_is_license_distributor() from public, anon;
grant execute on function private.ks_is_license_distributor() to authenticated, service_role;

create or replace function private.ks_can_issue_license_plan(p_plan_code text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.ks_is_platform_admin()
    or exists (
      select 1 from public.ks_license_distributors d
      where d.user_id = (select auth.uid())
        and d.status = 'active'
        and p_plan_code = any(d.allowed_plan_codes)
    );
$$;
revoke all on function private.ks_can_issue_license_plan(text) from public, anon;
grant execute on function private.ks_can_issue_license_plan(text) to authenticated, service_role;

-- Replace the existing owner-only issuer with owner/distributor authorization.
-- Internal/lifetime terms remain owner-only at the database boundary.
create or replace function private.ks_issue_license_key_by_term(
  p_plan_code text,
  p_term_code text,
  p_payment_request_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text;
  v_plan public.ks_saas_plans%rowtype;
  v_term public.ks_license_terms%rowtype;
  v_id uuid;
  v_request public.ks_payment_requests%rowtype;
  v_owner boolean := private.ks_is_platform_admin();
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticação obrigatória' using errcode = '42501';
  end if;
  if not v_owner and not private.ks_is_license_distributor() then
    raise exception 'Acesso reservado ao proprietário ou distribuidor autorizado' using errcode = '42501';
  end if;

  select * into v_plan from public.ks_saas_plans
  where plan_code = p_plan_code and is_active = true;
  if not found then raise exception 'Pacote não encontrado ou inactivo'; end if;

  select * into v_term from public.ks_license_terms
  where term_code = p_term_code and is_active = true;
  if not found then raise exception 'Prazo de licença inválido ou inactivo'; end if;

  if (v_term.internal_only or v_term.is_lifetime or p_plan_code = 'internal_lifetime') and not v_owner then
    raise exception 'A licença vitalícia e os prazos internos são exclusivos do proprietário' using errcode = '42501';
  end if;
  if v_term.internal_only and p_plan_code <> 'internal_lifetime' then
    raise exception 'O prazo interno só pode ser usado no pacote interno';
  end if;
  if p_plan_code = 'internal_lifetime' and not v_term.is_lifetime then
    raise exception 'A licença interna exige o prazo vitalício';
  end if;
  if not v_owner and not private.ks_can_issue_license_plan(p_plan_code) then
    raise exception 'O seu perfil não tem autorização para emitir este pacote' using errcode = '42501';
  end if;
  if v_term.is_lifetime and p_payment_request_id is not null then
    raise exception 'A licença vitalícia interna não pode estar associada a um pedido de pagamento';
  end if;

  if p_payment_request_id is not null then
    select * into v_request from public.ks_payment_requests
    where id = p_payment_request_id for update;
    if not found or v_request.status <> 'pending'
       or v_request.plan_code <> p_plan_code
       or v_request.term_code <> p_term_code
       or v_request.duration_months <> v_term.duration_months
       or v_request.duration_days <> v_term.duration_days then
      raise exception 'Pedido de pagamento não corresponde ao pacote ou prazo, ou já foi processado';
    end if;
  end if;

  v_key := 'KANAWA-' || upper(encode(extensions.gen_random_bytes(4),'hex')) || '-' ||
           upper(encode(extensions.gen_random_bytes(4),'hex')) || '-' ||
           upper(encode(extensions.gen_random_bytes(4),'hex'));

  insert into public.ks_license_keys
    (key_hash,key_prefix,plan_code,term_code,duration_months,duration_days,
     max_invoices_period,max_users,issued_by,expires_at,payment_request_id)
  values
    (encode(extensions.digest(v_key,'sha256'),'hex'),left(v_key,12),p_plan_code,p_term_code,
     v_term.duration_months,v_term.duration_days,v_plan.max_invoices_period,v_plan.max_users,
     (select auth.uid()),now()+interval '90 days',p_payment_request_id)
  returning id into v_id;

  insert into public.ks_license_management_audit(actor_user_id,action,metadata)
  values ((select auth.uid()),'license_key_issued',
    jsonb_build_object('license_key_id',v_id,'plan_code',p_plan_code,'term_code',p_term_code,
      'is_lifetime',v_term.is_lifetime,'payment_request_id',p_payment_request_id));

  return jsonb_build_object(
    'id',v_id,'license_key',v_key,'plan_code',p_plan_code,'term_code',p_term_code,
    'duration_months',v_term.duration_months,'duration_days',v_term.duration_days,
    'is_lifetime',v_term.is_lifetime,'key_valid_until',now()+interval '90 days',
    'max_invoices_period',v_plan.max_invoices_period
  );
end;
$$;
revoke all on function private.ks_issue_license_key_by_term(text,text,uuid) from public, anon;
grant execute on function private.ks_issue_license_key_by_term(text,text,uuid) to authenticated, service_role;

create or replace function public.ks_issue_license_key_by_term(
  p_plan_code text,
  p_term_code text,
  p_payment_request_id uuid default null
)
returns jsonb
language sql security invoker set search_path = ''
as $$
  select private.ks_issue_license_key_by_term(p_plan_code,p_term_code,p_payment_request_id);
$$;
revoke all on function public.ks_issue_license_key_by_term(text,text,uuid) from public, anon;
grant execute on function public.ks_issue_license_key_by_term(text,text,uuid) to authenticated;

create or replace function public.ks_license_console_bootstrap()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner boolean := private.ks_is_platform_admin();
  v_distributor boolean := private.ks_is_license_distributor();
begin
  if not v_owner and not v_distributor then
    raise exception 'Sem permissão para aceder ao Centro de Licenças' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'role',case when v_owner then 'owner' else 'distributor' end,
    'plans',(select coalesce(jsonb_agg(jsonb_build_object('plan_code',p.plan_code,'name',p.name)
      order by p.display_order),'[]'::jsonb)
      from public.ks_saas_plans p
      where p.is_active and (v_owner or (p.plan_code <> 'internal_lifetime' and private.ks_can_issue_license_plan(p.plan_code)))),
    'terms',(select coalesce(jsonb_agg(jsonb_build_object('term_code',t.term_code,'name',t.name,
      'duration_days',t.duration_days,'duration_months',t.duration_months)
      order by t.display_order),'[]'::jsonb)
      from public.ks_license_terms t
      where t.is_active and not t.internal_only and not t.is_lifetime),
    'owner_terms',(select coalesce(jsonb_agg(jsonb_build_object('term_code',t.term_code,'name',t.name,
      'duration_days',t.duration_days,'duration_months',t.duration_months,'is_lifetime',t.is_lifetime)
      order by t.display_order),'[]'::jsonb)
      from public.ks_license_terms t where t.is_active and (v_owner and (t.internal_only or t.is_lifetime)))
  );
end;
$$;
revoke all on function public.ks_license_console_bootstrap() from public, anon;
grant execute on function public.ks_license_console_bootstrap() to authenticated;

create or replace function public.ks_license_console_overview()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner boolean := private.ks_is_platform_admin();
  v_distributor boolean := private.ks_is_license_distributor();
  v_user uuid := (select auth.uid());
  v_company_scope uuid[];
begin
  if not v_owner and not v_distributor then
    raise exception 'Sem permissão para consultar o Centro de Licenças' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct k.redeemed_by_company) filter (where k.redeemed_by_company is not null),'{}'::uuid[])
    into v_company_scope
  from public.ks_license_keys k
  where v_owner or k.issued_by = v_user;

  return jsonb_build_object(
    'counts',jsonb_build_object(
      'companies',case when v_owner then (select count(*) from public.ks_companies) else cardinality(v_company_scope) end,
      'installations',case when v_owner then (select count(*) from public.ks_installations)
        else (select count(*) from public.ks_installations i where i.company_id = any(v_company_scope)) end,
      'active_installations',case when v_owner then (select count(*) from public.ks_installations where install_status='active')
        else (select count(*) from public.ks_installations i where i.company_id = any(v_company_scope) and i.install_status='active') end,
      'active_licenses',case when v_owner then (select count(*) from public.ks_company_licenses where status in ('active','trial') and (expires_at is null or expires_at>now()))
        else (select count(*) from public.ks_company_licenses l where l.company_id=any(v_company_scope) and l.status in ('active','trial') and (l.expires_at is null or l.expires_at>now())) end,
      'issued_keys',case when v_owner then (select count(*) from public.ks_license_keys where status='issued')
        else (select count(*) from public.ks_license_keys where status='issued' and issued_by=v_user) end,
      'redeemed_keys',case when v_owner then (select count(*) from public.ks_license_keys where status='redeemed')
        else (select count(*) from public.ks_license_keys where status='redeemed' and issued_by=v_user) end
    ),
    'keys',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
      select jsonb_build_object('id',k.id,'prefix',k.key_prefix,'plan_code',k.plan_code,'term_code',k.term_code,
        'status',k.status,'created_at',k.created_at,'expires_at',k.expires_at,'redeemed_at',k.redeemed_at,
        'company_name',c.legal_name,'company_id',k.redeemed_by_company) as x
      from public.ks_license_keys k
      left join public.ks_companies c on c.id=k.redeemed_by_company
      where v_owner or k.issued_by=v_user
      order by k.created_at desc limit 100
    ) s),
    'installations',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
      select jsonb_build_object('id',i.id,'company_name',c.legal_name,'device_name',i.device_name,
        'platform',i.platform,'app_version',i.app_version,'status',i.install_status,
        'last_seen_at',i.last_seen_at) as x
      from public.ks_installations i
      join public.ks_companies c on c.id=i.company_id
      where v_owner or i.company_id=any(v_company_scope)
      order by i.last_seen_at desc nulls last limit 100
    ) s),
    'companies',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
      select jsonb_build_object('id',c.id,'legal_name',c.legal_name,'tax_id',c.tax_id,
        'status',c.status,'license_status',l.status,'plan_code',l.plan_code,
        'expires_at',l.expires_at) as x
      from public.ks_companies c
      left join lateral (select cl.status,cl.plan_code,cl.expires_at
        from public.ks_company_licenses cl where cl.company_id=c.id
        order by cl.created_at desc limit 1) l on true
      where v_owner or c.id=any(v_company_scope)
      order by c.created_at desc limit 200
    ) s),
    'distributors',case when v_owner then
      (select coalesce(jsonb_agg(jsonb_build_object('user_id',d.user_id,'email',u.email,
        'status',d.status,'allowed_plan_codes',d.allowed_plan_codes,'created_at',d.created_at)
        order by d.created_at desc),'[]'::jsonb)
       from public.ks_license_distributors d join auth.users u on u.id=d.user_id)
      else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.ks_license_console_overview() from public, anon;
grant execute on function public.ks_license_console_overview() to authenticated;

create or replace function public.ks_license_console_manage_distributor(
  p_email text,
  p_enabled boolean,
  p_allowed_plan_codes text[] default array['trial','mini','standard','premium','enterprise']::text[]
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_target uuid;
  v_codes text[] := coalesce(p_allowed_plan_codes,'{}'::text[]);
begin
  if not private.ks_is_platform_admin() then
    raise exception 'Apenas o proprietário pode gerir distribuidores' using errcode = '42501';
  end if;
  if nullif(btrim(p_email),'') is null then raise exception 'Informe o email do distribuidor'; end if;
  select id into v_target from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if v_target is null then raise exception 'Não existe uma conta registada com esse email. O distribuidor deve criar/confirmar a conta primeiro.'; end if;
  if cardinality(v_codes)>0 and exists (
    select 1 from unnest(v_codes) code
    where not exists(select 1 from public.ks_saas_plans p where p.plan_code=code and p.is_active and p.plan_code<>'internal_lifetime')
  ) then raise exception 'A lista contém um plano inválido ou interno'; end if;

  insert into public.ks_license_distributors(user_id,allowed_plan_codes,status,created_by,updated_at)
  values(v_target,v_codes,case when p_enabled then 'active' else 'disabled' end,(select auth.uid()),now())
  on conflict(user_id) do update set
    allowed_plan_codes=excluded.allowed_plan_codes,status=excluded.status,updated_at=now();

  insert into public.ks_license_management_audit(actor_user_id,target_user_id,action,metadata)
  values((select auth.uid()),v_target,case when p_enabled then 'distributor_enabled' else 'distributor_disabled' end,
    jsonb_build_object('email',lower(btrim(p_email)),'allowed_plan_codes',v_codes));

  return jsonb_build_object('success',true,'user_id',v_target,'status',case when p_enabled then 'active' else 'disabled' end);
end;
$$;
revoke all on function public.ks_license_console_manage_distributor(text,boolean,text[]) from public, anon;
grant execute on function public.ks_license_console_manage_distributor(text,boolean,text[]) to authenticated;
