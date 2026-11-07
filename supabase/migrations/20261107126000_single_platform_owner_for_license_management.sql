-- Only one explicitly registered platform owner may view payment requests and issue license keys.
-- The owner UUID is intentionally not seeded here; bind the verified owner account through
-- a trusted service-role/admin operation after confirming the account identity.
create table if not exists private.ks_platform_owner (
  singleton boolean primary key default true check (singleton is true),
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
revoke all on table private.ks_platform_owner from public, anon, authenticated;

create or replace function private.ks_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from private.ks_platform_owner o
    where o.singleton = true and o.user_id = (select auth.uid())
  );
$$;
revoke all on function private.ks_is_platform_admin() from public, anon;
grant execute on function private.ks_is_platform_admin() to authenticated, service_role;

create or replace function public.ks_is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.ks_is_platform_admin();
$$;
revoke all on function public.ks_is_platform_admin() from public, anon;
grant execute on function public.ks_is_platform_admin() to authenticated;
