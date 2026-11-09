-- Idempotent POS confirmation and auditable client event metadata.
-- Existing sales remain untouched; new retries are bound to the original payload.
begin;

alter table public.ks_sales
  add column if not exists client_event_id uuid,
  add column if not exists client_created_at timestamptz,
  add column if not exists request_fingerprint text;

create unique index if not exists ks_sales_company_client_event_uidx
  on public.ks_sales(company_id,client_event_id)
  where client_event_id is not null;

create index if not exists ks_sales_company_client_created_at_idx
  on public.ks_sales(company_id,client_created_at desc)
  where client_created_at is not null;

CREATE OR REPLACE FUNCTION private.ks_finalize_sale(p_company_id uuid, p_sale jsonb, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_product public.ks_products%rowtype;
  v_qty numeric;
  v_license public.ks_company_licenses%rowtype;
  v_plan public.ks_saas_plans%rowtype;
  v_limit integer;
  v_used integer;
  v_cash_session_id uuid;
  v_max_discount numeric(5,2) := 5;
  v_max_sale numeric(18,2);
  v_discount_percent numeric(5,2);
  v_service_price numeric(18,2);
  v_service_approved boolean;
  v_is_lifetime boolean := false;
  v_external_id text;
  v_client_event_id uuid;
  v_request_fingerprint text;
  v_existing_count integer;
  v_existing_item_count integer;
  v_existing_sale_id uuid;
  v_existing_external_id text;
  v_existing_event_id uuid;
  v_existing_fingerprint text;
begin
  if not private.ks_has_company_role(p_company_id, array['owner','admin','cashier','caixa']::text[]) then
    raise exception 'Apenas o Caixa ou Administrador pode finalizar vendas.' using errcode = '42501';
  end if;

  v_external_id := nullif(trim(p_sale->>'external_id'),'');
  if v_external_id is null then
    raise exception 'A venda exige um identificador externo estável.' using errcode='22023';
  end if;
  v_client_event_id := nullif(p_sale->>'client_event_id','')::uuid;
  v_request_fingerprint := md5(jsonb_build_object(
    'sale', p_sale - 'client_event_id' - 'client_created_at',
    'items', p_items
  )::text);

  -- Fast path: a confirmed replay returns the original sale before requiring an open cash drawer.
  select count(*)::integer into v_existing_count
  from public.ks_sales
  where company_id=p_company_id
    and (external_id=v_external_id or (v_client_event_id is not null and client_event_id=v_client_event_id));
  if v_existing_count > 1 then
    raise exception 'Conflito de idempotência: o identificador da venda e o evento apontam para registos diferentes.'
      using errcode='23505';
  elsif v_existing_count = 1 then
    select id,external_id,client_event_id,request_fingerprint
      into v_existing_sale_id,v_existing_external_id,v_existing_event_id,v_existing_fingerprint
    from public.ks_sales
    where company_id=p_company_id
      and (external_id=v_external_id or (v_client_event_id is not null and client_event_id=v_client_event_id))
    for update;

    if v_existing_external_id is distinct from v_external_id
      or (v_existing_event_id is not null and v_client_event_id is not null
          and v_existing_event_id is distinct from v_client_event_id)
      or (v_existing_fingerprint is not null and v_existing_fingerprint is distinct from v_request_fingerprint) then
      raise exception 'IDEMPOTENCY_CONFLICT: este identificador já foi utilizado com dados diferentes. Não altere a venda original.'
        using errcode='23505';
    end if;

    select count(*)::integer into v_existing_item_count
    from public.ks_sale_items where sale_id=v_existing_sale_id and company_id=p_company_id;
    if v_existing_item_count=0 then
      raise exception 'A venda anterior está incompleta e exige revisão administrativa.' using errcode='55000';
    end if;
    return v_existing_sale_id;
  end if;

  if private.ks_has_company_role(p_company_id, array['cashier','caixa']::text[]) then
    v_cash_session_id := nullif(p_sale->>'cash_session_id','')::uuid;
    if v_cash_session_id is null or not exists (
      select 1
      from public.ks_cash_sessions cs
      where cs.id = v_cash_session_id
        and cs.company_id = p_company_id
        and cs.cashier_user_id = auth.uid()
        and cs.status = 'open'
    ) then
      raise exception 'Abra a sua caixa antes de finalizar uma venda.' using errcode = '42501';
    end if;

    select coalesce(cp.max_discount_percent,5), cp.max_sale_amount
      into v_max_discount, v_max_sale
    from public.ks_commercial_policies cp
    where cp.company_id = p_company_id;

    v_max_discount := coalesce(v_max_discount,5);

    if v_max_sale is not null and v_max_sale > 0
      and coalesce((p_sale->>'total')::numeric,0) > v_max_sale then
      raise exception 'O Financeiro definiu o limite máximo por venda em %.', v_max_sale using errcode = '22023';
    end if;

    if coalesce((p_sale->>'subtotal')::numeric,0) > 0 then
      v_discount_percent := coalesce((p_sale->>'discount_value')::numeric,0)
        / ((p_sale->>'subtotal')::numeric) * 100;
      if v_discount_percent > v_max_discount + 0.001 then
        raise exception 'Desconto acima do limite aprovado pelo Financeiro (% por cento).', v_max_discount using errcode = '22023';
      end if;
    end if;
  end if;

  insert into public.ks_sales(
    company_id, external_id, client_event_id, client_created_at, request_fingerprint,
    invoice_number, customer_name, customer_tax_id, customer_phone,
    subtotal, discount_value, tax_amount, total, amount_received, change_amount,
    payment_method, tax_regime, status, notes, operator_name, sold_at,
    cashier_user_id, cash_session_id, customer_address
  )
  values (
    p_company_id, v_external_id, v_client_event_id,
    nullif(p_sale->>'client_created_at','')::timestamptz, v_request_fingerprint,
    coalesce(p_sale->>'invoice_number','FT'),
    p_sale->>'customer_name', p_sale->>'customer_tax_id', p_sale->>'customer_phone',
    coalesce((p_sale->>'subtotal')::numeric,0), coalesce((p_sale->>'discount_value')::numeric,0),
    coalesce((p_sale->>'tax_amount')::numeric,0), coalesce((p_sale->>'total')::numeric,0),
    coalesce((p_sale->>'amount_received')::numeric,0), coalesce((p_sale->>'change_amount')::numeric,0),
    p_sale->>'payment_method', p_sale->>'tax_regime', 'finalizada', p_sale->>'notes',
    p_sale->>'operator_name', coalesce((p_sale->>'sold_at')::timestamptz,now()),
    coalesce(nullif(p_sale->>'cashier_user_id','')::uuid,auth.uid()),
    v_cash_session_id, p_sale->>'customer_address'
  )
  on conflict do nothing
  returning id into v_sale_id;

  -- A concurrent retry can win the unique external-ID or event-ID index while this
  -- transaction waits. Re-read and validate the exact payload before returning it.
  if v_sale_id is null then
    select count(*)::integer into v_existing_count
    from public.ks_sales
    where company_id=p_company_id
      and (external_id=v_external_id or (v_client_event_id is not null and client_event_id=v_client_event_id));
    if v_existing_count <> 1 then
      raise exception 'Conflito de idempotência: não foi possível identificar unicamente a venda já recebida.'
        using errcode='23505';
    end if;

    select id,external_id,client_event_id,request_fingerprint
      into v_existing_sale_id,v_existing_external_id,v_existing_event_id,v_existing_fingerprint
    from public.ks_sales
    where company_id=p_company_id
      and (external_id=v_external_id or (v_client_event_id is not null and client_event_id=v_client_event_id))
    for update;

    if v_existing_external_id is distinct from v_external_id
      or (v_existing_event_id is not null and v_client_event_id is not null
          and v_existing_event_id is distinct from v_client_event_id)
      or (v_existing_fingerprint is not null and v_existing_fingerprint is distinct from v_request_fingerprint) then
      raise exception 'IDEMPOTENCY_CONFLICT: este identificador já foi utilizado com dados diferentes. Não altere a venda original.'
        using errcode='23505';
    end if;

    select count(*)::integer into v_existing_item_count
    from public.ks_sale_items where sale_id=v_existing_sale_id and company_id=p_company_id;
    if v_existing_item_count=0 then
      raise exception 'A venda anterior está incompleta e exige revisão administrativa.' using errcode='55000';
    end if;
    return v_existing_sale_id;
  end if;

  select *
    into v_license
  from public.ks_company_licenses
  where company_id = p_company_id
  order by created_at desc
  limit 1
  for update;

  if not found or v_license.status not in ('trial','active') then
    raise exception 'LICENCE_REQUIRED: a licença não está activa. Solicite uma chave de activação.';
  end if;

  if v_license.starts_at is not null and v_license.starts_at > now() then
    raise exception 'LICENCE_NOT_STARTED: a licença ainda não iniciou.';
  end if;

  select coalesce(t.is_lifetime, false) or v_license.plan_code = 'internal_lifetime'
    into v_is_lifetime
  from (select 1) seed
  left join public.ks_license_terms t on t.term_code = v_license.term_code;

  if not (
    coalesce(v_is_lifetime, false)
    or (v_license.expires_at is not null and v_license.expires_at > now())
    or (v_license.grace_until is not null and v_license.grace_until > now())
  ) then
    raise exception 'LICENCE_EXPIRED: o período de utilização terminou. As consultas e exportações continuam disponíveis; active uma licença para emitir novas facturas.';
  end if;

  select *
    into v_plan
  from public.ks_saas_plans
  where plan_code = v_license.plan_code;

  v_limit := coalesce(v_license.max_invoices_override, v_plan.max_invoices_period, 0);

  select coalesce(sum(invoices_count),0)::integer
    into v_used
  from public.ks_license_usage_daily
  where company_id = p_company_id
    and usage_date >= date_trunc('month',now())::date;

  if v_limit > 0 and v_used >= v_limit then
    raise exception 'INVOICE_QUOTA_REACHED: o pacote atingiu o limite de facturas deste mês. Actualize o pacote ou aguarde o próximo período.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;

    if coalesce((v_item->>'stock_tracked')::boolean,true) then
      select *
        into v_product
      from public.ks_products
      where company_id = p_company_id
        and external_id = v_item->>'product_external_id'
      for update;

      if not found then
        raise exception 'Produto não encontrado: %', v_item->>'product_external_id';
      end if;

      if v_product.price_approved is not true
        and not private.ks_has_company_role(p_company_id,array['owner','admin']::text[]) then
        raise exception 'O preço do produto % aguarda aprovação do Financeiro.', v_product.name using errcode = '22023';
      end if;

      if v_product.stock_quantity < v_qty then
        raise exception 'Stock insuficiente para % (disponível %, solicitado %)', v_product.name, v_product.stock_quantity, v_qty;
      end if;

      if private.ks_has_company_role(p_company_id,array['cashier','caixa']::text[])
        and abs(coalesce((v_item->>'unit_price')::numeric,0)-v_product.unit_price) > 0.01 then
        raise exception 'O preço de % foi alterado ou não foi autorizado pelo Financeiro. Actualize o catálogo.', v_product.name using errcode = '22023';
      end if;

      update public.ks_products
      set stock_quantity = stock_quantity - v_qty, updated_at = now()
      where id = v_product.id;

    elsif private.ks_has_company_role(p_company_id,array['cashier','caixa']::text[]) then
      select
        coalesce(nullif(payload->>'precoVenda','')::numeric,nullif(payload->>'preco','')::numeric),
        coalesce((payload->>'precoAprovado')::boolean,false)
      into v_service_price, v_service_approved
      from public.ks_records
      where company_id = p_company_id
        and store_key = 'servicos'
        and record_id = v_item->>'product_external_id';

      if not found or v_service_approved is not true then
        raise exception 'O preço deste serviço ainda não foi autorizado pelo Financeiro.' using errcode = '22023';
      end if;

      if abs(coalesce((v_item->>'unit_price')::numeric,0)-coalesce(v_service_price,0)) > 0.01 then
        raise exception 'O preço do serviço foi alterado. Solicite autorização ao Financeiro.' using errcode = '22023';
      end if;
    end if;

    insert into public.ks_sale_items(
      sale_id, company_id, product_external_id, product_name,
      quantity, unit_price, line_total, stock_tracked
    )
    values (
      v_sale_id, p_company_id, v_item->>'product_external_id',
      coalesce(v_item->>'product_name','Artigo'), v_qty,
      coalesce((v_item->>'unit_price')::numeric,0),
      coalesce((v_item->>'line_total')::numeric,0),
      coalesce((v_item->>'stock_tracked')::boolean,true)
    );
  end loop;

  insert into public.ks_license_usage_daily(company_id,usage_date,invoices_count)
  values(p_company_id,current_date,1)
  on conflict(company_id,usage_date)
  do update set invoices_count = public.ks_license_usage_daily.invoices_count + 1;

  return v_sale_id;
end
$function$


;
revoke all on function private.ks_finalize_sale(uuid,jsonb,jsonb) from public,anon;
grant execute on function private.ks_finalize_sale(uuid,jsonb,jsonb) to authenticated,service_role;

commit;
