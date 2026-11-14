-- Production hotfix: compact sync payloads and isolate duplicate product SKUs.
-- This migration updates RPC implementation only; existing sales/products are not rewritten.

CREATE OR REPLACE FUNCTION public.ks_get_records_compact(
  p_company_id uuid,
  p_store_key text DEFAULT NULL::text,
  p_updated_since timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_include_media boolean DEFAULT false
)
RETURNS TABLE(store_key text, record_id text, payload jsonb, updated_at timestamp with time zone)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT r.store_key, r.record_id,
    CASE
      WHEN NOT COALESCE(p_include_media,false)
        AND r.store_key IN ('produtos','ecommerceProdutos')
        AND pg_catalog.jsonb_typeof(r.payload->'imagem') = 'string'
        AND r.payload->>'imagem' LIKE 'data:image/%'
        THEN r.payload - 'imagem'
      WHEN NOT COALESCE(p_include_media,false)
        AND r.store_key = 'empresaConfig'
        AND pg_catalog.jsonb_typeof(r.payload->'logo') = 'string'
        AND r.payload->>'logo' LIKE 'data:image/%'
        THEN r.payload - 'logo'
      ELSE r.payload
    END AS payload,
    r.updated_at
  FROM public.ks_records AS r
  WHERE r.company_id = p_company_id
    AND (p_store_key IS NULL OR r.store_key = p_store_key)
    AND (p_updated_since IS NULL OR r.updated_at >= p_updated_since)
  ORDER BY r.store_key, r.record_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION private.ks_sync_product(p_company_id uuid, p_product jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_purchase_cost numeric(18,2);
  v_sku text;
  v_external_id text;
BEGIN
  IF NOT private.ks_has_company_role(p_company_id, ARRAY['owner','admin','manager','gerente']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar produtos';
  END IF;

  v_external_id := NULLIF(p_product->>'external_id','');
  v_sku := NULLIF(p_product->>'sku','');

  -- Keep both products and their stable external IDs if a SKU is already owned
  -- by another product in this company. The colliding SKU is left unset.
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
    ELSE GREATEST((p_product->>'purchase_cost')::numeric, 0)
  END;

  INSERT INTO public.ks_products(
    company_id, external_id, sku, name, category, unit, unit_price, purchase_cost,
    stock_quantity, min_stock, description, image_path, is_active, updated_at
  )
  VALUES(
    p_company_id, v_external_id, v_sku,
    COALESCE(NULLIF(p_product->>'name',''),'Produto'),
    p_product->>'category',
    COALESCE(NULLIF(p_product->>'unit',''),'UN'),
    GREATEST(COALESCE((p_product->>'unit_price')::numeric,0),0),
    v_purchase_cost,
    GREATEST(COALESCE((p_product->>'stock_quantity')::numeric,0),0),
    GREATEST(COALESCE((p_product->>'min_stock')::numeric,0),0),
    p_product->>'description', p_product->>'image_path',
    COALESCE((p_product->>'is_active')::boolean,true), now()
  )
  ON CONFLICT(company_id,external_id) DO UPDATE SET
    sku=excluded.sku,
    name=excluded.name,
    category=excluded.category,
    unit=excluded.unit,
    unit_price=excluded.unit_price,
    purchase_cost=excluded.purchase_cost,
    min_stock=excluded.min_stock,
    description=excluded.description,
    image_path=excluded.image_path,
    is_active=excluded.is_active,
    updated_at=now()
  RETURNING id INTO v_id;

  RETURN v_id;
END
$function$;
