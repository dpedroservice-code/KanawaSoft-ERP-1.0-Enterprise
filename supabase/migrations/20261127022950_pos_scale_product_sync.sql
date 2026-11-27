CREATE OR REPLACE FUNCTION private.ks_sync_product(p_company_id uuid, p_product jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_purchase_cost numeric(18,2);
  v_finance boolean;
  v_sku text;
  v_external_id text;
  v_uses_scale boolean;
  v_scale_plu text;
  v_unit text;
BEGIN
  IF NOT private.ks_has_company_role(
    p_company_id,
    ARRAY['owner','admin','manager','gerente']::text[]
  ) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar produtos' USING errcode='42501';
  END IF;

  v_finance := private.ks_has_company_role(
    p_company_id,
    ARRAY['owner','admin']::text[]
  );

  v_external_id := NULLIF(p_product->>'external_id','');
  v_sku := NULLIF(p_product->>'sku','');
  v_unit := upper(coalesce(nullif(p_product->>'unit',''),'UN'));
  v_uses_scale := coalesce((p_product->>'uses_scale')::boolean,false);
  v_scale_plu := NULLIF(trim(coalesce(p_product->>'scale_plu','')),'');

  IF v_uses_scale AND v_unit NOT IN ('KG','G') THEN
    RAISE EXCEPTION 'Produtos ligados à balança devem utilizar a unidade KG ou G.' USING errcode='22023';
  END IF;

  IF v_sku IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.ks_products existing
    WHERE existing.company_id = p_company_id
      AND existing.sku = v_sku
      AND existing.external_id IS DISTINCT FROM v_external_id
  ) THEN
    v_sku := NULL;
  END IF;

  v_purchase_cost := CASE
    WHEN p_product->>'purchase_cost' IS NULL OR p_product->>'purchase_cost' = '' THEN NULL
    ELSE greatest((p_product->>'purchase_cost')::numeric,0)
  END;

  INSERT INTO public.ks_products AS current_product(
    company_id,external_id,sku,name,category,unit,unit_price,purchase_cost,
    stock_quantity,min_stock,description,image_path,is_active,uses_scale,scale_plu,updated_at
  )
  VALUES(
    p_company_id,
    v_external_id,
    v_sku,
    coalesce(nullif(p_product->>'name',''),'Produto'),
    p_product->>'category',
    v_unit,
    CASE WHEN v_finance THEN greatest(coalesce((p_product->>'unit_price')::numeric,0),0) ELSE 0 END,
    v_purchase_cost,
    greatest(coalesce((p_product->>'stock_quantity')::numeric,0),0),
    greatest(coalesce((p_product->>'min_stock')::numeric,0),0),
    p_product->>'description',
    p_product->>'image_path',
    coalesce((p_product->>'is_active')::boolean,true),
    v_uses_scale,
    v_scale_plu,
    now()
  )
  ON CONFLICT(company_id,external_id) DO UPDATE SET
    sku=excluded.sku,
    name=excluded.name,
    category=excluded.category,
    unit=excluded.unit,
    unit_price=CASE WHEN v_finance THEN excluded.unit_price ELSE current_product.unit_price END,
    purchase_cost=excluded.purchase_cost,
    min_stock=excluded.min_stock,
    description=excluded.description,
    image_path=excluded.image_path,
    is_active=excluded.is_active,
    uses_scale=excluded.uses_scale,
    scale_plu=excluded.scale_plu,
    updated_at=now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
