-- KanawaSoft 1.0: ERP expansion + server-only integration vault.
-- Apply ONLY to the isolated project mhaynctedpyqjxdhdisv.
create extension if not exists pgcrypto;

-- Operational ERP tables (company-scoped). Existing core tables are not replaced.
create table if not exists public.ks_warehouses (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 code text not null, name text not null, address text, is_default boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,code)
);
create table if not exists public.ks_stock_movements (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 product_id uuid references public.ks_products(id) on delete set null, warehouse_id uuid references public.ks_warehouses(id) on delete set null,
 movement_type text not null check(movement_type in ('in','out','transfer','adjustment','return')),
 quantity numeric(18,3) not null check(quantity > 0), unit_cost numeric(18,2) not null default 0,
 reference text, notes text, occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.ks_purchase_orders (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 supplier_name text not null, document_number text, status text not null default 'draft',
 subtotal numeric(18,2) not null default 0, tax_total numeric(18,2) not null default 0, total numeric(18,2) not null default 0,
 ordered_at timestamptz, expected_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_purchase_items (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 purchase_order_id uuid not null references public.ks_purchase_orders(id) on delete cascade,
 product_id uuid references public.ks_products(id) on delete set null, description text not null,
 quantity numeric(18,3) not null check(quantity > 0), unit_cost numeric(18,2) not null default 0,
 line_total numeric(18,2) not null default 0
);
create table if not exists public.ks_suppliers (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, tax_id text, email text, phone text, address text, payment_terms text,
 status text not null default 'active', metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_customers (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, tax_id text, email text, phone text, address text, customer_type text default 'individual',
 credit_limit numeric(18,2) not null default 0, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_customer_addresses (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 customer_id uuid not null references public.ks_customers(id) on delete cascade,
 label text, address text not null, latitude numeric(10,7), longitude numeric(10,7), is_default boolean not null default false
);
create table if not exists public.ks_quotations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 quotation_number text not null, customer_id uuid references public.ks_customers(id) on delete set null,
 status text not null default 'draft', valid_until date, subtotal numeric(18,2) not null default 0,
 discount numeric(18,2) not null default 0, tax_total numeric(18,2) not null default 0,
 total numeric(18,2) not null default 0, notes text, created_at timestamptz not null default now(), unique(company_id,quotation_number)
);
create table if not exists public.ks_quotation_items (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 quotation_id uuid not null references public.ks_quotations(id) on delete cascade,
 product_id uuid references public.ks_products(id) on delete set null, description text not null,
 quantity numeric(18,3) not null default 1, unit_price numeric(18,2) not null default 0, line_total numeric(18,2) not null default 0
);
create table if not exists public.ks_sales_returns (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 sale_id uuid references public.ks_sales(id) on delete set null, reason text, status text not null default 'requested',
 refund_amount numeric(18,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.ks_payment_transactions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 sale_id uuid references public.ks_sales(id) on delete set null, provider text, provider_reference text,
 amount numeric(18,2) not null, currency_code text not null default 'AOA',
 status text not null default 'pending', paid_at timestamptz, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_expenses (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 category text not null, description text, amount numeric(18,2) not null check(amount >= 0),
 currency_code text not null default 'AOA', expense_date date not null default current_date,
 payment_method text, attachment_path text, created_at timestamptz not null default now()
);
create table if not exists public.ks_chart_of_accounts (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 account_code text not null, name text not null, account_type text not null, parent_id uuid references public.ks_chart_of_accounts(id),
 is_active boolean not null default true, unique(company_id,account_code)
);
create table if not exists public.ks_journal_entries (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 entry_number text not null, entry_date date not null default current_date, description text,
 source_type text, source_id uuid, status text not null default 'draft', created_at timestamptz not null default now(),
 unique(company_id,entry_number)
);
create table if not exists public.ks_journal_lines (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 journal_entry_id uuid not null references public.ks_journal_entries(id) on delete cascade,
 account_id uuid not null references public.ks_chart_of_accounts(id), debit numeric(18,2) not null default 0,
 credit numeric(18,2) not null default 0, check(debit >= 0 and credit >= 0)
);
create table if not exists public.ks_bank_accounts (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 bank_name text not null, account_name text, iban_last4 text, currency_code text not null default 'AOA',
 opening_balance numeric(18,2) not null default 0, status text not null default 'active'
);
create table if not exists public.ks_bank_reconciliations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 bank_account_id uuid not null references public.ks_bank_accounts(id) on delete cascade,
 period_start date not null, period_end date not null, statement_balance numeric(18,2) not null,
 reconciled_balance numeric(18,2), status text not null default 'open', created_at timestamptz not null default now()
);
create table if not exists public.ks_employees (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 employee_number text not null, full_name text not null, email text, phone text, tax_id text,
 department text, job_title text, hire_date date, employment_status text not null default 'active',
 salary_amount numeric(18,2), created_at timestamptz not null default now(), unique(company_id,employee_number)
);
create table if not exists public.ks_attendance (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 employee_id uuid not null references public.ks_employees(id) on delete cascade,
 clock_in timestamptz, clock_out timestamptz, source text default 'manual', notes text, created_at timestamptz not null default now()
);
create table if not exists public.ks_payroll_runs (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 period_start date not null, period_end date not null, status text not null default 'draft',
 gross_total numeric(18,2) not null default 0, deductions_total numeric(18,2) not null default 0,
 net_total numeric(18,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.ks_payroll_items (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 payroll_run_id uuid not null references public.ks_payroll_runs(id) on delete cascade,
 employee_id uuid not null references public.ks_employees(id), gross_pay numeric(18,2) not null default 0,
 irt numeric(18,2) not null default 0, social_security numeric(18,2) not null default 0, net_pay numeric(18,2) not null default 0
);
create table if not exists public.ks_projects (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 project_code text, name text not null, client_id uuid references public.ks_customers(id), status text not null default 'planned',
 starts_on date, due_on date, budget numeric(18,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.ks_project_tasks (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 project_id uuid not null references public.ks_projects(id) on delete cascade, title text not null,
 status text not null default 'todo', assigned_to uuid references public.ks_employees(id), due_at timestamptz,
 priority text not null default 'normal', created_at timestamptz not null default now()
);
create table if not exists public.ks_service_orders (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 order_number text not null, customer_id uuid references public.ks_customers(id), title text not null,
 description text, status text not null default 'open', assigned_to uuid references public.ks_employees(id),
 scheduled_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), unique(company_id,order_number)
);
create table if not exists public.ks_assets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 asset_code text not null, name text not null, category text, purchase_date date, purchase_cost numeric(18,2) not null default 0,
 useful_life_months integer, residual_value numeric(18,2) not null default 0, status text not null default 'active',
 unique(company_id,asset_code)
);
create table if not exists public.ks_maintenance_orders (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 asset_id uuid references public.ks_assets(id) on delete set null, order_number text not null,
 maintenance_type text not null default 'preventive', description text, status text not null default 'planned',
 planned_at timestamptz, completed_at timestamptz, cost numeric(18,2) not null default 0, unique(company_id,order_number)
);
create table if not exists public.ks_vehicles (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 registration text not null, make text, model text, year integer, driver_name text, status text not null default 'active',
 unique(company_id,registration)
);
create table if not exists public.ks_delivery_routes (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 route_code text, origin jsonb not null default '{}'::jsonb, destination jsonb not null default '{}'::jsonb,
 stops jsonb not null default '[]'::jsonb, assigned_driver uuid references public.ks_employees(id),
 status text not null default 'planned', planned_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.ks_delivery_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 route_id uuid not null references public.ks_delivery_routes(id) on delete cascade, event_type text not null,
 latitude numeric(10,7), longitude numeric(10,7), note text, occurred_at timestamptz not null default now()
);
create table if not exists public.ks_ecommerce_stores (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 store_name text not null, domain text, platform text not null default 'kanawa',
 status text not null default 'draft', settings jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.ks_ecommerce_orders (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 store_id uuid references public.ks_ecommerce_stores(id) on delete set null, order_number text not null,
 customer jsonb not null default '{}'::jsonb, items jsonb not null default '[]'::jsonb,
 subtotal numeric(18,2) not null default 0, shipping_total numeric(18,2) not null default 0,
 total numeric(18,2) not null default 0, status text not null default 'pending',
 created_at timestamptz not null default now(), unique(company_id,order_number)
);
create table if not exists public.ks_ecommerce_webhooks (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 store_id uuid references public.ks_ecommerce_stores(id) on delete cascade, endpoint text not null,
 event_name text not null, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.ks_marketing_leads (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 full_name text, email text, phone text, source text, stage text not null default 'new',
 score integer not null default 0, assigned_to uuid references public.ks_employees(id),
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.ks_marketing_campaigns (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, channel text not null, objective text, status text not null default 'draft',
 budget numeric(18,2) not null default 0, starts_at timestamptz, ends_at timestamptz,
 external_campaign_id text, metrics jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.ks_marketing_messages (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 channel text not null, direction text not null check(direction in ('inbound','outbound')),
 contact_ref text, template_name text, body text, external_message_id text,
 delivery_status text not null default 'queued', sent_at timestamptz, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_marketing_segments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, criteria jsonb not null default '{}'::jsonb, estimated_size integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_marketing_templates (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 channel text not null, name text not null, content text not null, variables jsonb not null default '[]'::jsonb,
 status text not null default 'draft', created_at timestamptz not null default now()
);
create table if not exists public.ks_support_tickets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 ticket_number text not null, subject text not null, description text, priority text not null default 'normal',
 status text not null default 'open', requester text, assigned_to uuid references public.ks_employees(id),
 created_at timestamptz not null default now(), unique(company_id,ticket_number)
);
create table if not exists public.ks_knowledge_articles (
 id uuid primary key default gen_random_uuid(), company_id uuid references public.ks_companies(id) on delete cascade,
 module_key text not null, title text not null, body_md text not null, audience text not null default 'all',
 published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.ks_automation_rules (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, trigger_event text not null, conditions jsonb not null default '{}'::jsonb,
 actions jsonb not null default '[]'::jsonb, is_enabled boolean not null default false,
 last_run_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.ks_audit_events (
 id uuid primary key default gen_random_uuid(), company_id uuid references public.ks_companies(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null, action text not null,
 resource_type text, resource_id text, ip_hash text, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_connector_registry (
 id uuid primary key default gen_random_uuid(), company_id uuid references public.ks_companies(id) on delete cascade,
 connector_key text not null, display_name text not null, direction text not null check(direction in ('inbound','outbound','bidirectional')),
 endpoint_url text, auth_mode text not null default 'none', status text not null default 'draft',
 config jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(company_id,connector_key)
);
create table if not exists public.ks_connector_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 connector_id uuid references public.ks_connector_registry(id) on delete cascade, event_key text not null,
 payload jsonb not null default '{}'::jsonb, processing_status text not null default 'pending',
 attempts integer not null default 0, last_error text, created_at timestamptz not null default now()
);

-- Sensitive credentials are ciphertext only. No authenticated-user policy is created.
create table if not exists public.ks_company_integration_secrets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 provider text not null check(provider in ('meta','whatsapp','facebook','instagram','google','custom')),
 credential_ciphertext text not null, key_version text not null default 'v1',
 last_four text, scopes text[] not null default '{}', status text not null default 'configured',
 rotated_at timestamptz not null default now(), created_at timestamptz not null default now(),
 unique(company_id,provider)
);
alter table public.ks_company_integration_secrets enable row level security;
revoke all on public.ks_company_integration_secrets from anon, authenticated;
grant all on public.ks_company_integration_secrets to service_role;

-- API keys for external e-commerce clients: only a one-way digest is stored.
create table if not exists public.ks_ecommerce_api_keys (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 key_prefix text not null, key_hash text not null unique, label text not null,
 scopes text[] not null default array['catalog:read','orders:write'], status text not null default 'active',
 last_used_at timestamptz, expires_at timestamptz, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), revoked_at timestamptz
);
alter table public.ks_ecommerce_api_keys enable row level security;
revoke all on public.ks_ecommerce_api_keys from anon, authenticated;
grant all on public.ks_ecommerce_api_keys to service_role;

-- RLS on all new company-owned business tables. Secrets and API keys stay service-role only.
do $$
declare t text;
begin
 foreach t in array array[
 'ks_warehouses','ks_stock_movements','ks_purchase_orders','ks_purchase_items','ks_suppliers',
 'ks_customers','ks_customer_addresses','ks_quotations','ks_quotation_items','ks_sales_returns',
 'ks_payment_transactions','ks_expenses','ks_chart_of_accounts','ks_journal_entries','ks_journal_lines',
 'ks_bank_accounts','ks_bank_reconciliations','ks_employees','ks_attendance','ks_payroll_runs','ks_payroll_items',
 'ks_projects','ks_project_tasks','ks_service_orders','ks_assets','ks_maintenance_orders','ks_vehicles',
 'ks_delivery_routes','ks_delivery_events','ks_ecommerce_stores','ks_ecommerce_orders','ks_ecommerce_webhooks',
 'ks_marketing_leads','ks_marketing_campaigns','ks_marketing_messages','ks_marketing_segments','ks_marketing_templates',
 'ks_support_tickets','ks_automation_rules','ks_connector_registry','ks_connector_events'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I on public.%I for select to authenticated using (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''cashier'',''operator'',''gerente'',''caixa'',''operador'']::text[]))',t||'_tenant_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'']::text[]))',t||'_tenant_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'']::text[])) with check (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'']::text[]))',t||'_tenant_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (private.ks_has_company_role(company_id,array[''owner'',''admin'']::text[]))',t||'_tenant_delete',t);
 end loop;
end $$;

create index if not exists ks_stock_company_product_idx on public.ks_stock_movements(company_id,product_id,occurred_at desc);
create index if not exists ks_leads_company_stage_idx on public.ks_marketing_leads(company_id,stage,created_at desc);
create index if not exists ks_messages_company_channel_idx on public.ks_marketing_messages(company_id,channel,created_at desc);
create index if not exists ks_ecommerce_orders_company_status_idx on public.ks_ecommerce_orders(company_id,status,created_at desc);
create index if not exists ks_audit_events_company_created_idx on public.ks_audit_events(company_id,created_at desc);
