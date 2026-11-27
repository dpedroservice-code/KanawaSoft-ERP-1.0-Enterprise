CREATE OR REPLACE FUNCTION public.ks_open_cash_session_for_company(
  p_company_id uuid,
  p_opening_float numeric,
  p_target_amount numeric DEFAULT 0,
  p_terminal_label text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE sql
SET search_path TO ''
AS $function$
  SELECT private.ks_open_cash_session_for_company_secure_impl($1,$2,$3,$4);
$function$;

REVOKE ALL ON FUNCTION public.ks_open_cash_session_for_company(uuid,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ks_open_cash_session_for_company(uuid,numeric,numeric,text) TO authenticated;

REVOKE ALL ON FUNCTION private.ks_open_cash_session_for_company_secure_impl(uuid,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ks_open_cash_session_for_company_secure_impl(uuid,numeric,numeric,text) TO authenticated;
