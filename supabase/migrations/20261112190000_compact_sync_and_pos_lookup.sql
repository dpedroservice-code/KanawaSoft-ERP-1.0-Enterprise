-- Keep ERP 1.0 sync payloads small: base64 images remain stored remotely,
-- but are not downloaded on every dashboard/PDV refresh.
CREATE INDEX IF NOT EXISTS ks_records_company_store_updated_idx
  ON public.ks_records (company_id, store_key, updated_at, record_id);
CREATE OR REPLACE FUNCTION public.ks_get_records_compact(
  p_company_id uuid, p_store_key text DEFAULT NULL, p_updated_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 500, p_offset integer DEFAULT 0
)
RETURNS TABLE (store_key text, record_id text, payload jsonb, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT r.store_key, r.record_id,
    CASE
      WHEN r.store_key = 'produtos' AND pg_catalog.jsonb_typeof(r.payload->'imagem') = 'string'
        AND r.payload->>'imagem' LIKE 'data:image/%' THEN r.payload - 'imagem'
      WHEN r.store_key = 'empresaConfig' AND pg_catalog.jsonb_typeof(r.payload->'logo') = 'string'
        AND r.payload->>'logo' LIKE 'data:image/%' THEN r.payload - 'logo'
      ELSE r.payload
    END AS payload, r.updated_at
  FROM public.ks_records AS r
  WHERE r.company_id = p_company_id
    AND (p_store_key IS NULL OR r.store_key = p_store_key)
    AND (p_updated_since IS NULL OR r.updated_at >= p_updated_since)
  ORDER BY r.store_key, r.record_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;
REVOKE ALL ON FUNCTION public.ks_get_records_compact(uuid,text,timestamptz,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ks_get_records_compact(uuid,text,timestamptz,integer,integer) TO authenticated;
COMMENT ON FUNCTION public.ks_get_records_compact(uuid,text,timestamptz,integer,integer)
  IS 'Tenant-RLS-scoped compact ERP sync reader; omits base64 product/company images to reduce repeated transfer size.';
