-- Backfill fiscal sales that were committed to normalized tables but missed the legacy UI mirror.
-- Idempotent: existing ks_records rows are never overwritten.
WITH missing_sales AS (
  SELECT
    s.company_id,
    s.external_id AS record_id,
    s.created_at,
    jsonb_build_object(
      'id',s.external_id,
      'numeroFatura',d.document_number,
      'invoice_number',d.document_number,
      'document_number',d.document_number,
      'tipoDocumento',d.document_type,
      'document_type',d.document_type,
      'data',s.sold_at,
      'status',s.status,
      'total',d.total,
      'subtotal',d.subtotal,
      'iva',d.tax_amount,
      'tax_amount',d.tax_amount,
      'desconto',d.discount_total,
      'descontoValor',s.discount_value,
      'regime',s.tax_regime,
      'tax_regime',s.tax_regime,
      'pagamento',s.payment_method,
      'valorRecebido',s.amount_received,
      'troco',s.change_amount,
      'clienteNome',s.customer_name,
      'clienteNif',s.customer_tax_id,
      'clienteTelefone',s.customer_phone,
      'clienteEndereco',s.customer_address,
      'observacoes',s.notes,
      'operador',s.operator_name,
      'cashierUserId',s.cashier_user_id,
      'cashSessionId',s.cash_session_id,
      'clientEventId',s.client_event_id,
      'clientCreatedAt',s.client_created_at,
      'operatorUserId',s.cashier_user_id,
      'empresa',d.issuer_snapshot,
      'detalheFiscal',d.lines,
      'baseIncidencia',d.taxable_base,
      'estadoCertificacao',d.certification_status,
      'custoTotal',s.cost_of_goods,
      'lucroBruto',s.gross_profit,
      'itens',(
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',i.product_external_id,
          'nome',i.product_name,
          'qty',i.quantity,
          'preco',i.unit_price,
          'subtotal',i.line_total,
          'lineTotal',i.line_total,
          'custoUnitario',i.unit_cost,
          'lucroLinha',i.line_profit,
          'codigo',fl.line->>'product_code',
          'unidade',fl.line->>'unit_of_measure',
          'taxRate',COALESCE((fl.line->>'tax_rate')::numeric,0),
          'taxAmount',COALESCE((fl.line->>'tax_amount')::numeric,0),
          'taxableBase',COALESCE((fl.line->>'taxable_base')::numeric,i.line_total),
          'exemptionReason',fl.line->'exemption_reason'
        ) ORDER BY i.id),'[]'::jsonb)
        FROM public.ks_sale_items i
        LEFT JOIN LATERAL (
          SELECT value AS line
          FROM jsonb_array_elements(d.lines)
          WHERE value->>'product_id'=i.product_external_id
          LIMIT 1
        ) fl ON true
        WHERE i.company_id=s.company_id AND i.sale_id=s.id
      )
    ) AS payload
  FROM public.ks_sales s
  JOIN public.ks_fiscal_documents d
    ON d.company_id=s.company_id AND d.source_sale_id=s.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ks_records r
    WHERE r.company_id=s.company_id
      AND r.store_key='vendas'
      AND r.record_id=s.external_id
  )
)
INSERT INTO public.ks_records(company_id,store_key,record_id,payload,created_at,updated_at)
SELECT company_id,'vendas',record_id,payload,created_at,now()
FROM missing_sales
ON CONFLICT(company_id,store_key,record_id) DO NOTHING;

-- Normalized stock is authoritative; reconcile the legacy product mirror for the UI.
UPDATE public.ks_records r
SET payload=jsonb_set(COALESCE(r.payload,'{}'::jsonb),'{estoque}',to_jsonb(p.stock_quantity),true),
    updated_at=now()
FROM public.ks_products p
WHERE r.company_id=p.company_id
  AND r.store_key='produtos'
  AND r.record_id=p.external_id;
