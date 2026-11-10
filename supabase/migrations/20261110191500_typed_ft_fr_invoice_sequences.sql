-- Add independent, atomic invoice sequences for FT and FR.
-- Existing two-argument RPC remains backward-compatible and continues to issue FT.
alter table private.ks_invoice_sequences
  add column if not exists document_type text not null default 'FT';

alter table private.ks_invoice_sequences
  drop constraint if exists ks_invoice_sequences_pkey;

alter table private.ks_invoice_sequences
  add constraint ks_invoice_sequences_pkey
  primary key (company_id, fiscal_year, document_type);

alter table private.ks_invoice_sequences
  drop constraint if exists ks_invoice_sequences_document_type_check;

alter table private.ks_invoice_sequences
  add constraint ks_invoice_sequences_document_type_check
  check (document_type in ('FT','FR'));

create or replace function private.ks_next_invoice_number(
  p_company_id uuid,
  p_document_type text,
  p_sold_at timestamptz default now()
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_year integer;
  v_number bigint;
  v_type text := upper(trim(coalesce(p_document_type,'')));
begin
  if v_type not in ('FT','FR') then
    raise exception 'Tipo de documento não suportado para venda: %', v_type using errcode='22023';
  end if;

  if not private.ks_has_company_role(
    p_company_id,
    array['owner','admin','manager','gerente','cashier','caixa']::text[]
  ) then
    raise exception 'Sem permissão para emitir documentos nesta empresa' using errcode='42501';
  end if;

  v_year := extract(year from coalesce(p_sold_at, now()))::integer;
  insert into private.ks_invoice_sequences(company_id,fiscal_year,document_type,last_number)
  values(p_company_id,v_year,v_type,1)
  on conflict(company_id,fiscal_year,document_type)
  do update set last_number=private.ks_invoice_sequences.last_number+1,updated_at=now()
  returning last_number into v_number;

  return v_type||'-'||v_year::text||'-'||lpad(v_number::text,6,'0');
end;
$$;

revoke all on function private.ks_next_invoice_number(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function private.ks_next_invoice_number(uuid,text,timestamptz) to authenticated;

create or replace function private.ks_next_invoice_number(
  p_company_id uuid,
  p_sold_at timestamptz default now()
)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select private.ks_next_invoice_number(p_company_id,'FT',p_sold_at);
$$;

revoke all on function private.ks_next_invoice_number(uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.ks_next_invoice_number(uuid,timestamptz) to authenticated;

create or replace function public.ks_next_invoice_number(
  p_company_id uuid,
  p_document_type text,
  p_sold_at timestamptz default now()
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.ks_next_invoice_number(p_company_id,p_document_type,p_sold_at);
$$;

revoke all on function public.ks_next_invoice_number(uuid,text,timestamptz) from public,anon;
grant execute on function public.ks_next_invoice_number(uuid,text,timestamptz) to authenticated;
