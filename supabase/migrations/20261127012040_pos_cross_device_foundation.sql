-- Kanawa Soft POS cross-device foundation.
-- Additive only: preserves all existing rows and tables.
begin;

alter table public.ks_products
  add column if not exists barcode text,
  add column if not exists scale_plu text,
  add column if not exists uses_scale boolean not null default false;

create index if not exists ks_products_company_barcode_idx
  on public.ks_products (company_id, barcode)
  where barcode is not null and btrim(barcode) <> '';

create table if not exists public.ks_pos_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ks_companies(id) on delete cascade,
  device_key uuid not null,
  label text not null,
  platform text not null default 'web',
  printer_name text,
  printer_connection text,
  capabilities jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ks_pos_devices_platform_check check (platform in ('web','desktop','android_pos','mobile')),
  constraint ks_pos_devices_company_device_unique unique (company_id, device_key)
);

create index if not exists ks_pos_devices_company_active_idx
  on public.ks_pos_devices (company_id, is_active);

create table if not exists public.ks_pos_sale_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ks_companies(id) on delete cascade,
  draft_uuid uuid not null,
  cash_session_id uuid,
  source_device_id uuid,
  sale_id uuid,
  customer_id uuid,
  customer_snapshot jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0,
  discount_value numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency_code text not null default 'AOA',
  status text not null default 'suspended',
  notes text,
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint ks_pos_sale_drafts_status_check check (status in ('suspended','resumed','paid','cancelled')),
  constraint ks_pos_sale_drafts_amounts_check check (subtotal >= 0 and discount_value >= 0 and tax_amount >= 0 and total >= 0),
  constraint ks_pos_sale_drafts_company_uuid_unique unique (company_id, draft_uuid)
);

create index if not exists ks_pos_sale_drafts_company_status_updated_idx
  on public.ks_pos_sale_drafts (company_id, status, updated_at desc);
create index if not exists ks_pos_sale_drafts_cash_session_idx
  on public.ks_pos_sale_drafts (cash_session_id) where cash_session_id is not null;

create table if not exists public.ks_cash_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ks_companies(id) on delete cascade,
  cash_session_id uuid not null references public.ks_cash_sessions(id) on delete restrict,
  movement_type text not null,
  amount numeric(14,2) not null,
  reason text not null,
  reference text,
  idempotency_key uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint ks_cash_movements_type_check check (movement_type in ('sangria','suprimento')),
  constraint ks_cash_movements_amount_check check (amount > 0),
  constraint ks_cash_movements_company_idempotency_unique unique (company_id, idempotency_key)
);

create index if not exists ks_cash_movements_session_created_idx
  on public.ks_cash_movements (cash_session_id, created_at desc);

alter table public.ks_pos_devices enable row level security;
alter table public.ks_pos_sale_drafts enable row level security;
alter table public.ks_cash_movements enable row level security;

drop policy if exists ks_pos_devices_select on public.ks_pos_devices;
create policy ks_pos_devices_select on public.ks_pos_devices
  for select to authenticated
  using (private.ks_has_company_role(company_id, array['owner','admin','manager','gerente']));
drop policy if exists ks_pos_devices_insert on public.ks_pos_devices;
create policy ks_pos_devices_insert on public.ks_pos_devices
  for insert to authenticated
  with check (private.ks_has_company_role(company_id, array['owner','admin','manager','gerente']));
drop policy if exists ks_pos_devices_update on public.ks_pos_devices;
create policy ks_pos_devices_update on public.ks_pos_devices
  for update to authenticated
  using (private.ks_has_company_role(company_id, array['owner','admin','manager','gerente']))
  with check (private.ks_has_company_role(company_id, array['owner','admin','manager','gerente']));

drop policy if exists ks_pos_sale_drafts_select on public.ks_pos_sale_drafts;
create policy ks_pos_sale_drafts_select on public.ks_pos_sale_drafts
  for select to authenticated
  using (private.ks_has_company_permission(company_id, 'vendas', 'ver'));
drop policy if exists ks_pos_sale_drafts_insert on public.ks_pos_sale_drafts;
create policy ks_pos_sale_drafts_insert on public.ks_pos_sale_drafts
  for insert to authenticated
  with check (
    private.ks_has_company_permission(company_id, 'vendas', 'criar')
    and (cash_session_id is null or exists (select 1 from public.ks_cash_sessions s where s.id = cash_session_id and s.company_id = ks_pos_sale_drafts.company_id))
    and (source_device_id is null or exists (select 1 from public.ks_pos_devices d where d.id = source_device_id and d.company_id = ks_pos_sale_drafts.company_id))
    and (sale_id is null or exists (select 1 from public.ks_sales s where s.id = sale_id and s.company_id = ks_pos_sale_drafts.company_id))
    and (customer_id is null or exists (select 1 from public.ks_customers c where c.id = customer_id and c.company_id = ks_pos_sale_drafts.company_id))
  );
drop policy if exists ks_pos_sale_drafts_update on public.ks_pos_sale_drafts;
create policy ks_pos_sale_drafts_update on public.ks_pos_sale_drafts
  for update to authenticated
  using (private.ks_has_company_permission(company_id, 'vendas', 'editar'))
  with check (
    private.ks_has_company_permission(company_id, 'vendas', 'editar')
    and (cash_session_id is null or exists (select 1 from public.ks_cash_sessions s where s.id = cash_session_id and s.company_id = ks_pos_sale_drafts.company_id))
    and (source_device_id is null or exists (select 1 from public.ks_pos_devices d where d.id = source_device_id and d.company_id = ks_pos_sale_drafts.company_id))
    and (sale_id is null or exists (select 1 from public.ks_sales s where s.id = sale_id and s.company_id = ks_pos_sale_drafts.company_id))
    and (customer_id is null or exists (select 1 from public.ks_customers c where c.id = customer_id and c.company_id = ks_pos_sale_drafts.company_id))
  );

drop policy if exists ks_cash_movements_select on public.ks_cash_movements;
create policy ks_cash_movements_select on public.ks_cash_movements
  for select to authenticated
  using (private.ks_has_company_role(company_id, array['owner','admin','manager','gerente','cashier','caixa']));
drop policy if exists ks_cash_movements_insert on public.ks_cash_movements;
create policy ks_cash_movements_insert on public.ks_cash_movements
  for insert to authenticated
  with check (
    private.ks_has_company_role(company_id, array['owner','admin','manager','gerente','cashier','caixa'])
    and exists (
      select 1 from public.ks_cash_sessions s
      where s.id = cash_session_id and s.company_id = ks_cash_movements.company_id and s.status = 'open'
    )
  );

grant select, insert, update on public.ks_pos_devices to authenticated;
grant select, insert, update on public.ks_pos_sale_drafts to authenticated;
grant select, insert on public.ks_cash_movements to authenticated;

commit;
