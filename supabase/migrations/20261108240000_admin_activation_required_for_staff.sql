ALTER TABLE public.ks_company_memberships
  DROP CONSTRAINT IF EXISTS ks_company_memberships_status_check;
ALTER TABLE public.ks_company_memberships
  ADD CONSTRAINT ks_company_memberships_status_check
  CHECK(status IN ('active','invited','suspended','pending_approval'));

CREATE OR REPLACE FUNCTION private.ks_require_admin_activation_for_invited_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role NOT IN ('owner','admin') THEN
    UPDATE public.ks_company_memberships SET status='pending_approval'
      WHERE id=NEW.id AND status='active';
  END IF;
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS ks_require_admin_activation_for_invited_staff ON public.ks_company_memberships;
CREATE TRIGGER ks_require_admin_activation_for_invited_staff
  AFTER INSERT ON public.ks_company_memberships
  FOR EACH ROW WHEN (NEW.role NOT IN ('owner','admin'))
  EXECUTE FUNCTION private.ks_require_admin_activation_for_invited_staff();
REVOKE ALL ON FUNCTION private.ks_require_admin_activation_for_invited_staff() FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS ks_profiles_select_self_or_company_admin ON public.ks_profiles;
CREATE POLICY ks_profiles_select_self_or_company_admin ON public.ks_profiles
  FOR SELECT TO authenticated USING (
    user_id=(select auth.uid())
    OR (select private.ks_is_platform_admin())
    OR EXISTS(SELECT 1 FROM public.ks_company_memberships target
      JOIN public.ks_company_memberships mine ON mine.company_id=target.company_id
      WHERE target.user_id=ks_profiles.user_id AND target.status IN ('active','invited','pending_approval')
        AND mine.user_id=(select auth.uid()) AND mine.status='active' AND mine.role IN ('owner','admin'))
    OR EXISTS(
      WITH RECURSIVE managed_users(company_id,user_id) AS (
        SELECT m.company_id,m.user_id FROM public.ks_company_memberships m
        WHERE m.supervisor_user_id=(select auth.uid()) AND m.status IN ('active','pending_approval')
        UNION
        SELECT child.company_id,child.user_id FROM public.ks_company_memberships child
        JOIN managed_users parent ON child.company_id=parent.company_id AND child.supervisor_user_id=parent.user_id
        WHERE child.status IN ('active','pending_approval')
      )
      SELECT 1 FROM managed_users WHERE managed_users.user_id=ks_profiles.user_id
    )
  );
