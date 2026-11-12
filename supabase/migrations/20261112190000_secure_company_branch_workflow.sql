-- Secure parent-company / branch relationship workflow.
-- Business data remains isolated by company_id. This migration exposes relationship metadata
-- only and does not grant parent or branch users access to each other's operational records.

alter table public.ks_company_branches
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.ks_company_branches
  alter column status set default 'pending';

alter table public.ks_company_branches
  drop constraint if exists ks_company_branches_status_check;

alter table public.ks_company_branches
  add constraint ks_company_branches_status_check
  check (status in ('pending', 'active', 'inactive'));

-- A company may have many branches, but each branch may belong to only one parent.
-- The table was verified empty before preparing this unique index.
create unique index if not exists ks_company_branches_branch_company_unique_idx
  on public.ks_company_branches(branch_company_id);

create index if not exists ks_company_branches_parent_status_idx
  on public.ks_company_branches(parent_company_id, status);

create or replace function private.ks_link_company_branch_internal(
  p_parent_company_id uuid,
  p_branch_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão inválida.';
  end if;
  if p_parent_company_id is null or p_branch_company_id is null or p_parent_company_id = p_branch_company_id then
    raise exception 'Empresa principal e filial devem ser diferentes.';
  end if;
  if not private.ks_has_company_role(p_parent_company_id, array['owner','admin']) then
    raise exception 'Apenas o proprietário ou administrador da empresa principal pode solicitar uma filial.';
  end if;
  if not exists (select 1 from public.ks_companies c where c.id = p_parent_company_id and c.status = 'active') then
    raise exception 'Empresa principal não encontrada ou inactiva.';
  end if;
  if not exists (select 1 from public.ks_companies c where c.id = p_branch_company_id and c.status = 'active') then
    raise exception 'A empresa indicada como filial não existe ou está inactiva.';
  end if;
  if exists (
    select 1 from public.ks_company_branches b
    where b.branch_company_id = p_parent_company_id and b.status in ('pending','active')
  ) then
    raise exception 'Uma filial não pode ser simultaneamente empresa principal de outras filiais.';
  end if;
  if exists (
    select 1 from public.ks_company_branches b
    where b.parent_company_id = p_branch_company_id and b.status in ('pending','active')
  ) then
    raise exception 'A empresa indicada já possui filiais e não pode ser ligada como filial.';
  end if;
  if exists (
    select 1 from public.ks_company_branches b
    where b.branch_company_id = p_branch_company_id and b.status in ('pending','active')
  ) then
    raise exception 'Esta empresa já está ligada a uma empresa principal.';
  end if;

  insert into public.ks_company_branches(parent_company_id, branch_company_id, status, created_by, created_at)
  values (p_parent_company_id, p_branch_company_id, 'pending', (select auth.uid()), now())
  on conflict (branch_company_id) do update
    set parent_company_id = excluded.parent_company_id,
        status = 'pending',
        created_by = excluded.created_by,
        created_at = now()
    where public.ks_company_branches.status = 'inactive'
  returning id into v_id;

  if v_id is null then
    raise exception 'Não foi possível criar o pedido de associação da filial.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'branch_link_id', v_id,
    'parent_company_id', p_parent_company_id,
    'branch_company_id', p_branch_company_id,
    'status', 'pending'
  );
end;
$function$;

create or replace function private.ks_request_company_branch_by_tax_id_internal(
  p_parent_company_id uuid,
  p_branch_tax_id text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_branch_company_id uuid;
  v_tax_id text;
begin
  if not private.ks_has_company_role(p_parent_company_id, array['owner','admin']) then
    raise exception 'Apenas o proprietário ou administrador pode solicitar uma filial.';
  end if;
  v_tax_id := upper(regexp_replace(coalesce(p_branch_tax_id, ''), '[^A-Z0-9]', '', 'g'));
  if length(v_tax_id) < 6 or length(v_tax_id) > 24 then
    raise exception 'Introduza um NIF válido da empresa filial.';
  end if;
  select c.id into v_branch_company_id
  from public.ks_companies c
  where upper(regexp_replace(coalesce(c.tax_id, ''), '[^A-Z0-9]', '', 'g')) = v_tax_id
    and c.status = 'active'
  limit 1;
  if v_branch_company_id is null then
    raise exception 'Não foi encontrada uma empresa activa com esse NIF. A filial deve primeiro estar registada no KanawaSoft.';
  end if;
  return private.ks_link_company_branch_internal(p_parent_company_id, v_branch_company_id);
end;
$function$;

create or replace function private.ks_accept_company_branch_internal(
  p_parent_company_id uuid,
  p_branch_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  if not private.ks_has_company_role(p_branch_company_id, array['owner','admin']) then
    raise exception 'Apenas o proprietário ou administrador da empresa filial pode aceitar a associação.';
  end if;
  update public.ks_company_branches
    set status = 'active'
  where parent_company_id = p_parent_company_id
    and branch_company_id = p_branch_company_id
    and status = 'pending'
  returning id into v_id;
  if v_id is null then
    raise exception 'Pedido de associação pendente não encontrado.';
  end if;
  return jsonb_build_object(
    'ok', true,
    'branch_link_id', v_id,
    'parent_company_id', p_parent_company_id,
    'branch_company_id', p_branch_company_id,
    'status', 'active'
  );
end;
$function$;

create or replace function private.ks_unlink_company_branch_internal(
  p_parent_company_id uuid,
  p_branch_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  if not (
    private.ks_has_company_role(p_parent_company_id, array['owner','admin'])
    or private.ks_has_company_role(p_branch_company_id, array['owner','admin'])
  ) then
    raise exception 'Apenas administradores de uma das empresas ligadas podem terminar a associação.';
  end if;
  update public.ks_company_branches
    set status = 'inactive'
  where parent_company_id = p_parent_company_id
    and branch_company_id = p_branch_company_id
    and status in ('pending','active')
  returning id into v_id;
  if v_id is null then
    raise exception 'Associação de filial não encontrada ou já inactiva.';
  end if;
  return jsonb_build_object(
    'ok', true,
    'branch_link_id', v_id,
    'parent_company_id', p_parent_company_id,
    'branch_company_id', p_branch_company_id,
    'status', 'inactive'
  );
end;
$function$;

create or replace function public.ks_link_company_branch(
  p_parent_company_id uuid,
  p_branch_company_id uuid
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.ks_link_company_branch_internal(p_parent_company_id, p_branch_company_id);
$function$;

create or replace function public.ks_request_company_branch_by_tax_id(
  p_parent_company_id uuid,
  p_branch_tax_id text
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.ks_request_company_branch_by_tax_id_internal(p_parent_company_id, p_branch_tax_id);
$function$;

create or replace function public.ks_accept_company_branch(
  p_parent_company_id uuid,
  p_branch_company_id uuid
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.ks_accept_company_branch_internal(p_parent_company_id, p_branch_company_id);
$function$;

create or replace function public.ks_unlink_company_branch(
  p_parent_company_id uuid,
  p_branch_company_id uuid
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.ks_unlink_company_branch_internal(p_parent_company_id, p_branch_company_id);
$function$;

revoke all on function private.ks_link_company_branch_internal(uuid, uuid) from public, anon;
revoke all on function private.ks_request_company_branch_by_tax_id_internal(uuid, text) from public, anon;
revoke all on function private.ks_accept_company_branch_internal(uuid, uuid) from public, anon;
revoke all on function private.ks_unlink_company_branch_internal(uuid, uuid) from public, anon;
grant execute on function private.ks_link_company_branch_internal(uuid, uuid) to authenticated;
grant execute on function private.ks_request_company_branch_by_tax_id_internal(uuid, text) to authenticated;
grant execute on function private.ks_accept_company_branch_internal(uuid, uuid) to authenticated;
grant execute on function private.ks_unlink_company_branch_internal(uuid, uuid) to authenticated;

revoke all on function public.ks_link_company_branch(uuid, uuid) from public, anon;
revoke all on function public.ks_request_company_branch_by_tax_id(uuid, text) from public, anon;
revoke all on function public.ks_accept_company_branch(uuid, uuid) from public, anon;
revoke all on function public.ks_unlink_company_branch(uuid, uuid) from public, anon;
grant execute on function public.ks_link_company_branch(uuid, uuid) to authenticated;
grant execute on function public.ks_request_company_branch_by_tax_id(uuid, text) to authenticated;
grant execute on function public.ks_accept_company_branch(uuid, uuid) to authenticated;
grant execute on function public.ks_unlink_company_branch(uuid, uuid) to authenticated;

-- Pending links expose only the related company profile metadata to administrators of either side.
-- They do not grant access to stock, sales, accounting, customers or other operational tables.
drop policy if exists ks_companies_pending_branch_metadata on public.ks_companies;
create policy ks_companies_pending_branch_metadata
on public.ks_companies
for select
to authenticated
using (
  exists (
    select 1 from public.ks_company_branches b
    where b.status = 'pending'
      and (
        (b.parent_company_id = ks_companies.id and private.ks_has_company_role(b.branch_company_id, array['owner','admin']))
        or
        (b.branch_company_id = ks_companies.id and private.ks_has_company_role(b.parent_company_id, array['owner','admin']))
      )
  )
);
