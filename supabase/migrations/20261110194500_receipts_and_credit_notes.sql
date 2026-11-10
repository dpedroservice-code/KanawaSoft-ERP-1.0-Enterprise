-- Append-only RE receipts and NC credit notes.
-- Physical stock return is deliberately not auto-posted here: it requires item/warehouse
-- verification and a separate stock movement transaction.
alter table public.ks_sales_returns
  add column if not exists fiscal_document_id uuid
  references public.ks_fiscal_documents(id) on delete restrict;

create or replace function private.ks_issue_invoice_receipt(
  p_company_id uuid,
  p_sale_external_id text,
  p_amount numeric,
  p_payment_method text,
  p_provider_reference text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_sale public.ks_sales%rowtype;
  v_invoice public.ks_fiscal_documents%rowtype;
  v_existing public.ks_fiscal_documents%rowtype;
  v_paid numeric(18,2);
  v_balance numeric(18,2);
  v_number text;
  v_id uuid;
  v_method text:=trim(coalesce(p_payment_method,''));
begin
  if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente','cashier','caixa']::text[]) then
    raise exception 'Sem permissão para registar recebimentos nesta empresa.' using errcode='42501';
  end if;
  if p_idempotency_key is not null then
    select * into v_existing from public.ks_fiscal_documents
      where company_id=p_company_id and idempotency_key=p_idempotency_key;
    if found then
      if v_existing.document_type<>'RE' or v_existing.total<>round(p_amount,2) then
        raise exception 'IDEMPOTENCY_CONFLICT: esta chave já foi usada noutro recebimento.' using errcode='23505';
      end if;
      return jsonb_build_object('id',v_existing.id,'document_number',v_existing.document_number,'amount',v_existing.total,'replayed',true);
    end if;
  end if;
  if p_amount is null or p_amount<=0 or length(v_method)<2 then
    raise exception 'Valor e meio de pagamento válidos são obrigatórios.' using errcode='22023';
  end if;

  select * into v_sale from public.ks_sales
    where company_id=p_company_id and external_id=p_sale_external_id
    for update;
  if not found then raise exception 'Fatura de origem não encontrada.' using errcode='P0002'; end if;

  select * into v_invoice from public.ks_fiscal_documents
    where company_id=p_company_id and source_sale_id=v_sale.id and document_type='FT'
    order by created_at desc limit 1;
  if not found then raise exception 'Só é possível emitir RE para uma FT registada no livro fiscal.' using errcode='22023'; end if;

  if v_sale.status not in ('finalizada','finalizado') then
    raise exception 'Só é possível emitir RE para uma venda finalizada.' using errcode='22023';
  end if;
  select greatest(coalesce(sum(amount),0),coalesce(v_sale.amount_received,0)-coalesce(v_sale.change_amount,0)) into v_paid
  from public.ks_payment_transactions
  where company_id=p_company_id and sale_id=v_sale.id and status='paid';
  v_balance:=round(v_sale.total-v_paid,2);
  if p_amount>v_balance+0.001 then
    raise exception 'O recebimento excede o saldo em dívida (%).',v_balance using errcode='22023';
  end if;

  v_number:=private.ks_next_invoice_number(p_company_id,'RE',now());
  insert into public.ks_payment_transactions(company_id,sale_id,provider,provider_reference,amount,currency_code,status,paid_at,metadata)
  values(p_company_id,v_sale.id,v_method,nullif(trim(coalesce(p_provider_reference,'')),''),round(p_amount,2),'AOA','paid',now(),
    jsonb_build_object('document_type','RE','source_invoice',v_invoice.document_number,'idempotency_key',p_idempotency_key))
  returning id into v_id;

  insert into public.ks_fiscal_documents(
    company_id,source_sale_id,source_document_id,document_type,document_number,issued_at,
    issuer_snapshot,customer_snapshot,tax_regime,currency_code,subtotal,discount_total,
    taxable_base,tax_amount,total,lines,metadata,certification_status,idempotency_key,created_by
  ) values (
    p_company_id,v_sale.id,v_invoice.id,'RE',v_number,now(),
    v_invoice.issuer_snapshot,v_invoice.customer_snapshot,v_invoice.tax_regime,'AOA',
    0,0,0,0,round(p_amount,2),'[]'::jsonb,
    jsonb_build_object('payment_transaction_id',v_id,'payment_method',v_method,
      'provider_reference',nullif(trim(coalesce(p_provider_reference,'')),''),
      'source_invoice',v_invoice.document_number,'balance_after',round(v_balance-p_amount,2)),
    'not_certified',p_idempotency_key,auth.uid()
  );
  select id into v_id from public.ks_fiscal_documents where company_id=p_company_id and document_number=v_number;
  return jsonb_build_object('id',v_id,'document_number',v_number,'amount',round(p_amount,2),'balance_after',round(v_balance-p_amount,2),'replayed',false);
end;
$$;

revoke all on function private.ks_issue_invoice_receipt(uuid,text,numeric,text,text,uuid) from public,anon,authenticated;
grant execute on function private.ks_issue_invoice_receipt(uuid,text,numeric,text,text,uuid) to authenticated;

create or replace function public.ks_issue_invoice_receipt(
  p_company_id uuid,p_sale_external_id text,p_amount numeric,p_payment_method text,
  p_provider_reference text,p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.ks_issue_invoice_receipt(p_company_id,p_sale_external_id,p_amount,p_payment_method,p_provider_reference,p_idempotency_key);
$$;
revoke all on function public.ks_issue_invoice_receipt(uuid,text,numeric,text,text,uuid) from public,anon;
grant execute on function public.ks_issue_invoice_receipt(uuid,text,numeric,text,text,uuid) to authenticated;

create or replace function private.ks_issue_credit_note(
  p_company_id uuid,
  p_sale_external_id text,
  p_amount numeric,
  p_taxable_base numeric,
  p_tax_amount numeric,
  p_reason text,
  p_lines jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_sale public.ks_sales%rowtype;
  v_invoice public.ks_fiscal_documents%rowtype;
  v_existing public.ks_fiscal_documents%rowtype;
  v_credited numeric(18,2);
  v_line_total numeric(18,2);
  v_line_tax numeric(18,2);
  v_number text;
  v_doc_id uuid;
begin
  if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente']::text[]) then
    raise exception 'Só o Administrador ou Gerente pode emitir uma Nota de Crédito.' using errcode='42501';
  end if;
  if p_idempotency_key is not null then
    select * into v_existing from public.ks_fiscal_documents
      where company_id=p_company_id and idempotency_key=p_idempotency_key;
    if found then
      if v_existing.document_type<>'NC' or v_existing.total<>round(p_amount,2) then
        raise exception 'IDEMPOTENCY_CONFLICT: esta chave já foi usada noutro documento.' using errcode='23505';
      end if;
      return jsonb_build_object('id',v_existing.id,'document_number',v_existing.document_number,'amount',v_existing.total,'replayed',true);
    end if;
  end if;
  if p_amount is null or p_amount<=0 or p_taxable_base is null or p_taxable_base<0
     or p_tax_amount is null or p_tax_amount<0
     or abs(round(p_taxable_base+p_tax_amount-p_amount,2))>0.01
     or length(trim(coalesce(p_reason,'')))<5
     or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then
    raise exception 'Nota de Crédito inválida: indique motivo, linhas e totais fiscais equilibrados.' using errcode='22023';
  end if;

  select * into v_sale from public.ks_sales
    where company_id=p_company_id and external_id=p_sale_external_id
    for update;
  if not found then raise exception 'Documento de venda original não encontrado.' using errcode='P0002'; end if;
  if v_sale.status not in ('finalizada','finalizado') then
    raise exception 'A Nota de Crédito exige uma venda original finalizada.' using errcode='22023';
  end if;

  select * into v_invoice from public.ks_fiscal_documents
    where company_id=p_company_id and source_sale_id=v_sale.id and document_type in ('FT','FR')
    order by created_at desc limit 1;
  if not found then raise exception 'A venda original não possui documento fiscal no livro imutável.' using errcode='22023'; end if;

  select coalesce(sum(total),0) into v_credited
  from public.ks_fiscal_documents
  where company_id=p_company_id and source_document_id=v_invoice.id and document_type='NC';
  if round(p_amount,2)>round(v_sale.total-v_credited,2)+0.001 then
    raise exception 'A Nota de Crédito excede o valor ainda não rectificado (%).',round(v_sale.total-v_credited,2) using errcode='22023';
  end if;

  select coalesce(sum(coalesce(nullif(value->>'line_total','')::numeric,0)),0),
         coalesce(sum(coalesce(nullif(value->>'tax_amount','')::numeric,0)),0)
    into v_line_total,v_line_tax
  from jsonb_array_elements(p_lines);
  if abs(round(v_line_total-p_amount,2))>0.01 or abs(round(v_line_tax-p_tax_amount,2))>0.01 then
    raise exception 'As linhas da NC não correspondem aos totais indicados.' using errcode='22023';
  end if;

  v_number:=private.ks_next_invoice_number(p_company_id,'NC',now());
  insert into public.ks_fiscal_documents(
    company_id,source_sale_id,source_document_id,document_type,document_number,issued_at,
    issuer_snapshot,customer_snapshot,tax_regime,currency_code,subtotal,discount_total,
    taxable_base,tax_amount,total,lines,metadata,certification_status,idempotency_key,created_by
  ) values (
    p_company_id,v_sale.id,v_invoice.id,'NC',v_number,now(),
    v_invoice.issuer_snapshot,v_invoice.customer_snapshot,v_invoice.tax_regime,'AOA',
    round(p_taxable_base,2),0,round(p_taxable_base,2),round(p_tax_amount,2),round(p_amount,2),
    p_lines,jsonb_build_object('reason',trim(p_reason),'source_invoice',v_invoice.document_number,
      'stock_adjustment_status','pending_manual_review'),
    'not_certified',p_idempotency_key,auth.uid()
  ) returning id into v_doc_id;

  insert into public.ks_sales_returns(company_id,sale_id,reason,status,refund_amount,fiscal_document_id)
  values(p_company_id,v_sale.id,trim(p_reason),'credit_note_issued',round(p_amount,2),v_doc_id);

  return jsonb_build_object('id',v_doc_id,'document_number',v_number,'amount',round(p_amount,2),
    'source_invoice',v_invoice.document_number,'stock_adjustment_status','pending_manual_review','replayed',false);
end;
$$;

revoke all on function private.ks_issue_credit_note(uuid,text,numeric,numeric,numeric,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.ks_issue_credit_note(uuid,text,numeric,numeric,numeric,text,jsonb,uuid) to authenticated;

create or replace function public.ks_issue_credit_note(
  p_company_id uuid,p_sale_external_id text,p_amount numeric,p_taxable_base numeric,
  p_tax_amount numeric,p_reason text,p_lines jsonb,p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.ks_issue_credit_note(p_company_id,p_sale_external_id,p_amount,p_taxable_base,p_tax_amount,p_reason,p_lines,p_idempotency_key);
$$;
revoke all on function public.ks_issue_credit_note(uuid,text,numeric,numeric,numeric,text,jsonb,uuid) from public,anon;
grant execute on function public.ks_issue_credit_note(uuid,text,numeric,numeric,numeric,text,jsonb,uuid) to authenticated;
