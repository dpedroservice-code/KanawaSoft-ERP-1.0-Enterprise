-- Correct internal lifetime-license handling in entitlements and sale finalization.
-- A NULL expiry is valid only for an explicit lifetime term; grace periods and start dates are respected.

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
begin
  if not private.ks_has_company_role(p_company_id, array['owner','admin','cashier','caixa']::text[]) then
    raise exception 'Apenas o Caixa ou Administrador pode finalizar vendas.' using errcode = '42501';
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
    company_id, external_id, invoice_number, customer_name, customer_tax_id, customer_phone,
    subtotal, discount_value, tax_amount, total, amount_received, change_amount,
    payment_method, tax_regime, status, notes, operator_name, sold_at,
    cashier_user_id, cash_session_id, customer_address
  )
  values (
    p_company_id, p_sale->>'external_id', coalesce(p_sale->>'invoice_number','FT'),
    p_sale->>'customer_name', p_sale->>'customer_tax_id', p_sale->>'customer_phone',
    coalesce((p_sale->>'subtotal')::numeric,0), coalesce((p_sale->>'discount_value')::numeric,0),
    coalesce((p_sale->>'tax_amount')::numeric,0), coalesce((p_sale->>'total')::numeric,0),
    coalesce((p_sale->>'amount_received')::numeric,0), coalesce((p_sale->>'change_amount')::numeric,0),
    p_sale->>'payment_method', p_sale->>'tax_regime', 'finalizada', p_sale->>'notes',
    p_sale->>'operator_name', coalesce((p_sale->>'sold_at')::timestamptz,now()),
    coalesce(nullif(p_sale->>'cashier_user_id','')::uuid,auth.uid()),
    v_cash_session_id, p_sale->>'customer_address'
  )
  on conflict(company_id,external_id) do update set external_id = excluded.external_id
  returning id into v_sale_id;

  if exists(select 1 from public.ks_sale_items where sale_id = v_sale_id) then
    return v_sale_id;
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

CREATE OR REPLACE FUNCTION private.ks_get_company_entitlements(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.ks_has_company_role(
    p_company_id,
    array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]
  ) then
    raise exception 'Acesso negado às permissões desta empresa';
  end if;

  return (
    select jsonb_build_object(
      'company_id', p_company_id,
      'license', (
        select to_jsonb(l) - 'license_key'
        from public.ks_company_licenses l
        where l.company_id = p_company_id
        order by l.created_at desc
        limit 1
      ),
      'plan', (
        select to_jsonb(p)
        from public.ks_saas_plans p
        join public.ks_company_licenses l on l.plan_code = p.plan_code
        where l.company_id = p_company_id
        order by l.created_at desc
        limit 1
      ),
      'invoice_limit', (
        select coalesce(l.max_invoices_override, p.max_invoices_period)
        from public.ks_company_licenses l
        join public.ks_saas_plans p on p.plan_code = l.plan_code
        where l.company_id = p_company_id
        order by l.created_at desc
        limit 1
      ),
      'invoice_usage', (
        select coalesce(sum(u.invoices_count), 0)
        from public.ks_license_usage_daily u
        where u.company_id = p_company_id
          and u.usage_date >= date_trunc('month', now())::date
      ),
      'read_only', not exists (
        select 1
        from public.ks_company_licenses l
        left join public.ks_license_terms t on t.term_code = l.term_code
        where l.company_id = p_company_id
          and l.status in ('trial', 'active')
          and (l.starts_at is null or l.starts_at <= now())
          and (
            coalesce(t.is_lifetime, false)
            or l.plan_code = 'internal_lifetime'
            or (l.expires_at is not null and l.expires_at > now())
            or (l.grace_until is not null and l.grace_until > now())
          )
      )
    )
  );
end
$function$
;
