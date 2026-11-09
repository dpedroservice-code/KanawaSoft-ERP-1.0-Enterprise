CREATE OR REPLACE FUNCTION private.ks_finalize_sale(p_company_id uuid,p_sale jsonb,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_sale_id uuid; v_item jsonb; v_product public.ks_products%rowtype; v_qty numeric;
  v_license public.ks_company_licenses%rowtype; v_plan public.ks_saas_plans%rowtype;
  v_limit integer; v_used integer; v_cash_session_id uuid;
  v_max_discount numeric(5,2):=5; v_max_sale numeric(18,2); v_discount_percent numeric(5,2);
  v_service_price numeric(18,2); v_service_approved boolean;
BEGIN
  IF NOT private.ks_has_company_role(p_company_id,ARRAY['owner','admin','cashier','caixa']) THEN
    RAISE EXCEPTION 'Apenas o Caixa ou Administrador pode finalizar vendas.' USING errcode='42501';
  END IF;
  IF private.ks_has_company_role(p_company_id,ARRAY['cashier','caixa']) THEN
    v_cash_session_id:=nullif(p_sale->>'cash_session_id','')::uuid;
    IF v_cash_session_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.ks_cash_sessions cs
      WHERE cs.id=v_cash_session_id AND cs.company_id=p_company_id AND cs.cashier_user_id=auth.uid() AND cs.status='open'
    ) THEN RAISE EXCEPTION 'Abra a sua caixa antes de finalizar uma venda.' USING errcode='42501'; END IF;
    SELECT coalesce(cp.max_discount_percent,5),cp.max_sale_amount INTO v_max_discount,v_max_sale
      FROM public.ks_commercial_policies cp WHERE cp.company_id=p_company_id;
    v_max_discount:=coalesce(v_max_discount,5);
    IF v_max_sale IS NOT NULL AND v_max_sale>0 AND coalesce((p_sale->>'total')::numeric,0)>v_max_sale THEN
      RAISE EXCEPTION 'O Financeiro definiu o limite máximo por venda em %.',v_max_sale USING errcode='22023';
    END IF;
    IF coalesce((p_sale->>'subtotal')::numeric,0)>0 THEN
      v_discount_percent:=coalesce((p_sale->>'discount_value')::numeric,0)/((p_sale->>'subtotal')::numeric)*100;
      IF v_discount_percent>v_max_discount+0.001 THEN
        RAISE EXCEPTION 'Desconto acima do limite aprovado pelo Financeiro (% por cento).',v_max_discount USING errcode='22023';
      END IF;
    END IF;
  END IF;
  INSERT INTO public.ks_sales(company_id,external_id,invoice_number,customer_name,customer_tax_id,customer_phone,
    subtotal,discount_value,tax_amount,total,amount_received,change_amount,payment_method,tax_regime,status,notes,
    operator_name,sold_at,cashier_user_id,cash_session_id,customer_address)
  VALUES(p_company_id,p_sale->>'external_id',coalesce(p_sale->>'invoice_number','FT'),p_sale->>'customer_name',
    p_sale->>'customer_tax_id',p_sale->>'customer_phone',coalesce((p_sale->>'subtotal')::numeric,0),
    coalesce((p_sale->>'discount_value')::numeric,0),coalesce((p_sale->>'tax_amount')::numeric,0),
    coalesce((p_sale->>'total')::numeric,0),coalesce((p_sale->>'amount_received')::numeric,0),
    coalesce((p_sale->>'change_amount')::numeric,0),p_sale->>'payment_method',p_sale->>'tax_regime',
    'finalizada',p_sale->>'notes',p_sale->>'operator_name',coalesce((p_sale->>'sold_at')::timestamptz,now()),
    coalesce(nullif(p_sale->>'cashier_user_id','')::uuid,auth.uid()),v_cash_session_id,p_sale->>'customer_address')
  ON CONFLICT(company_id,external_id) DO UPDATE SET external_id=excluded.external_id
  RETURNING id INTO v_sale_id;
  IF EXISTS(SELECT 1 FROM public.ks_sale_items WHERE sale_id=v_sale_id) THEN RETURN v_sale_id; END IF;

  SELECT * INTO v_license FROM public.ks_company_licenses WHERE company_id=p_company_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_license.status NOT IN ('trial','active') THEN RAISE EXCEPTION 'LICENCE_REQUIRED: a licença não está activa. Solicite uma chave de activação.'; END IF;
  IF v_license.expires_at IS NULL OR v_license.expires_at<=now() THEN RAISE EXCEPTION 'LICENCE_EXPIRED: o período de utilização terminou. As consultas e exportações continuam disponíveis; active uma licença para emitir novas facturas.'; END IF;
  SELECT * INTO v_plan FROM public.ks_saas_plans WHERE plan_code=v_license.plan_code;
  v_limit:=coalesce(v_license.max_invoices_override,v_plan.max_invoices_period,0);
  SELECT coalesce(sum(invoices_count),0)::integer INTO v_used FROM public.ks_license_usage_daily
    WHERE company_id=p_company_id AND usage_date>=date_trunc('month',now())::date;
  IF v_limit>0 AND v_used>=v_limit THEN RAISE EXCEPTION 'INVOICE_QUOTA_REACHED: o pacote atingiu o limite de facturas deste mês. Actualize o pacote ou aguarde o próximo período.'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty:=(v_item->>'quantity')::numeric;
    IF coalesce((v_item->>'stock_tracked')::boolean,true) THEN
      SELECT * INTO v_product FROM public.ks_products
        WHERE company_id=p_company_id AND external_id=v_item->>'product_external_id' FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado: %',v_item->>'product_external_id'; END IF;
      IF v_product.price_approved IS NOT TRUE AND NOT private.ks_has_company_role(p_company_id,ARRAY['owner','admin']) THEN
        RAISE EXCEPTION 'O preço do produto % aguarda aprovação do Financeiro.',v_product.name USING errcode='22023';
      END IF;
      IF v_product.stock_quantity<v_qty THEN RAISE EXCEPTION 'Stock insuficiente para % (disponível %, solicitado %)',v_product.name,v_product.stock_quantity,v_qty; END IF;
      IF private.ks_has_company_role(p_company_id,ARRAY['cashier','caixa']) AND abs(coalesce((v_item->>'unit_price')::numeric,0)-v_product.unit_price)>0.01 THEN
        RAISE EXCEPTION 'O preço de % foi alterado ou não foi autorizado pelo Financeiro. Actualize o catálogo.',v_product.name USING errcode='22023';
      END IF;
      UPDATE public.ks_products SET stock_quantity=stock_quantity-v_qty,updated_at=now() WHERE id=v_product.id;
    ELSIF private.ks_has_company_role(p_company_id,ARRAY['cashier','caixa']) THEN
      SELECT coalesce(nullif(payload->>'precoVenda','')::numeric,nullif(payload->>'preco','')::numeric),
        coalesce((payload->>'precoAprovado')::boolean,false)
      INTO v_service_price,v_service_approved FROM public.ks_records
      WHERE company_id=p_company_id AND store_key='servicos' AND record_id=v_item->>'product_external_id';
      IF NOT FOUND OR v_service_approved IS NOT TRUE THEN
        RAISE EXCEPTION 'O preço deste serviço ainda não foi autorizado pelo Financeiro.' USING errcode='22023';
      END IF;
      IF abs(coalesce((v_item->>'unit_price')::numeric,0)-coalesce(v_service_price,0))>0.01 THEN
        RAISE EXCEPTION 'O preço do serviço foi alterado. Solicite autorização ao Financeiro.' USING errcode='22023';
      END IF;
    END IF;
    INSERT INTO public.ks_sale_items(sale_id,company_id,product_external_id,product_name,quantity,unit_price,line_total,stock_tracked)
    VALUES(v_sale_id,p_company_id,v_item->>'product_external_id',coalesce(v_item->>'product_name','Artigo'),v_qty,
      coalesce((v_item->>'unit_price')::numeric,0),coalesce((v_item->>'line_total')::numeric,0),coalesce((v_item->>'stock_tracked')::boolean,true));
  END LOOP;
  INSERT INTO public.ks_license_usage_daily(company_id,usage_date,invoices_count) VALUES(p_company_id,current_date,1)
  ON CONFLICT(company_id,usage_date) DO UPDATE SET invoices_count=public.ks_license_usage_daily.invoices_count+1;
  RETURN v_sale_id;
END;
$function$;
REVOKE ALL ON FUNCTION private.ks_finalize_sale(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_finalize_sale(uuid,jsonb,jsonb) TO authenticated;
