-- Append-only fiscal document ledger. Commercial sales remain in ks_sales;
-- this ledger stores the immutable, print-ready fiscal snapshot for each issued FT/FR.
create table if not exists public.ks_fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ks_companies(id) on delete restrict,
  source_sale_id uuid references public.ks_sales(id) on delete restrict,
  source_document_id uuid references public.ks_fiscal_documents(id) on delete restrict,
  document_type text not null check (document_type in ('FT','FR','RE','NC')),
  document_number text not null,
  issued_at timestamptz not null,
  issuer_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  tax_regime text,
  currency_code text not null default 'AOA' check (currency_code='AOA'),
  subtotal numeric(18,2) not null default 0 check (subtotal>=0),
  discount_total numeric(18,2) not null default 0 check (discount_total>=0),
  taxable_base numeric(18,2) not null default 0 check (taxable_base>=0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount>=0),
  total numeric(18,2) not null check (total>=0),
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines)='array'),
  metadata jsonb not null default '{}'::jsonb,
  certification_status text not null default 'not_certified'
    check (certification_status in ('not_certified','pending','certified','rejected')),
  idempotency_key uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(company_id,document_number),
  unique(company_id,idempotency_key)
);

create index if not exists ks_fiscal_documents_company_issued_idx
  on public.ks_fiscal_documents(company_id,issued_at desc);
create index if not exists ks_fiscal_documents_source_sale_idx
  on public.ks_fiscal_documents(company_id,source_sale_id);
create unique index if not exists ks_fiscal_documents_one_sale_type_idx
  on public.ks_fiscal_documents(company_id,source_sale_id,document_type)
  where source_sale_id is not null;

alter table public.ks_fiscal_documents enable row level security;
revoke all on table public.ks_fiscal_documents from public,anon,authenticated;
grant select on table public.ks_fiscal_documents to authenticated;

drop policy if exists ks_fiscal_documents_tenant_read on public.ks_fiscal_documents;
create policy ks_fiscal_documents_tenant_read on public.ks_fiscal_documents
  for select to authenticated
  using (
    private.ks_has_company_permission(company_id,'vendas','ver')
    or private.ks_has_company_permission(company_id,'fiscal','ver')
    or private.ks_has_company_permission(company_id,'financeiro','ver')
  );

create or replace function private.ks_reject_fiscal_document_mutation()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  raise exception 'Documentos fiscais emitidos são imutáveis. Emita um documento rectificativo ou nota de crédito.';
end;
$$;

drop trigger if exists ks_fiscal_documents_append_only on public.ks_fiscal_documents;
create trigger ks_fiscal_documents_append_only
before update or delete on public.ks_fiscal_documents
for each row execute function private.ks_reject_fiscal_document_mutation();

create or replace function private.ks_finalize_fiscal_sale(
  p_company_id uuid,
  p_sale jsonb,
  p_items jsonb,
  p_fiscal_document jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_sale_id uuid;
  v_existing public.ks_fiscal_documents%rowtype;
  v_type text;
  v_number text;
  v_total numeric(18,2);
  v_tax numeric(18,2);
  v_subtotal numeric(18,2);
  v_discount numeric(18,2);
  v_base numeric(18,2);
  v_lines jsonb;
  v_issuer jsonb;
  v_customer jsonb;
  v_key uuid;
begin
  v_type:=upper(trim(coalesce(p_fiscal_document->>'document_type','')));
  v_number:=trim(coalesce(p_fiscal_document->>'document_number',''));
  if v_type not in ('FT','FR') then
    raise exception 'A finalização de venda só aceita Fatura (FT) ou Fatura-Recibo (FR).' using errcode='22023';
  end if;
  if v_number !~ ('^'||v_type||'-[0-9]{4}-[0-9]{6}$')
     or p_sale->>'invoice_number' is distinct from v_number then
    raise exception 'Número e tipo do documento fiscal não correspondem.' using errcode='22023';
  end if;
  v_total:=coalesce((p_fiscal_document->>'total')::numeric,0);
  v_tax:=coalesce((p_fiscal_document->>'tax_amount')::numeric,0);
  v_subtotal:=coalesce((p_fiscal_document->>'subtotal')::numeric,0);
  v_discount:=coalesce((p_fiscal_document->>'discount_total')::numeric,0);
  v_base:=coalesce((p_fiscal_document->>'taxable_base')::numeric,0);
  v_lines:=coalesce(p_fiscal_document->'lines','[]'::jsonb);
  v_issuer:=coalesce(p_fiscal_document->'issuer_snapshot','{}'::jsonb);
  v_customer:=coalesce(p_fiscal_document->'customer_snapshot','{}'::jsonb);
  v_key:=nullif(p_fiscal_document->>'idempotency_key','')::uuid;

  if v_total<=0 or v_subtotal<0 or v_discount<0 or v_base<0 or v_tax<0
     or jsonb_typeof(v_lines)<>'array' or jsonb_array_length(v_lines)=0 then
    raise exception 'Snapshot fiscal incompleto ou com valores inválidos.' using errcode='22023';
  end if;
  if nullif(v_issuer->>'taxId','') is null and nullif(v_issuer->>'nif','') is null then
    raise exception 'O snapshot do emitente exige NIF.' using errcode='22023';
  end if;
  if abs(round(v_base+v_tax-v_total,2))>0.01 then
    raise exception 'A incidência mais o imposto não corresponde ao total do documento.' using errcode='22023';
  end if;

  v_sale_id:=private.ks_finalize_sale(p_company_id,p_sale,p_items);

  select * into v_existing
  from public.ks_fiscal_documents
  where company_id=p_company_id and source_sale_id=v_sale_id and document_type=v_type
  limit 1;

  if found then
    if v_existing.document_number is distinct from v_number
       or v_existing.total is distinct from v_total
       or v_existing.tax_amount is distinct from v_tax
       or v_existing.lines is distinct from v_lines then
      raise exception 'IDEMPOTENCY_CONFLICT: a venda já tem um documento fiscal diferente. Não altere o documento original.' using errcode='23505';
    end if;
    return v_sale_id;
  end if;

  insert into public.ks_fiscal_documents(
    company_id,source_sale_id,document_type,document_number,issued_at,
    issuer_snapshot,customer_snapshot,tax_regime,subtotal,discount_total,
    taxable_base,tax_amount,total,lines,metadata,certification_status,idempotency_key,created_by
  ) values (
    p_company_id,v_sale_id,v_type,v_number,
    coalesce(nullif(p_fiscal_document->>'issued_at','')::timestamptz,now()),
    v_issuer,v_customer,nullif(p_fiscal_document->>'tax_regime',''),
    v_subtotal,v_discount,v_base,v_tax,v_total,v_lines,
    coalesce(p_fiscal_document->'metadata','{}'::jsonb),'not_certified',v_key,auth.uid()
  );

  return v_sale_id;
end;
$$;

revoke all on function private.ks_finalize_fiscal_sale(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.ks_finalize_fiscal_sale(uuid,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.ks_finalize_fiscal_sale(
  p_company_id uuid,p_sale jsonb,p_items jsonb,p_fiscal_document jsonb
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.ks_finalize_fiscal_sale(p_company_id,p_sale,p_items,p_fiscal_document);
$$;

revoke all on function public.ks_finalize_fiscal_sale(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.ks_finalize_fiscal_sale(uuid,jsonb,jsonb,jsonb) to authenticated;
