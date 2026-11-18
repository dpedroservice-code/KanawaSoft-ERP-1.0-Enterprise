-- Prevent unapproved catalog writes from changing the effective normalized sale price.
-- The application record may retain a proposed price marked pending; ks_products.unit_price
-- remains the last approved price until a finance-authorized actor writes the approval.
CREATE OR REPLACE FUNCTION public.ks_sync_product(p_company_id uuid,p_product jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
  v_purchase_cost numeric(18,2);
  v_finance boolean;
BEGIN
  IF NOT private.ks_has_company_role(
    p_company_id,
    ARRAY['owner','admin','manager','gerente','accountant','contabilista']::text[]
  ) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar produtos' USING errcode='42501';
  END IF;

  v_finance := private.ks_has_company_role(
    p_company_id,
    ARRAY['owner','admin','accountant','contabilista']::text[]
  );

  v_purchase_cost := CASE
    WHEN p_product->>'purchase_cost' IS NULL OR p_product->>'purchase_cost' = '' THEN NULL
    ELSE greatest((p_product->>'purchase_cost')::numeric,0)
  END;

  INSERT INTO public.ks_products AS current_product(
    company_id,external_id,sku,name,category,unit,unit_price,purchase_cost,
    stock_quantity,min_stock,description,image_path,is_active,updated_at
  )
  VALUES(
    p_company_id,
    p_product->>'external_id',
    nullif(p_product->>'sku',''),
    coalesce(nullif(p_product->>'name',''),'Produto'),
    p_product->>'category',
    coalesce(nullif(p_product->>'unit',''),'UN'),
    CASE WHEN v_finance THEN greatest(coalesce((p_product->>'unit_price')::numeric,0),0) ELSE 0 END,
    v_purchase_cost,
    greatest(coalesce((p_product->>'stock_quantity')::numeric,0),0),
    greatest(coalesce((p_product->>'min_stock')::numeric,0),0),
    p_product->>'description',
    p_product->>'image_path',
    coalesce((p_product->>'is_active')::boolean,true),
    now()
  )
  ON CONFLICT(company_id,external_id) DO UPDATE SET
    sku=excluded.sku,
    name=excluded.name,
    category=excluded.category,
    unit=excluded.unit,
    -- Critical guard: non-finance users cannot overwrite the active sale price.
    unit_price=CASE WHEN v_finance THEN excluded.unit_price ELSE current_product.unit_price END,
    purchase_cost=excluded.purchase_cost,
    min_stock=excluded.min_stock,
    description=excluded.description,
    image_path=excluded.image_path,
    is_active=excluded.is_active,
    updated_at=now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ks_sync_product(uuid,jsonb) FROM PUBLIC,anon;\nGRANT EXECUTE ON FUNCTION public.ks_sync_product(uuid,jsonb) TO authenticated;

-- Keep the hardened public RPC wrapper as the only client entry point.
