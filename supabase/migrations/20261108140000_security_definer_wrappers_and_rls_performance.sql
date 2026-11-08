-- Keep REST RPC names stable while moving privileged implementations into the private schema.
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER FUNCTION public.ks_attach_sale_context(uuid,text,uuid,text) SET SCHEMA private;
ALTER FUNCTION private.ks_attach_sale_context(uuid,text,uuid,text) RENAME TO ks_attach_sale_context_secure_impl;
REVOKE ALL ON FUNCTION private.ks_attach_sale_context_secure_impl(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_attach_sale_context_secure_impl(uuid,text,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_attach_sale_context(p_company_id uuid,p_external_id text,p_cash_session_id uuid,p_customer_address text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_attach_sale_context_secure_impl($1,$2,$3,$4); $$;
REVOKE ALL ON FUNCTION public.ks_attach_sale_context(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_attach_sale_context(uuid,text,uuid,text) TO authenticated;

ALTER FUNCTION public.ks_close_cash_session(uuid,numeric) SET SCHEMA private;
ALTER FUNCTION private.ks_close_cash_session(uuid,numeric) RENAME TO ks_close_cash_session_secure_impl;
REVOKE ALL ON FUNCTION private.ks_close_cash_session_secure_impl(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_close_cash_session_secure_impl(uuid,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_close_cash_session(p_session_id uuid,p_counted_cash numeric)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_close_cash_session_secure_impl($1,$2); $$;
REVOKE ALL ON FUNCTION public.ks_close_cash_session(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_close_cash_session(uuid,numeric) TO authenticated;

ALTER FUNCTION public.ks_create_team_invitation(text,text,text,jsonb,integer) SET SCHEMA private;
ALTER FUNCTION private.ks_create_team_invitation(text,text,text,jsonb,integer) RENAME TO ks_create_team_invitation_secure_impl;
REVOKE ALL ON FUNCTION private.ks_create_team_invitation_secure_impl(text,text,text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_create_team_invitation_secure_impl(text,text,text,jsonb,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_create_team_invitation(p_email text,p_full_name text,p_role text,p_permissions jsonb DEFAULT '{}'::jsonb,p_expires_hours integer DEFAULT 72)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_create_team_invitation_secure_impl($1,$2,$3,$4,$5); $$;
REVOKE ALL ON FUNCTION public.ks_create_team_invitation(text,text,text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_create_team_invitation(text,text,text,jsonb,integer) TO authenticated;

ALTER FUNCTION public.ks_decide_commercial_approval(uuid,boolean,numeric) SET SCHEMA private;
ALTER FUNCTION private.ks_decide_commercial_approval(uuid,boolean,numeric) RENAME TO ks_decide_commercial_approval_secure_impl;
REVOKE ALL ON FUNCTION private.ks_decide_commercial_approval_secure_impl(uuid,boolean,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_decide_commercial_approval_secure_impl(uuid,boolean,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_decide_commercial_approval(p_approval_id uuid,p_approve boolean,p_approved_amount numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_decide_commercial_approval_secure_impl($1,$2,$3); $$;
REVOKE ALL ON FUNCTION public.ks_decide_commercial_approval(uuid,boolean,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_decide_commercial_approval(uuid,boolean,numeric) TO authenticated;

ALTER FUNCTION public.ks_open_cash_session(numeric,numeric,text) SET SCHEMA private;
ALTER FUNCTION private.ks_open_cash_session(numeric,numeric,text) RENAME TO ks_open_cash_session_secure_impl;
REVOKE ALL ON FUNCTION private.ks_open_cash_session_secure_impl(numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_open_cash_session_secure_impl(numeric,numeric,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_open_cash_session(p_opening_float numeric,p_target_amount numeric DEFAULT 0,p_terminal_label text DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_open_cash_session_secure_impl($1,$2,$3); $$;
REVOKE ALL ON FUNCTION public.ks_open_cash_session(numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_open_cash_session(numeric,numeric,text) TO authenticated;

ALTER FUNCTION public.ks_request_commercial_approval(text,text,text,numeric) SET SCHEMA private;
ALTER FUNCTION private.ks_request_commercial_approval(text,text,text,numeric) RENAME TO ks_request_commercial_approval_secure_impl;
REVOKE ALL ON FUNCTION private.ks_request_commercial_approval_secure_impl(text,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_request_commercial_approval_secure_impl(text,text,text,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_request_commercial_approval(p_request_type text,p_reference_id text,p_description text,p_requested_amount numeric)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_request_commercial_approval_secure_impl($1,$2,$3,$4); $$;
REVOKE ALL ON FUNCTION public.ks_request_commercial_approval(text,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_request_commercial_approval(text,text,text,numeric) TO authenticated;

ALTER FUNCTION public.ks_request_sale_cancellation(text,text) SET SCHEMA private;
ALTER FUNCTION private.ks_request_sale_cancellation(text,text) RENAME TO ks_request_sale_cancellation_secure_impl;
REVOKE ALL ON FUNCTION private.ks_request_sale_cancellation_secure_impl(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_request_sale_cancellation_secure_impl(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_request_sale_cancellation(p_sale_external_id text,p_reason text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_request_sale_cancellation_secure_impl($1,$2); $$;
REVOKE ALL ON FUNCTION public.ks_request_sale_cancellation(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_request_sale_cancellation(text,text) TO authenticated;

ALTER FUNCTION public.ks_review_sale_cancellation(uuid,boolean,text) SET SCHEMA private;
ALTER FUNCTION private.ks_review_sale_cancellation(uuid,boolean,text) RENAME TO ks_review_sale_cancellation_secure_impl;
REVOKE ALL ON FUNCTION private.ks_review_sale_cancellation_secure_impl(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_review_sale_cancellation_secure_impl(uuid,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.ks_review_sale_cancellation(p_request_id uuid,p_approve boolean,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $$ SELECT private.ks_review_sale_cancellation_secure_impl($1,$2,$3); $$;
REVOKE ALL ON FUNCTION public.ks_review_sale_cancellation(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_review_sale_cancellation(uuid,boolean,text) TO authenticated;

-- Index all foreign keys added for the staff, audit, cash and approvals workflows.
CREATE INDEX IF NOT EXISTS ks_cash_sessions_cashier_user_idx ON public.ks_cash_sessions(cashier_user_id);
CREATE INDEX IF NOT EXISTS ks_cash_sessions_supervisor_user_idx ON public.ks_cash_sessions(supervisor_user_id);
CREATE INDEX IF NOT EXISTS ks_commercial_approvals_company_idx ON public.ks_commercial_approvals(company_id);
CREATE INDEX IF NOT EXISTS ks_commercial_approvals_requested_by_idx ON public.ks_commercial_approvals(requested_by);
CREATE INDEX IF NOT EXISTS ks_commercial_approvals_decided_by_idx ON public.ks_commercial_approvals(decided_by);
CREATE INDEX IF NOT EXISTS ks_commercial_policies_updated_by_idx ON public.ks_commercial_policies(updated_by);
CREATE INDEX IF NOT EXISTS ks_company_memberships_supervisor_user_idx ON public.ks_company_memberships(supervisor_user_id);
CREATE INDEX IF NOT EXISTS ks_sale_cancel_cashier_user_idx ON public.ks_sale_cancellation_requests(cashier_user_id);
CREATE INDEX IF NOT EXISTS ks_sale_cancel_reviewed_by_idx ON public.ks_sale_cancellation_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS ks_sales_cashier_user_idx ON public.ks_sales(cashier_user_id);
CREATE INDEX IF NOT EXISTS ks_sales_cash_session_idx ON public.ks_sales(cash_session_id);
CREATE INDEX IF NOT EXISTS ks_sales_cancelled_by_idx ON public.ks_sales(cancelled_by);
CREATE INDEX IF NOT EXISTS ks_team_invitations_supervisor_user_idx ON public.ks_team_invitations(supervisor_user_id);

-- Consolidate overlapping SELECT policies and cache auth.uid() once per statement.
DROP POLICY IF EXISTS membership_read_company_admin ON public.ks_company_memberships;
DROP POLICY IF EXISTS membership_read_team_supervisor ON public.ks_company_memberships;
CREATE POLICY membership_read_company_admin ON public.ks_company_memberships
  FOR SELECT TO authenticated USING (
    user_id=(select auth.uid())
    OR private.ks_is_platform_admin()
    OR EXISTS(SELECT 1 FROM public.ks_company_memberships mine
      WHERE mine.company_id=ks_company_memberships.company_id AND mine.user_id=(select auth.uid())
        AND mine.status='active' AND mine.role IN ('owner','admin'))
    OR supervisor_user_id=(select auth.uid())
  );

DROP POLICY IF EXISTS ks_profiles_select_self_or_company_admin ON public.ks_profiles;
DROP POLICY IF EXISTS ks_profiles_select_supervisor_team ON public.ks_profiles;
CREATE POLICY ks_profiles_select_self_or_company_admin ON public.ks_profiles
  FOR SELECT TO authenticated USING (
    user_id=(select auth.uid())
    OR private.ks_is_platform_admin()
    OR EXISTS(SELECT 1 FROM public.ks_company_memberships target
      JOIN public.ks_company_memberships mine ON mine.company_id=target.company_id
      WHERE target.user_id=ks_profiles.user_id AND target.status IN ('active','invited')
        AND mine.user_id=(select auth.uid()) AND mine.status='active' AND mine.role IN ('owner','admin'))
    OR EXISTS(
      WITH RECURSIVE managed_users(company_id,user_id) AS (
        SELECT m.company_id,m.user_id FROM public.ks_company_memberships m
        WHERE m.supervisor_user_id=(select auth.uid()) AND m.status='active'
        UNION
        SELECT child.company_id,child.user_id FROM public.ks_company_memberships child
        JOIN managed_users parent ON child.company_id=parent.company_id AND child.supervisor_user_id=parent.user_id
        WHERE child.status='active'
      )
      SELECT 1 FROM managed_users WHERE managed_users.user_id=ks_profiles.user_id
    )
  );

DROP POLICY IF EXISTS ks_team_invitations_hierarchy_insert ON public.ks_team_invitations;
CREATE POLICY ks_team_invitations_hierarchy_insert ON public.ks_team_invitations
  FOR INSERT TO authenticated WITH CHECK (
    created_by=(select auth.uid()) AND supervisor_user_id=(select auth.uid())
    AND accepted_at IS NULL AND expires_at>now()
    AND (select private.ks_can_invite_team_role(company_id,role))
  );

DROP POLICY IF EXISTS ks_team_invitations_hierarchy_read ON public.ks_team_invitations;
CREATE POLICY ks_team_invitations_hierarchy_read ON public.ks_team_invitations
  FOR SELECT TO authenticated USING (
    created_by=(select auth.uid())
    OR EXISTS(SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=ks_team_invitations.company_id AND m.user_id=(select auth.uid())
        AND m.status='active' AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS ks_audit_events_insert ON public.ks_audit_events;
CREATE POLICY ks_audit_events_insert ON public.ks_audit_events
  FOR INSERT TO authenticated WITH CHECK (
    actor_user_id=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=ks_audit_events.company_id AND m.user_id=(select auth.uid()) AND m.status='active'
    ) AND octet_length(coalesce(details,'{}'::jsonb)::text)<=12000
  );

DROP POLICY IF EXISTS ks_audit_events_read ON public.ks_audit_events;
CREATE POLICY ks_audit_events_read ON public.ks_audit_events
  FOR SELECT TO authenticated USING (
    actor_user_id=(select auth.uid())
    OR EXISTS(SELECT 1 FROM public.ks_company_memberships admin_member
      WHERE admin_member.company_id=ks_audit_events.company_id AND admin_member.user_id=(select auth.uid())
        AND admin_member.status='active' AND admin_member.role IN ('owner','admin'))
    OR EXISTS(
      SELECT 1 FROM public.ks_company_memberships manager
      JOIN public.ks_company_memberships target ON target.company_id=manager.company_id
      WHERE manager.company_id=ks_audit_events.company_id AND manager.user_id=(select auth.uid())
        AND manager.status='active' AND manager.role IN ('manager','gerente')
        AND target.user_id=ks_audit_events.actor_user_id
        AND (target.supervisor_user_id=(select auth.uid()) OR target.supervisor_user_id IN (
          SELECT child.user_id FROM public.ks_company_memberships child
          WHERE child.company_id=ks_audit_events.company_id AND child.supervisor_user_id=(select auth.uid())
        ))
    )
  );

DROP POLICY IF EXISTS ks_cash_sessions_read ON public.ks_cash_sessions;
CREATE POLICY ks_cash_sessions_read ON public.ks_cash_sessions FOR SELECT TO authenticated USING (
  cashier_user_id=(select auth.uid())
  OR EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.company_id=ks_cash_sessions.company_id
    AND m.user_id=(select auth.uid()) AND m.status='active'
    AND m.role IN ('owner','admin','manager','gerente','operator','operador'))
);

DROP POLICY IF EXISTS ks_sale_cancel_read ON public.ks_sale_cancellation_requests;
CREATE POLICY ks_sale_cancel_read ON public.ks_sale_cancellation_requests FOR SELECT TO authenticated USING (
  cashier_user_id=(select auth.uid())
  OR EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.company_id=ks_sale_cancellation_requests.company_id
    AND m.user_id=(select auth.uid()) AND m.status='active'
    AND m.role IN ('owner','admin','manager','gerente','operator','operador'))
);

DROP POLICY IF EXISTS ks_commercial_approvals_insert ON public.ks_commercial_approvals;
CREATE POLICY ks_commercial_approvals_insert ON public.ks_commercial_approvals
  FOR INSERT TO authenticated WITH CHECK (
    requested_by=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=ks_commercial_approvals.company_id AND m.user_id=(select auth.uid()) AND m.status='active'
    )
  );

DROP POLICY IF EXISTS ks_commercial_approvals_read ON public.ks_commercial_approvals;
CREATE POLICY ks_commercial_approvals_read ON public.ks_commercial_approvals FOR SELECT TO authenticated USING (
  requested_by=(select auth.uid())
  OR EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.company_id=ks_commercial_approvals.company_id
    AND m.user_id=(select auth.uid()) AND m.status='active'
    AND m.role IN ('owner','admin','manager','gerente','accountant','contabilista'))
);

DROP POLICY IF EXISTS ks_commercial_policies_read ON public.ks_commercial_policies;
CREATE POLICY ks_commercial_policies_read ON public.ks_commercial_policies FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.company_id=ks_commercial_policies.company_id
    AND m.user_id=(select auth.uid()) AND m.status='active')
);
