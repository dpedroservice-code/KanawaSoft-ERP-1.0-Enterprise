CREATE OR REPLACE FUNCTION private.ks_can_invite_team_role(p_company_id uuid,p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ks_company_memberships m
    WHERE m.company_id=p_company_id AND m.user_id=auth.uid() AND m.status='active'
      AND (
        m.role IN ('owner','admin') AND p_role IN ('manager','accountant','gerente','contabilista')
        OR m.role IN ('manager','gerente') AND p_role IN ('operator','operador')
        OR m.role IN ('operator','operador') AND p_role IN ('cashier','caixa')
      )
  );
$function$;
REVOKE ALL ON FUNCTION private.ks_can_invite_team_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_can_invite_team_role(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.ks_review_sale_cancellation_secure_impl(p_request_id uuid,p_approve boolean,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_req public.ks_sale_cancellation_requests%ROWTYPE; v_sale_id uuid; v_company uuid;
  v_session_id uuid; v_total numeric(18,2); v_cash_total numeric(18,2); v_count integer; v_expected numeric(18,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão necessária.' USING errcode='42501'; END IF;
  SELECT m.company_id INTO v_company FROM public.ks_company_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active' ORDER BY m.created_at LIMIT 1;
  IF v_company IS NULL OR NOT private.ks_has_company_role(v_company,ARRAY['owner','admin','operator','operador']) THEN
    RAISE EXCEPTION 'Apenas operador ou administrador pode decidir cancelamentos.' USING errcode='42501';
  END IF;
  SELECT * INTO v_req FROM public.ks_sale_cancellation_requests
    WHERE id=p_request_id AND company_id=v_company AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido inexistente ou já processado.' USING errcode='P0002'; END IF;
  IF p_approve THEN
    UPDATE public.ks_sales SET status='cancelada',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=v_req.reason
      WHERE company_id=v_company AND external_id=v_req.sale_external_id
      RETURNING id,cash_session_id INTO v_sale_id,v_session_id;
    IF v_sale_id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada no registo fiscal.' USING errcode='P0002'; END IF;
    UPDATE public.ks_records SET payload=jsonb_set(payload,'{status}','"cancelada"'::jsonb,true),updated_at=now()
      WHERE company_id=v_company AND store_key='vendas' AND record_id=v_req.sale_external_id;
    IF v_session_id IS NOT NULL THEN
      SELECT coalesce(sum((r.payload->>'total')::numeric),0),count(*)::integer,
        coalesce(sum(CASE WHEN lower(coalesce(r.payload->>'pagamento','')) IN ('dinheiro','cash') THEN (r.payload->>'total')::numeric ELSE 0 END),0)
      INTO v_total,v_count,v_cash_total
      FROM public.ks_records r WHERE r.company_id=v_company AND r.store_key='vendas'
        AND r.payload->>'cashSessionId'=v_session_id::text AND r.payload->>'status' IN ('finalizada','finalizado');
      UPDATE public.ks_cash_sessions SET sales_total=v_total,cash_sales_total=v_cash_total,sales_count=v_count,
        expected_cash=opening_float+v_cash_total,
        difference=CASE WHEN counted_cash IS NULL THEN NULL ELSE counted_cash-(opening_float+v_cash_total) END
      WHERE id=v_session_id;
    END IF;
  END IF;
  UPDATE public.ks_sale_cancellation_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),'') WHERE id=p_request_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  VALUES(v_company,auth.uid(),CASE WHEN p_approve THEN 'sale_cancelled' ELSE 'sale_cancellation_rejected' END,
    'sale',v_req.sale_external_id,jsonb_build_object('invoice_number',v_req.invoice_number,'cashier_user_id',v_req.cashier_user_id,'reason',v_req.reason,'review_note',p_note));
  RETURN jsonb_build_object('request_id',p_request_id,'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$function$;
REVOKE ALL ON FUNCTION private.ks_review_sale_cancellation_secure_impl(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_review_sale_cancellation_secure_impl(uuid,boolean,text) TO authenticated;
