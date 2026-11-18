-- Keep the established public RPC as a SECURITY INVOKER wrapper.
-- The protected implementation remains private and SECURITY DEFINER.
-- No product rows are rewritten by this migration.

CREATE OR REPLACE FUNCTION private.ks_sync_product(p_company_id uuid,p_product jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
  v_purchase_cost numeric(18,2);
  v_finance boolean;
  v_sku text;
  v_external_id text;
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

  v_external_id := NULLIF(p_product->>'external_id','');
  v_sku := NULLIF(p_product->>'sku','');

  -- Preserve the duplicate-SKU protection introduced by the production hotfix.
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
    stock_quantity,min_stock,description,image_path,is_active,updated_at
  )
  VALUES(
    p_company_id,
    v_external_id,
    v_sku,
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
    -- Only finance-authorized users can change the effective sale price.
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

-- The authenticated caller may invoke the private implementation through the
-- invoker wrapper; anonymous and PUBLIC execution remain denied.
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.ks_sync_product(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_sync_product(uuid,jsonb) TO authenticated;

-- Preserve the RPC name/signature used by app/cloud.js, without exposing a
-- SECURITY DEFINER implementation in the public API schema.
CREATE OR REPLACE FUNCTION public.ks_sync_product(p_company_id uuid,p_product jsonb)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.ks_sync_product($1,$2);
$function$;

REVOKE ALL ON FUNCTION public.ks_sync_product(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_sync_product(uuid,jsonb) TO authenticated;
