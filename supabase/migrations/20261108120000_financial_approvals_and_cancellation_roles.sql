-- Commercial price and discount approvals are decided by Finance/Management, not by cashiers.
CREATE OR REPLACE FUNCTION public.ks_request_commercial_approval(
  p_request_type text,p_reference_id text,p_description text,p_requested_amount numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_company uuid; v_id uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.ks_company_memberships
    WHERE user_id=auth.uid() AND status='active' ORDER BY created_at LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'Membro activo necessário.' USING errcode='42501'; END IF;
  IF p_request_type NOT IN ('price_override','service_price','quotation','sales_limit','discount') THEN
    RAISE EXCEPTION 'Tipo de autorização inválido.' USING errcode='22023';
  END IF;
  IF length(trim(coalesce(p_description,'')))<4 OR coalesce(p_requested_amount,-1)<0 THEN
    RAISE EXCEPTION 'Descrição e valor válidos são obrigatórios.' USING errcode='22023';
  END IF;
  INSERT INTO public.ks_commercial_approvals(company_id,request_type,reference_id,description,requested_amount,requested_by)
  VALUES(v_company,p_request_type,nullif(trim(coalesce(p_reference_id,'')),''),trim(p_description),p_requested_amount,auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  VALUES(v_company,auth.uid(),'commercial_approval_requested',p_request_type,v_id::text,
    jsonb_build_object('description',p_description,'requested_amount',p_requested_amount,'reference_id',p_reference_id));
  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.ks_request_commercial_approval(text,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_request_commercial_approval(text,text,text,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.ks_decide_commercial_approval(
  p_approval_id uuid,p_approve boolean,p_approved_amount numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_req public.ks_commercial_approvals%ROWTYPE; v_company uuid; v_amount numeric(18,2);
BEGIN
  SELECT m.company_id INTO v_company FROM public.ks_company_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active' ORDER BY m.created_at LIMIT 1;
  IF v_company IS NULL OR NOT private.ks_has_company_role(v_company,ARRAY['owner','admin','manager','gerente','accountant','contabilista']) THEN
    RAISE EXCEPTION 'Apenas Financeiro, gerente ou administrador pode aprovar valores comerciais.' USING errcode='42501';
  END IF;
  SELECT * INTO v_req FROM public.ks_commercial_approvals
    WHERE id=p_approval_id AND company_id=v_company AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido inexistente ou já decidido.' USING errcode='P0002'; END IF;
  v_amount:=coalesce(p_approved_amount,v_req.requested_amount);
  IF p_approve AND (v_amount<0 OR v_amount>999999999999) THEN RAISE EXCEPTION 'Valor aprovado inválido.' USING errcode='22023'; END IF;
  IF p_approve AND v_req.request_type='price_override' THEN
    IF v_req.reference_id IS NULL THEN RAISE EXCEPTION 'A autorização de preço exige o ID do produto.' USING errcode='22023'; END IF;
    UPDATE public.ks_records SET payload=jsonb_set(jsonb_set(payload,'{precoVenda}',to_jsonb(v_amount),true),'{preco}',to_jsonb(v_amount),true),updated_at=now()
      WHERE company_id=v_company AND store_key='produtos' AND record_id=v_req.reference_id;
    UPDATE public.ks_products SET unit_price=v_amount,updated_at=now()
      WHERE company_id=v_company AND external_id=v_req.reference_id;
    IF NOT FOUND THEN
      IF NOT EXISTS(SELECT 1 FROM public.ks_records WHERE company_id=v_company AND store_key='produtos' AND record_id=v_req.reference_id) THEN
        RAISE EXCEPTION 'Produto não encontrado.' USING errcode='P0002';
      END IF;
    END IF;
  ELSIF p_approve AND v_req.request_type='service_price' THEN
    IF v_req.reference_id IS NULL THEN RAISE EXCEPTION 'A autorização de serviço exige o ID do serviço.' USING errcode='22023'; END IF;
    UPDATE public.ks_records SET payload=jsonb_set(jsonb_set(payload,'{preco}',to_jsonb(v_amount),true),'{precoVenda}',to_jsonb(v_amount),true),updated_at=now()
      WHERE company_id=v_company AND store_key='servicos' AND record_id=v_req.reference_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado.' USING errcode='P0002'; END IF;
  END IF;
  UPDATE public.ks_commercial_approvals SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    approved_amount=CASE WHEN p_approve THEN v_amount ELSE NULL END,decided_by=auth.uid(),decided_at=now()
    WHERE id=p_approval_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  VALUES(v_company,auth.uid(),CASE WHEN p_approve THEN 'commercial_approval_approved' ELSE 'commercial_approval_rejected' END,
    v_req.request_type,p_approval_id::text,jsonb_build_object('requested_amount',v_req.requested_amount,'approved_amount',v_amount,'reference_id',v_req.reference_id));
  RETURN jsonb_build_object('id',p_approval_id,'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,'approved_amount',v_amount);
END;
$function$;
REVOKE ALL ON FUNCTION public.ks_decide_commercial_approval(uuid,boolean,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_decide_commercial_approval(uuid,boolean,numeric) TO authenticated;

-- Only the operator (or administrator) may decide a cashier's cancellation request.
CREATE OR REPLACE FUNCTION public.ks_review_sale_cancellation(p_request_id uuid,p_approve boolean,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_req public.ks_sale_cancellation_requests%ROWTYPE; v_sale_id uuid; v_company uuid;
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
      WHERE company_id=v_company AND external_id=v_req.sale_external_id RETURNING id INTO v_sale_id;
    IF v_sale_id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada no registo fiscal.' USING errcode='P0002'; END IF;
    UPDATE public.ks_records SET payload=jsonb_set(payload,'{status}','"cancelada"'::jsonb,true),updated_at=now()
      WHERE company_id=v_company AND store_key='vendas' AND record_id=v_req.sale_external_id;
  END IF;
  UPDATE public.ks_sale_cancellation_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),'') WHERE id=p_request_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  VALUES(v_company,auth.uid(),CASE WHEN p_approve THEN 'sale_cancelled' ELSE 'sale_cancellation_rejected' END,
    'sale',v_req.sale_external_id,jsonb_build_object('invoice_number',v_req.invoice_number,'cashier_user_id',v_req.cashier_user_id,'reason',v_req.reason,'review_note',p_note));
  RETURN jsonb_build_object('request_id',p_request_id,'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$function$;
