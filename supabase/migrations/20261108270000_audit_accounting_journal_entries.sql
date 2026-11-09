-- Record accounting journal changes in the existing tenant-scoped audit stream.
CREATE OR REPLACE FUNCTION private.ks_audit_journal_entry_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_user_id uuid;
  v_action text;
BEGIN
  v_actor_user_id := coalesce(NEW.created_by_user_id, auth.uid());
  v_action := CASE WHEN TG_OP='INSERT'
    THEN 'journal_entry_created'
    ELSE 'journal_entry_updated'
  END;

  INSERT INTO public.ks_audit_events(
    company_id,actor_user_id,action,resource_type,resource_id,details
  ) VALUES (
    NEW.company_id,
    v_actor_user_id,
    v_action,
    'contabilidade',
    NEW.id::text,
    jsonb_build_object(
      'entry_number',NEW.entry_number,
      'entry_date',NEW.entry_date,
      'status',NEW.status,
      'description',left(coalesce(NEW.description,''),300),
      'operation',TG_OP
    )
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.ks_audit_journal_entry_event() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS ks_audit_journal_entry_event ON public.ks_journal_entries;
CREATE TRIGGER ks_audit_journal_entry_event
AFTER INSERT OR UPDATE ON public.ks_journal_entries
FOR EACH ROW
EXECUTE FUNCTION private.ks_audit_journal_entry_event();
