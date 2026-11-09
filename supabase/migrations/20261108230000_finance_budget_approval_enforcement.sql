CREATE OR REPLACE FUNCTION private.ks_decide_commercial_approval_secure_impl(
  p_approval_id uuid,p_approve boolean,p_approved_amount numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_req public.ks_commercial_approvals%ROWTYPE; v_company uuid; v_amount numeric(18,2);
BEGIN
  SELECT m.company_id INTO v_company FROM public.ks_company_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active' ORDER BY m.created_at LIMIT 1;
  IF v_company IS NULL OR NOT private.ks_has_company_role(v_company,ARRAY['owner','admin','accountant','contabilista']) THEN
    RAISE EXCEPTION 'Apenas o Financeiro/Contabilista ou administrador pode aprovar preços e limites.' USING errcode='42501';
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
    IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.ks_records WHERE company_id=v_company AND store_key='produtos' AND record_id=v_req.reference_id) THEN
      RAISE EXCEPTION 'Produto não encontrado.' USING errcode='P0002';
    END IF;
  ELSIF p_approve AND v_req.request_type='service_price' THEN
    IF v_req.reference_id IS NULL THEN RAISE EXCEPTION 'A autorização de serviço exige o ID do serviço.' USING errcode='22023'; END IF;
    UPDATE public.ks_records SET payload=jsonb_set(jsonb_set(payload,'{preco}',to_jsonb(v_amount),true),'{precoVenda}',to_jsonb(v_amount),true),updated_at=now()
      WHERE company_id=v_company AND store_key='servicos' AND record_id=v_req.reference_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado.' USING errcode='P0002'; END IF;
  ELSIF p_approve AND v_req.request_type='quotation' THEN
    IF v_req.reference_id IS NULL THEN RAISE EXCEPTION 'A aprovação de orçamento exige o ID do orçamento.' USING errcode='22023'; END IF;
    UPDATE public.ks_records SET payload=jsonb_set(
        jsonb_set(jsonb_set(payload,'{financeiroAprovado}','true'::jsonb,true),'{valorAprovado}',to_jsonb(v_amount),true),
        '{status}','"aprovado"'::jsonb,true),updated_at=now()
      WHERE company_id=v_company AND store_key='orcamentos' AND record_id=v_req.reference_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.' USING errcode='P0002'; END IF;
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
REVOKE ALL ON FUNCTION private.ks_decide_commercial_approval_secure_impl(uuid,boolean,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_decide_commercial_approval_secure_impl(uuid,boolean,numeric) TO authenticated;
