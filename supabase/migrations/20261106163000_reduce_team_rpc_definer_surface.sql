-- Minimize privileged RPC surface: invitation creation and member updates
-- can execute as the authenticated caller under explicit RLS policies.

drop policy if exists ks_team_invitations_admin_insert on public.ks_team_invitations;
create policy ks_team_invitations_admin_insert
on public.ks_team_invitations
for insert to authenticated
with check (
  private.ks_has_company_role(company_id, array['owner','admin']::text[])
  and role in ('manager','operator','cashier')
  and created_by = (select auth.uid())
  and accepted_at is null
  and accepted_by is null
  and expires_at > now()
  and expires_at <= now() + interval '7 days'
);

alter function public.ks_create_team_invitation(text,text,text,jsonb,integer) security invoker;
alter function public.ks_update_team_member_access(uuid,text,jsonb,text) security invoker;

comment on function public.ks_create_team_invitation(text,text,text,jsonb,integer) is
  'Creates a one-time company invitation as SECURITY INVOKER; insert is constrained by ks_team_invitations_admin_insert RLS.';
comment on function public.ks_update_team_member_access(uuid,text,jsonb,text) is
  'Updates non-privileged company members as SECURITY INVOKER; row changes are constrained by membership RLS.';
