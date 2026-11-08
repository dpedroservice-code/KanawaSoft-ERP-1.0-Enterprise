-- Approval decisions must go through the audited RPC; do not allow direct row edits.
DROP POLICY IF EXISTS ks_commercial_approvals_update ON public.ks_commercial_approvals;

-- Team profile visibility must remain inside the supervisor's company.
DROP POLICY IF EXISTS ks_profiles_select_supervisor_team ON public.ks_profiles;
CREATE POLICY ks_profiles_select_supervisor_team ON public.ks_profiles
  FOR SELECT TO authenticated USING (
    user_id=auth.uid()
    OR EXISTS(
      WITH RECURSIVE managed_users(company_id,user_id) AS (
        SELECT m.company_id,m.user_id FROM public.ks_company_memberships m
        WHERE m.supervisor_user_id=auth.uid() AND m.status='active'
        UNION
        SELECT child.company_id,child.user_id FROM public.ks_company_memberships child
        JOIN managed_users parent ON child.company_id=parent.company_id AND child.supervisor_user_id=parent.user_id
        WHERE child.status='active'
      )
      SELECT 1 FROM managed_users WHERE managed_users.user_id=ks_profiles.user_id
    )
  );
