-- KanawaSoft 1.0: cloud team membership and invitation lifecycle.
-- Applies only to project mhaynctedpyqjxdhdisv (kanawasoft-1-0-isolated).
-- Invitation codes are stored only as SHA-256 hashes; passwords remain in Supabase Auth.

alter table public.ks_company_memberships
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.ks_profiles
  add column if not exists email text;

update public.ks_profiles p
set email = u.email
from auth.users u
where u.id = p.user_id and p.email is distinct from u.email;

create table if not exists public.ks_team_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ks_companies(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('manager','operator','cashier')),
  permissions jsonb not null default '{}'::jsonb,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ks_team_invitations_email_normalized check (email = lower(trim(email)))
);

create index if not exists idx_ks_team_invitations_company_created
  on public.ks_team_invitations(company_id, created_at desc);
create index if not exists idx_ks_team_invitations_pending
  on public.ks_team_invitations(company_id, expires_at)
  where accepted_at is null;

alter table public.ks_team_invitations enable row level security;

drop policy if exists ks_team_invitations_admin_read on public.ks_team_invitations;
create policy ks_team_invitations_admin_read
on public.ks_team_invitations
for select to authenticated
using (private.ks_has_company_role(company_id, array['owner','admin']::text[]));

-- Prevent direct membership writes from granting owner/admin privileges.
drop policy if exists ks_memberships_admin_insert on public.ks_company_memberships;
create policy ks_memberships_admin_insert
on public.ks_company_memberships
for insert to authenticated
with check (
  private.ks_has_company_role(company_id, array['owner','admin']::text[])
  and role in ('manager','operator','cashier')
);

drop policy if exists ks_memberships_admin_update on public.ks_company_memberships;
create policy ks_memberships_admin_update
on public.ks_company_memberships
for update to authenticated
using (
  private.ks_has_company_role(company_id, array['owner','admin']::text[])
  and role not in ('owner','admin')
  and user_id <> (select auth.uid())
)
with check (
  private.ks_has_company_role(company_id, array['owner','admin']::text[])
  and role in ('manager','operator','cashier')
  and user_id <> (select auth.uid())
);

drop policy if exists ks_memberships_admin_delete on public.ks_company_memberships;
create policy ks_memberships_admin_delete
on public.ks_company_memberships
for delete to authenticated
using (
  private.ks_has_company_role(company_id, array['owner','admin']::text[])
  and role not in ('owner','admin')
  and user_id <> (select auth.uid())
);

grant select on public.ks_team_invitations to authenticated;
grant select on public.ks_profiles to authenticated;

drop policy if exists ks_profiles_company_admin_read on public.ks_profiles;
create policy ks_profiles_company_admin_read
on public.ks_profiles
for select to authenticated
using (
  exists (
    select 1
    from public.ks_company_memberships m
    where m.user_id = ks_profiles.user_id
      and m.status in ('active','invited')
      and private.ks_has_company_role(m.company_id, array['owner','admin']::text[])
  )
);

create or replace function public.ks_create_team_invitation(
  p_email text,
  p_full_name text,
  p_role text,
  p_permissions jsonb default '{}'::jsonb,
  p_expires_hours integer default 72
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_email text;
  v_code text;
  v_id uuid;
  v_expires timestamptz;
begin
  v_email := lower(trim(coalesce(p_email,'')));
  if auth.uid() is null then
    raise exception 'Sessão necessária.' using errcode='42501';
  end if;
  select m.company_id into v_company_id
  from public.ks_company_memberships m
  where m.user_id=auth.uid() and m.status='active'
    and m.role in ('owner','admin')
  order by m.created_at asc
  limit 1;
  if v_company_id is null then
    raise exception 'Apenas o proprietário ou administrador pode convidar membros.' using errcode='42501';
  end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Email inválido.' using errcode='22023';
  end if;
  if length(trim(coalesce(p_full_name,''))) < 2 then
    raise exception 'Informe o nome completo.' using errcode='22023';
  end if;
  if p_role not in ('manager','operator','cashier') then
    raise exception 'Perfil de convite não permitido.' using errcode='22023';
  end if;
  if coalesce(p_expires_hours,72) not between 1 and 168 then
    raise exception 'A validade do convite deve estar entre 1 e 168 horas.' using errcode='22023';
  end if;
  if exists(select 1 from auth.users u where lower(u.email)=v_email) then
    raise exception 'Este email já tem uma conta. O utilizador deve iniciar sessão e ser associado pela administração.' using errcode='23505';
  end if;
  if exists(select 1 from public.ks_team_invitations i where i.company_id=v_company_id and lower(i.email)=v_email and i.accepted_at is null and i.expires_at>now()) then
    raise exception 'Já existe um convite pendente para este email.' using errcode='23505';
  end if;

  v_code := encode(extensions.gen_random_bytes(24),'hex');
  v_expires := now() + make_interval(hours => coalesce(p_expires_hours,72));
  insert into public.ks_team_invitations(company_id,email,full_name,role,permissions,token_hash,expires_at,created_by)
  values(v_company_id,v_email,trim(p_full_name),p_role,coalesce(p_permissions,'{}'::jsonb),
    encode(extensions.digest(convert_to(v_code,'UTF8'),'sha256'),'hex'),v_expires,auth.uid())
  returning id into v_id;
  return jsonb_build_object('id',v_id,'email',v_email,'invitation_code',v_code,'expires_at',v_expires);
end;
$function$;

create or replace function public.ks_update_team_member_access(
  p_user_id uuid,
  p_role text,
  p_permissions jsonb default '{}'::jsonb,
  p_status text default 'active'
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.' using errcode='42501';
  end if;
  select m.company_id into v_company_id
  from public.ks_company_memberships m
  where m.user_id=auth.uid() and m.status='active'
    and m.role in ('owner','admin')
  order by m.created_at asc limit 1;
  if v_company_id is null then
    raise exception 'Apenas o proprietário ou administrador pode gerir acessos.' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=auth.uid() then
    raise exception 'Não pode alterar o próprio acesso por esta operação.' using errcode='42501';
  end if;
  if p_role not in ('manager','operator','cashier') or p_status not in ('active','suspended') then
    raise exception 'Perfil ou estado inválido.' using errcode='22023';
  end if;
  select role into v_target_role
  from public.ks_company_memberships
  where company_id=v_company_id and user_id=p_user_id
  for update;
  if not found then
    raise exception 'Membro não encontrado nesta empresa.' using errcode='P0002';
  end if;
  if v_target_role in ('owner','admin') then
    raise exception 'Acesso do proprietário e dos administradores protegidos.' using errcode='42501';
  end if;
  update public.ks_company_memberships
  set role=p_role, permissions=coalesce(p_permissions,'{}'::jsonb), status=p_status
  where company_id=v_company_id and user_id=p_user_id;
  return jsonb_build_object('user_id',p_user_id,'role',p_role,'status',p_status);
end;
$function$;

create or replace function public.ks_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_meta jsonb;
  v_code text;
  v_invite public.ks_team_invitations%rowtype;
begin
  v_meta := coalesce(new.raw_user_meta_data,'{}'::jsonb);

  if tg_op = 'UPDATE' then
    update public.ks_profiles
    set email=new.email, full_name=coalesce(nullif(v_meta->>'full_name',''),full_name), updated_at=now()
    where user_id=new.id;
    if old.email_confirmed_at is null and new.email_confirmed_at is not null then
      update public.ks_company_memberships
      set status='active'
      where user_id=new.id and status='invited';
    end if;
    return new;
  end if;

  insert into public.ks_profiles(user_id,full_name,phone,email)
  values(new.id,v_meta->>'full_name',nullif(v_meta->>'phone',''),new.email)
  on conflict(user_id) do update
    set full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,updated_at=now();

  v_code := nullif(v_meta->>'invitation_code','');
  if v_code is not null then
    select * into v_invite
    from public.ks_team_invitations i
    where i.token_hash=encode(extensions.digest(convert_to(v_code,'UTF8'),'sha256'),'hex')
      and lower(i.email)=lower(new.email)
      and i.accepted_at is null
      and i.expires_at>now()
    for update;
    if not found then
      raise exception 'Convite inválido, expirado ou associado a outro email.' using errcode='42501';
    end if;
    insert into public.ks_company_memberships(company_id,user_id,role,status,permissions)
    values(v_invite.company_id,new.id,v_invite.role,
      case when new.email_confirmed_at is not null then 'active' else 'invited' end,
      v_invite.permissions)
    on conflict(company_id,user_id) do update
      set role=excluded.role,status=excluded.status,permissions=excluded.permissions;
    update public.ks_team_invitations
    set accepted_by=new.id,accepted_at=now()
    where id=v_invite.id;
    return new;
  end if;

  insert into public.ks_companies(owner_user_id,legal_name,trade_name,tax_id,phone,email,country_code,currency_code,tax_regime)
  values(new.id,coalesce(nullif(v_meta->>'company_legal_name',''),'Empresa'),
    coalesce(nullif(v_meta->>'company_trade_name',''),'Empresa'),
    v_meta->>'company_tax_id',nullif(v_meta->>'phone',''),new.email,
    coalesce(v_meta->>'country_code','AO'),coalesce(v_meta->>'currency_code','AOA'),
    coalesce(v_meta->>'tax_regime','not_configured'))
  returning id into v_company_id;
  insert into public.ks_company_memberships(company_id,user_id,role,status)
  values(v_company_id,new.id,'owner','active');
  insert into public.ks_company_licenses(company_id,plan_code,status,starts_at,expires_at)
  values(v_company_id,'trial','trial',now(),now()+interval '14 days');
  return new;
end;
$function$;

alter function public.ks_handle_new_user() owner to postgres;
alter function public.ks_handle_new_user() set search_path to '';

drop trigger if exists ks_auth_user_onboard on auth.users;
create trigger ks_auth_user_onboard
after insert or update of email_confirmed_at on auth.users
for each row execute function public.ks_handle_new_user();

alter function public.ks_create_team_invitation(text,text,text,jsonb,integer) owner to postgres;
alter function public.ks_update_team_member_access(uuid,text,jsonb,text) owner to postgres;

revoke all on function public.ks_create_team_invitation(text,text,text,jsonb,integer) from public, anon;
revoke all on function public.ks_update_team_member_access(uuid,text,jsonb,text) from public, anon;
grant execute on function public.ks_create_team_invitation(text,text,text,jsonb,integer) to authenticated;
grant execute on function public.ks_update_team_member_access(uuid,text,jsonb,text) to authenticated;

comment on table public.ks_team_invitations is
  'Company-scoped invitations. Only SHA-256 hashes are stored; the one-time invitation code is returned to the creator.';
