CREATE OR REPLACE FUNCTION private.ks_enforce_cashier_sale_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND private.ks_has_company_role(NEW.company_id,ARRAY['cashier','caixa']) THEN
    IF TG_OP='UPDATE' AND OLD.cashier_user_id IS NOT NULL AND OLD.cashier_user_id<>auth.uid() THEN
      RAISE EXCEPTION 'O Caixa só pode associar contexto à própria venda.' USING errcode='42501';
    END IF;
    NEW.cashier_user_id:=auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS ks_enforce_cashier_sale_identity ON public.ks_sales;
CREATE TRIGGER ks_enforce_cashier_sale_identity
  BEFORE INSERT OR UPDATE OF cashier_user_id ON public.ks_sales
  FOR EACH ROW EXECUTE FUNCTION private.ks_enforce_cashier_sale_identity();
REVOKE ALL ON FUNCTION private.ks_enforce_cashier_sale_identity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.ks_request_sale_cancellation_secure_impl(p_sale_external_id text,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_company uuid; v_name text; v_invoice text; v_id uuid;
BEGIN
  SELECT m.company_id,coalesce(p.full_name,'Caixa') INTO v_company,v_name
  FROM public.ks_company_memberships m LEFT JOIN public.ks_profiles p ON p.user_id=m.user_id
  WHERE m.user_id=auth.uid() AND m.status='active' AND m.role IN ('cashier','caixa')
  ORDER BY m.created_at LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'Apenas o caixa pode solicitar cancelamento.' USING errcode='42501'; END IF;
  IF length(trim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Explique o motivo do cancelamento (mínimo 5 caracteres).' USING errcode='22023'; END IF;
  SELECT payload->>'numeroFatura' INTO v_invoice FROM public.ks_records
    WHERE company_id=v_company AND store_key='vendas' AND record_id=p_sale_external_id
      AND payload->>'cashierUserId'=auth.uid()::text
      AND payload->>'status' IN ('finalizada','finalizado');
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Venda não encontrada na sua caixa ou já cancelada.' USING errcode='P0002'; END IF;
  INSERT INTO public.ks_sale_cancellation_requests(company_id,sale_external_id,invoice_number,cashier_user_id,cashier_name,reason)
  VALUES(v_company,p_sale_external_id,v_invoice,auth.uid(),v_name,trim(p_reason)) RETURNING id INTO v_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  VALUES(v_company,auth.uid(),'sale_cancellation_requested','sale',p_sale_external_id,jsonb_build_object('invoice_number',v_invoice,'reason',p_reason));
  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION private.ks_request_sale_cancellation_secure_impl(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_request_sale_cancellation_secure_impl(text,text) TO authenticated;
