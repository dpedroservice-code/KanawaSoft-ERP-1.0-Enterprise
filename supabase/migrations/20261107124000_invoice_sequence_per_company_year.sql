-- Sequential invoice numbering per company and fiscal year.
-- The private counter is updated atomically; concurrent tills cannot issue the same number.
create table if not exists private.ks_invoice_sequences (
  company_id uuid not null references public.ks_companies(id) on delete cascade,
  fiscal_year integer not null,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (company_id, fiscal_year)
);
revoke all on table private.ks_invoice_sequences from public, anon, authenticated;

create or replace function private.ks_next_invoice_number(
  p_company_id uuid,
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
begin
  if not private.ks_has_company_role(
    p_company_id,
    array['owner','admin','manager','gerente','cashier','caixa']::text[]
  ) then
    raise exception 'Sem permissão para emitir documentos nesta empresa';
  end if;

  v_year := extract(year from coalesce(p_sold_at, now()))::integer;
  insert into private.ks_invoice_sequences(company_id, fiscal_year, last_number)
  values (p_company_id, v_year, 1)
  on conflict (company_id, fiscal_year)
  do update set
    last_number = private.ks_invoice_sequences.last_number + 1,
    updated_at = now()
  returning last_number into v_number;

  return 'FT-' || v_year::text || '-' || lpad(v_number::text, 6, '0');
end;
$$;
revoke all on function private.ks_next_invoice_number(uuid,timestamptz) from public, anon, authenticated;
grant execute on function private.ks_next_invoice_number(uuid,timestamptz) to authenticated;

create or replace function public.ks_next_invoice_number(
  p_company_id uuid,
  p_sold_at timestamptz default now()
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.ks_next_invoice_number(p_company_id,p_sold_at);
$$;
revoke all on function public.ks_next_invoice_number(uuid,timestamptz) from public, anon;
grant execute on function public.ks_next_invoice_number(uuid,timestamptz) to authenticated;
