CREATE OR REPLACE FUNCTION private.ks_touch_record_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ks_records_touch_updated_at ON public.ks_records;

CREATE TRIGGER ks_records_touch_updated_at
BEFORE UPDATE ON public.ks_records
FOR EACH ROW
EXECUTE FUNCTION private.ks_touch_record_updated_at();
