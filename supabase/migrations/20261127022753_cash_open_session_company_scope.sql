CREATE OR REPLACE FUNCTION private.ks_open_cash_session_secure_impl(
  p_opening_float numeric,
  p_target_amount numeric DEFAULT 0,
  p_terminal_label text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_company uuid;
  v_name text;
  v_id uuid;
  v_membership_count integer;
BEGIN
  SELECT count(*)::integer
  INTO v_membership_count
  FROM public.ks_company_memberships m
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.role IN ('cashier','caixa','operator','operador');

  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'A abertura de caixa está reservada aos perfis Caixa e Operador.' USING errcode = '42501';
  END IF;

  IF v_membership_count > 1 THEN
    RAISE EXCEPTION 'Este utilizador pertence a mais de uma empresa. Actualize o Kanawa Soft para abrir a caixa na empresa seleccionada.' USING errcode = '22023';
  END IF;

  SELECT m.company_id, coalesce(p.full_name, 'Caixa')
  INTO v_company, v_name
  FROM public.ks_company_memberships m
  LEFT JOIN public.ks_profiles p ON p.user_id = m.user_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.role IN ('cashier','caixa','operator','operador')
  ORDER BY m.created_at
  LIMIT 1;

  IF coalesce(p_opening_float,0) < 0 OR coalesce(p_target_amount,0) < 0 THEN
    RAISE EXCEPTION 'Os valores não podem ser negativos.' USING errcode = '22023';
  END IF;

  INSERT INTO public.ks_cash_sessions(
    company_id, cashier_user_id, cashier_name, opening_float, target_amount, terminal_label
  )
  VALUES(
    v_company, auth.uid(), v_name, coalesce(p_opening_float,0),
    coalesce(p_target_amount,0), nullif(trim(coalesce(p_terminal_label,'')),'')
  )
  RETURNING id INTO v_id;

  INSERT INTO public.ks_audit_events(
    company_id, actor_user_id, action, resource_type, resource_id, details
  )
  VALUES(
    v_company, auth.uid(), 'cash_opened', 'cash_session', v_id::text,
    jsonb_build_object('opening_float',p_opening_float,'target_amount',p_target_amount)
  );

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.ks_open_cash_session_for_company_secure_impl(
  p_company_id uuid,
  p_opening_float numeric,
  p_target_amount numeric DEFAULT 0,
  p_terminal_label text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_name text;
  v_id uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'A empresa seleccionada não foi identificada.' USING errcode = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ks_company_memberships m
    WHERE m.company_id = p_company_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('cashier','caixa','operator','operador')
  ) THEN
    RAISE EXCEPTION 'O seu perfil não tem permissão para abrir caixa nesta empresa.' USING errcode = '42501';
  END IF;

  IF p_opening_float IS NULL OR p_target_amount IS NULL
     OR p_opening_float < 0 OR p_target_amount < 0 THEN
    RAISE EXCEPTION 'Informe valores válidos, sem números negativos.' USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ks_cash_sessions s
    WHERE s.company_id = p_company_id
      AND s.cashier_user_id = auth.uid()
      AND s.status = 'open'
  ) THEN
    RAISE EXCEPTION 'Já existe uma caixa aberta para este utilizador nesta empresa.' USING errcode = '23505';
  END IF;

  SELECT coalesce(p.full_name, 'Caixa')
  INTO v_name
  FROM public.ks_profiles p
  WHERE p.user_id = auth.uid();

  INSERT INTO public.ks_cash_sessions(
    company_id, cashier_user_id, cashier_name, opening_float, target_amount, terminal_label
  )
  VALUES(
    p_company_id, auth.uid(), coalesce(v_name,'Caixa'),
    p_opening_float, p_target_amount, nullif(trim(coalesce(p_terminal_label,'')),'')
  )
  RETURNING id INTO v_id;

  INSERT INTO public.ks_audit_events(
    company_id, actor_user_id, action, resource_type, resource_id, details
  )
  VALUES(
    p_company_id, auth.uid(), 'cash_opened', 'cash_session', v_id::text,
    jsonb_build_object(
      'opening_float', p_opening_float,
      'target_amount', p_target_amount,
      'terminal_label', nullif(trim(coalesce(p_terminal_label,'')),'')
    )
  );

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ks_open_cash_session_for_company(
  p_company_id uuid,
  p_opening_float numeric,
  p_target_amount numeric DEFAULT 0,
  p_terminal_label text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.ks_open_cash_session_for_company_secure_impl($1,$2,$3,$4);
$function$;

REVOKE ALL ON FUNCTION public.ks_open_cash_session_for_company(uuid,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ks_open_cash_session_for_company(uuid,numeric,numeric,text) TO authenticated;
