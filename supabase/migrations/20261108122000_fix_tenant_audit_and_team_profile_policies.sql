-- Correct tenant correlation in insert policies and allow supervisors to resolve staff display names.
DROP POLICY IF EXISTS ks_audit_events_insert ON public.ks_audit_events;
CREATE POLICY ks_audit_events_insert ON public.ks_audit_events
  FOR INSERT TO authenticated WITH CHECK (
    actor_user_id=auth.uid() AND EXISTS(
      SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=ks_audit_events.company_id AND m.user_id=auth.uid() AND m.status='active'
    ) AND octet_length(coalesce(details,'{}'::jsonb)::text)<=12000
  );

DROP POLICY IF EXISTS ks_commercial_approvals_insert ON public.ks_commercial_approvals;
CREATE POLICY ks_commercial_approvals_insert ON public.ks_commercial_approvals
  FOR INSERT TO authenticated WITH CHECK (
    requested_by=auth.uid() AND EXISTS(
      SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=ks_commercial_approvals.company_id AND m.user_id=auth.uid() AND m.status='active'
    )
  );

DROP POLICY IF EXISTS ks_profiles_select_supervisor_team ON public.ks_profiles;
CREATE POLICY ks_profiles_select_supervisor_team ON public.ks_profiles
  FOR SELECT TO authenticated USING (
    user_id=auth.uid()
    OR EXISTS(
      WITH RECURSIVE managed_users(user_id) AS (
        SELECT m.user_id FROM public.ks_company_memberships m
        WHERE m.supervisor_user_id=auth.uid() AND m.status='active'
        UNION
        SELECT child.user_id FROM public.ks_company_memberships child
        JOIN managed_users parent ON child.supervisor_user_id=parent.user_id
        WHERE child.status='active'
      )
      SELECT 1 FROM managed_users WHERE managed_users.user_id=ks_profiles.user_id
    )
  );
