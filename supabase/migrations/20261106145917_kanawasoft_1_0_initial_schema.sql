-- KanawaSoft 1.0 — initial isolated Supabase schema.
-- Target project: kanawasoft-1-0-isolated. Never run against the legacy APP project.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.ks_companies (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 legal_name text not null, trade_name text, tax_id text, phone text, email text,
 country_code text not null default 'AO', currency_code text not null default 'AOA',
 tax_regime text not null default 'not_configured',
 status text not null default 'active' check(status in ('active','suspended','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text, phone text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_company_memberships (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'owner' check(role in ('owner','admin','manager','cashier','operator','gerente','caixa','operador')),
 status text not null default 'active' check(status in ('active','invited','suspended')),
 created_at timestamptz not null default now(), unique(company_id,user_id)
);
create table if not exists public.ks_platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'admin', created_at timestamptz not null default now()
);
create table if not exists public.ks_company_branches (
 id uuid primary key default gen_random_uuid(),
 parent_company_id uuid not null references public.ks_companies(id) on delete cascade,
 branch_company_id uuid not null references public.ks_companies(id) on delete cascade,
 status text not null default 'active', created_at timestamptz not null default now(),
 check(parent_company_id <> branch_company_id), unique(parent_company_id,branch_company_id)
);
create table if not exists public.ks_records (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 store_key text not null, record_id text not null, payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,store_key,record_id)
);
create table if not exists public.ks_products (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 external_id text not null, sku text, name text not null, category text, unit text not null default 'UN',
 unit_price numeric(18,2) not null default 0 check(unit_price >= 0),
 stock_quantity numeric(18,3) not null default 0 check(stock_quantity >= 0),
 min_stock numeric(18,3) not null default 0 check(min_stock >= 0),
 description text, image_path text, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,external_id), unique(company_id,sku)
);
create table if not exists public.ks_saas_plans (
 id uuid primary key default gen_random_uuid(), plan_code text not null unique, name text not null,
 price numeric(18,2) not null default 0, currency_code text not null default 'AOA',
 max_users integer not null default 1, max_installations integer not null default 1, max_records integer,
 features jsonb not null default '{}'::jsonb, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_company_licenses (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 plan_code text not null default 'trial', license_key text not null default encode(gen_random_bytes(18),'hex') unique,
 status text not null default 'trial' check(status in ('trial','active','expired','suspended','cancelled')),
 starts_at timestamptz not null default now(), expires_at timestamptz, grace_until timestamptz,
 max_users_override integer, max_installations_override integer, created_at timestamptz not null default now()
);
create table if not exists public.ks_installations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 installation_key text not null, user_id uuid not null references auth.users(id) on delete cascade,
 device_name text, platform text, app_version text, install_status text not null default 'active',
 last_seen_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), unique(company_id,installation_key)
);
create table if not exists public.ks_license_usage_daily (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 usage_date date not null default current_date, users_count integer not null default 0,
 installations_count integer not null default 0, invoices_count integer not null default 0,
 created_at timestamptz not null default now(), unique(company_id,usage_date)
);
create table if not exists public.ks_exchange_rates (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 base_currency text not null default 'AOA', quote_currency text not null,
 rate numeric(24,10) not null check(rate > 0), effective_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table if not exists public.ks_tax_rules (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 code text not null, label text not null, rate numeric(8,4) not null default 0,
 is_active boolean not null default true, created_at timestamptz not null default now(), unique(company_id,code)
);
create table if not exists public.ks_demo_requests (
 id uuid primary key default gen_random_uuid(), company_name text not null, contact_name text not null,
 email text not null, phone text, country_code text not null default 'AO', preferred_plan text,
 requested_modules jsonb not null default '[]'::jsonb, source text not null default 'kanawa_site',
 created_at timestamptz not null default now()
);
create table if not exists public.ks_sales (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 external_id text not null, invoice_number text not null, customer_name text, customer_tax_id text,
 customer_phone text, subtotal numeric(18,2) not null default 0, discount_value numeric(18,2) not null default 0,
 tax_amount numeric(18,2) not null default 0, total numeric(18,2) not null default 0,
 amount_received numeric(18,2) not null default 0, change_amount numeric(18,2) not null default 0,
 payment_method text, tax_regime text, status text not null default 'finalizada', notes text,
 operator_name text, sold_at timestamptz not null default now(), created_at timestamptz not null default now(),
 unique(company_id,external_id)
);
create table if not exists public.ks_sale_items (
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.ks_sales(id) on delete cascade,
 company_id uuid not null references public.ks_companies(id) on delete cascade,
 product_external_id text not null, product_name text not null,
 quantity numeric(18,3) not null check(quantity > 0), unit_price numeric(18,2) not null default 0,
 line_total numeric(18,2) not null default 0, stock_tracked boolean not null default true
);

create index if not exists ks_memberships_user_status_idx on public.ks_company_memberships(user_id,status);
create index if not exists ks_records_company_store_idx on public.ks_records(company_id,store_key);
create index if not exists ks_licenses_company_created_idx on public.ks_company_licenses(company_id,created_at desc);

create or replace function private.ks_is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.ks_platform_admins a where a.user_id=(select auth.uid()));
$$;
create or replace function private.ks_has_company_role(p_company_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.ks_company_memberships m where m.company_id=p_company_id
 and m.user_id=(select auth.uid()) and m.status='active' and m.role=any(p_roles));
$$;
create or replace function private.ks_has_company_permission(p_company_id uuid,p_module text,p_action text)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.ks_has_company_role(p_company_id,array['owner','admin','manager','cashier','operator','gerente','caixa','operador']::text[]);
$$;

create or replace function public.ks_sync_product(p_company_id uuid,p_product jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente']::text[]) then
  raise exception 'Sem permissão para sincronizar produtos';
 end if;
 insert into public.ks_products(company_id,external_id,sku,name,category,unit,unit_price,stock_quantity,min_stock,description,image_path,is_active,updated_at)
 values(p_company_id,p_product->>'external_id',nullif(p_product->>'sku',''),
 coalesce(nullif(p_product->>'name',''),'Produto'),p_product->>'category',
 coalesce(nullif(p_product->>'unit',''),'UN'),greatest(coalesce((p_product->>'unit_price')::numeric,0),0),
 greatest(coalesce((p_product->>'stock_quantity')::numeric,0),0),greatest(coalesce((p_product->>'min_stock')::numeric,0),0),
 p_product->>'description',p_product->>'image_path',coalesce((p_product->>'is_active')::boolean,true),now())
 on conflict(company_id,external_id) do update set sku=excluded.sku,name=excluded.name,category=excluded.category,
 unit=excluded.unit,unit_price=excluded.unit_price,min_stock=excluded.min_stock,description=excluded.description,
 image_path=excluded.image_path,is_active=excluded.is_active,updated_at=now()
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.ks_finalize_sale(p_company_id uuid,p_sale jsonb,p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sale_id uuid; v_item jsonb; v_product public.ks_products%rowtype; v_qty numeric;
begin
 if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente','cashier','caixa']::text[]) then
  raise exception 'Sem permissão para finalizar vendas';
 end if;
 insert into public.ks_sales(company_id,external_id,invoice_number,customer_name,customer_tax_id,customer_phone,subtotal,discount_value,tax_amount,total,amount_received,change_amount,payment_method,tax_regime,status,notes,operator_name,sold_at)
 values(p_company_id,p_sale->>'external_id',coalesce(p_sale->>'invoice_number','FT'),p_sale->>'customer_name',p_sale->>'customer_tax_id',p_sale->>'customer_phone',
 coalesce((p_sale->>'subtotal')::numeric,0),coalesce((p_sale->>'discount_value')::numeric,0),coalesce((p_sale->>'tax_amount')::numeric,0),coalesce((p_sale->>'total')::numeric,0),
 coalesce((p_sale->>'amount_received')::numeric,0),coalesce((p_sale->>'change_amount')::numeric,0),p_sale->>'payment_method',p_sale->>'tax_regime','finalizada',p_sale->>'notes',p_sale->>'operator_name',coalesce((p_sale->>'sold_at')::timestamptz,now()))
 on conflict(company_id,external_id) do update set external_id=excluded.external_id returning id into v_sale_id;
 if exists(select 1 from public.ks_sale_items where sale_id=v_sale_id) then return v_sale_id; end if;
 for v_item in select * from jsonb_array_elements(p_items) loop
  v_qty := (v_item->>'quantity')::numeric;
  if coalesce((v_item->>'stock_tracked')::boolean,true) then
   select * into v_product from public.ks_products where company_id=p_company_id and external_id=v_item->>'product_external_id' for update;
   if not found then raise exception 'Produto não encontrado: %',v_item->>'product_external_id'; end if;
   if v_product.stock_quantity < v_qty then raise exception 'Stock insuficiente para % (disponível %, solicitado %)',v_product.name,v_product.stock_quantity,v_qty; end if;
   update public.ks_products set stock_quantity=stock_quantity-v_qty,updated_at=now() where id=v_product.id;
  end if;
  insert into public.ks_sale_items(sale_id,company_id,product_external_id,product_name,quantity,unit_price,line_total,stock_tracked)
  values(v_sale_id,p_company_id,v_item->>'product_external_id',coalesce(v_item->>'product_name','Artigo'),v_qty,
  coalesce((v_item->>'unit_price')::numeric,0),coalesce((v_item->>'line_total')::numeric,0),coalesce((v_item->>'stock_tracked')::boolean,true));
 end loop;
 insert into public.ks_license_usage_daily(company_id,usage_date,invoices_count) values(p_company_id,current_date,1)
 on conflict(company_id,usage_date) do update set invoices_count=public.ks_license_usage_daily.invoices_count+1;
 return v_sale_id;
end $$;

create or replace function public.ks_get_company_entitlements(p_company_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'company_id',p_company_id,
  'license',(select to_jsonb(l) from public.ks_company_licenses l where l.company_id=p_company_id order by l.created_at desc limit 1),
  'plan',(select to_jsonb(p) from public.ks_saas_plans p join public.ks_company_licenses l on l.plan_code=p.plan_code where l.company_id=p_company_id order by l.created_at desc limit 1)
 );
$$;

create or replace function public.ks_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_company_id uuid; v_meta jsonb;
begin
 v_meta:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
 insert into public.ks_profiles(user_id,full_name,phone) values(new.id,v_meta->>'full_name',nullif(v_meta->>'phone',''))
 on conflict(user_id) do update set full_name=excluded.full_name,phone=excluded.phone,updated_at=now();
 insert into public.ks_companies(owner_user_id,legal_name,trade_name,tax_id,phone,email,country_code,currency_code,tax_regime)
 values(new.id,coalesce(nullif(v_meta->>'company_legal_name',''),'Empresa'),coalesce(nullif(v_meta->>'company_trade_name',''),'Empresa'),
 v_meta->>'company_tax_id',nullif(v_meta->>'phone',''),new.email,coalesce(v_meta->>'country_code','AO'),coalesce(v_meta->>'currency_code','AOA'),coalesce(v_meta->>'tax_regime','not_configured'))
 returning id into v_company_id;
 insert into public.ks_company_memberships(company_id,user_id,role,status) values(v_company_id,new.id,'owner','active');
 insert into public.ks_company_licenses(company_id,plan_code,status,starts_at,expires_at) values(v_company_id,'trial','trial',now(),now()+interval '14 days');
 return new;
end $$;
drop trigger if exists ks_auth_user_onboard on auth.users;
create trigger ks_auth_user_onboard after insert on auth.users for each row execute procedure public.ks_handle_new_user();

alter table public.ks_companies enable row level security;
alter table public.ks_profiles enable row level security;
alter table public.ks_company_memberships enable row level security;
alter table public.ks_platform_admins enable row level security;
alter table public.ks_company_branches enable row level security;
alter table public.ks_records enable row level security;
alter table public.ks_products enable row level security;
alter table public.ks_saas_plans enable row level security;
alter table public.ks_company_licenses enable row level security;
alter table public.ks_installations enable row level security;
alter table public.ks_license_usage_daily enable row level security;
alter table public.ks_exchange_rates enable row level security;
alter table public.ks_tax_rules enable row level security;
alter table public.ks_demo_requests enable row level security;
alter table public.ks_sales enable row level security;
alter table public.ks_sale_items enable row level security;

create policy ks_companies_select_member on public.ks_companies for select to authenticated
using(owner_user_id=(select auth.uid()) or exists(select 1 from public.ks_company_memberships m where m.company_id=id and m.user_id=(select auth.uid()) and m.status='active'));
create policy ks_companies_update_admin on public.ks_companies for update to authenticated
using(private.ks_has_company_role(id,array['owner','admin']::text[])) with check(private.ks_has_company_role(id,array['owner','admin']::text[]));
create policy ks_profiles_self on public.ks_profiles for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy ks_memberships_read_self on public.ks_company_memberships for select to authenticated
using(user_id=(select auth.uid()) or private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_memberships_admin_write on public.ks_company_memberships for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_platform_admin_self on public.ks_platform_admins for select to authenticated using(user_id=(select auth.uid()));
create policy ks_branches_member on public.ks_company_branches for select to authenticated
using(private.ks_has_company_role(parent_company_id,array['owner','admin','manager','gerente']::text[]) or private.ks_has_company_role(branch_company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_records_member on public.ks_records for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]));
create policy ks_products_member on public.ks_products for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]));
create policy ks_licenses_member_read on public.ks_company_licenses for select to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_installations_member on public.ks_installations for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]));
create policy ks_usage_member_read on public.ks_license_usage_daily for select to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_exchange_rates_member on public.ks_exchange_rates for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_tax_rules_member on public.ks_tax_rules for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_plans_public_read on public.ks_saas_plans for select to anon,authenticated using(is_active);
create policy ks_sales_member on public.ks_sales for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa']::text[]));
create policy ks_sale_items_member on public.ks_sale_items for all to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa']::text[]));
create policy ks_demo_requests_public_insert on public.ks_demo_requests for insert to anon,authenticated with check(true);

grant usage on schema public to anon,authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant select on public.ks_saas_plans to anon,authenticated;
grant insert on public.ks_demo_requests to anon,authenticated;
revoke all on function public.ks_handle_new_user() from public,anon,authenticated;
revoke all on function public.ks_sync_product(uuid,jsonb) from public,anon;
revoke all on function public.ks_finalize_sale(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.ks_get_company_entitlements(uuid) from public,anon;
grant execute on function public.ks_sync_product(uuid,jsonb) to authenticated;
grant execute on function public.ks_finalize_sale(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.ks_get_company_entitlements(uuid) to authenticated;
grant execute on function private.ks_is_platform_admin() to authenticated;
grant execute on function private.ks_has_company_role(uuid,text[]) to authenticated;
grant execute on function private.ks_has_company_permission(uuid,text,text) to authenticated;
insert into public.ks_saas_plans(plan_code,name,price,currency_code,max_users,max_installations,features)
values('trial','Avaliação 14 dias',0,'AOA',3,2,'{"all_modules":true}'::jsonb) on conflict(plan_code) do nothing;
