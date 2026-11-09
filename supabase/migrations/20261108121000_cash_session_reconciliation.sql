ALTER TABLE public.ks_cash_sessions
  ADD COLUMN IF NOT EXISTS cash_sales_total numeric(18,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.ks_close_cash_session(p_session_id uuid,p_counted_cash numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_session public.ks_cash_sessions%ROWTYPE; v_total numeric(18,2); v_cash_total numeric(18,2); v_count integer; v_expected numeric(18,2);
BEGIN
  SELECT * INTO v_session FROM public.ks_cash_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão de caixa não encontrada.' USING errcode='P0002'; END IF;
  IF auth.uid()<>v_session.cashier_user_id AND NOT private.ks_has_company_role(v_session.company_id,ARRAY['owner','admin','manager','gerente','operator','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para fechar esta caixa.' USING errcode='42501';
  END IF;
  IF v_session.status<>'open' THEN RAISE EXCEPTION 'Esta caixa já foi fechada.' USING errcode='22023'; END IF;
  IF coalesce(p_counted_cash,0)<0 THEN RAISE EXCEPTION 'O dinheiro contado não pode ser negativo.' USING errcode='22023'; END IF;
  SELECT coalesce(sum((r.payload->>'total')::numeric),0),count(*)::integer,
    coalesce(sum(CASE WHEN lower(coalesce(r.payload->>'pagamento','')) IN ('dinheiro','cash') THEN (r.payload->>'total')::numeric ELSE 0 END),0)
  INTO v_total,v_count,v_cash_total
  FROM public.ks_records r WHERE r.company_id=v_session.company_id AND r.store_key='vendas'
    AND r.payload->>'cashSessionId'=v_session.id::text AND r.payload->>'status' IN ('finalizada','finalizado');
  v_expected:=v_session.opening_float+v_cash_total;
  UPDATE public.ks_cash_sessions SET sales_total=v_total,cash_sales_total=v_cash_total,sales_count=v_count,expected_cash=v_expected,
    counted_cash=p_counted_cash,difference=p_counted_cash-v_expected,status='closed',closed_at=now()
  WHERE id=p_session_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  VALUES(v_session.company_id,auth.uid(),'cash_closed','cash_session',v_session.id::text,
    jsonb_build_object('sales_total',v_total,'cash_sales_total',v_cash_total,'sales_count',v_count,'expected_cash',v_expected,'counted_cash',p_counted_cash,'difference',p_counted_cash-v_expected));
  RETURN jsonb_build_object('session_id',p_session_id,'sales_total',v_total,'cash_sales_total',v_cash_total,'sales_count',v_count,'expected_cash',v_expected,'counted_cash',p_counted_cash,'difference',p_counted_cash-v_expected,'target_amount',v_session.target_amount);
END;
$function$;
REVOKE ALL ON FUNCTION public.ks_close_cash_session(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_close_cash_session(uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.ks_attach_sale_context(p_company_id uuid,p_external_id text,p_cash_session_id uuid,p_customer_address text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_cash_session public.ks_cash_sessions%ROWTYPE; v_total numeric(18,2); v_count integer; v_cash_total numeric(18,2);
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.company_id=p_company_id AND m.user_id=auth.uid() AND m.status='active' AND m.role IN ('cashier','caixa','operator','operador','manager','gerente','owner','admin')) THEN
    RAISE EXCEPTION 'Membro activo não autorizado.' USING errcode='42501';
  END IF;
  IF p_cash_session_id IS NOT NULL THEN
    SELECT * INTO v_cash_session FROM public.ks_cash_sessions WHERE id=p_cash_session_id AND company_id=p_company_id FOR UPDATE;
    IF NOT FOUND OR (v_cash_session.cashier_user_id<>auth.uid() AND NOT private.ks_has_company_role(p_company_id,ARRAY['owner','admin','manager','gerente','operator','operador'])) THEN
      RAISE EXCEPTION 'Caixa não pertence ao utilizador autenticado.' USING errcode='42501';
    END IF;
    IF v_cash_session.status<>'open' THEN RAISE EXCEPTION 'A caixa já está fechada.' USING errcode='22023'; END IF;
  END IF;
  UPDATE public.ks_sales SET cashier_user_id=auth.uid(),cash_session_id=p_cash_session_id,
    customer_address=nullif(trim(coalesce(p_customer_address,'')),'')
    WHERE company_id=p_company_id AND external_id=p_external_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada.' USING errcode='P0002'; END IF;
  IF p_cash_session_id IS NOT NULL THEN
    SELECT coalesce(sum((r.payload->>'total')::numeric),0),count(*)::integer,
      coalesce(sum(CASE WHEN lower(coalesce(r.payload->>'pagamento','')) IN ('dinheiro','cash') THEN (r.payload->>'total')::numeric ELSE 0 END),0)
    INTO v_total,v_count,v_cash_total
    FROM public.ks_records r WHERE r.company_id=p_company_id AND r.store_key='vendas'
      AND r.payload->>'cashSessionId'=p_cash_session_id::text AND r.payload->>'status' IN ('finalizada','finalizado');
    UPDATE public.ks_cash_sessions SET sales_total=v_total,cash_sales_total=v_cash_total,sales_count=v_count
      WHERE id=p_cash_session_id AND status='open';
  END IF;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.ks_attach_sale_context(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_attach_sale_context(uuid,text,uuid,text) TO authenticated;
