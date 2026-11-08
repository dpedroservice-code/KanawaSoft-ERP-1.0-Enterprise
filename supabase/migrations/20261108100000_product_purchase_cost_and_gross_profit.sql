-- Kanawa Soft ERP 1.0: purchase cost and auditable gross profit snapshots.
-- Existing prices and records are preserved; legacy sales without a cost snapshot remain unclassified.

alter table public.ks_products
  add column if not exists purchase_cost numeric(18,2) not null default 0
  check (purchase_cost >= 0);

alter table public.ks_sales
  add column if not exists cost_of_goods numeric(18,2),
  add column if not exists gross_profit numeric(18,2);

alter table public.ks_sale_items
  add column if not exists unit_cost numeric(18,2),
  add column if not exists line_profit numeric(18,2);

create or replace function public.ks_sync_product(p_company_id uuid,p_product jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente']::text[]) then
  raise exception 'Sem permissão para sincronizar produtos';
 end if;
 insert into public.ks_products(
  company_id,external_id,sku,name,category,unit,unit_price,purchase_cost,
  stock_quantity,min_stock,description,image_path,is_active,updated_at
 )
 values(
  p_company_id,p_product->>'external_id',nullif(p_product->>'sku',''),
  coalesce(nullif(p_product->>'name',''),'Produto'),p_product->>'category',
  coalesce(nullif(p_product->>'unit',''),'UN'),
  greatest(coalesce((p_product->>'unit_price')::numeric,0),0),
  greatest(coalesce((p_product->>'purchase_cost')::numeric,0),0),
  greatest(coalesce((p_product->>'stock_quantity')::numeric,0),0),
  greatest(coalesce((p_product->>'min_stock')::numeric,0),0),
  p_product->>'description',p_product->>'image_path',
  coalesce((p_product->>'is_active')::boolean,true),now()
 )
 on conflict(company_id,external_id) do update set
  sku=excluded.sku,name=excluded.name,category=excluded.category,unit=excluded.unit,
  unit_price=excluded.unit_price,purchase_cost=excluded.purchase_cost,
  min_stock=excluded.min_stock,description=excluded.description,
  image_path=excluded.image_path,is_active=excluded.is_active,updated_at=now()
 returning id into v_id;
 return v_id;
end $$;

create or replace function private.ks_capture_sale_item_cost()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cost numeric(18,2);
begin
 select p.purchase_cost into v_cost
 from public.ks_products p
 where p.company_id=new.company_id
   and p.external_id=new.product_external_id;
 new.unit_cost:=coalesce(v_cost,0);
 new.line_profit:=coalesce(new.line_total,0)-(new.unit_cost*new.quantity);
 return new;
end $$;

drop trigger if exists ks_sale_item_capture_cost on public.ks_sale_items;
create trigger ks_sale_item_capture_cost
before insert on public.ks_sale_items
for each row execute function private.ks_capture_sale_item_cost();

create or replace function private.ks_refresh_sale_profit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sale_id uuid;
begin
 v_sale_id:=case when tg_op='DELETE' then old.sale_id else new.sale_id end;
 update public.ks_sales s
 set cost_of_goods=coalesce((
       select sum(i.unit_cost*i.quantity)
       from public.ks_sale_items i where i.sale_id=v_sale_id
     ),0),
     gross_profit=coalesce(s.subtotal,0)-coalesce(s.discount_value,0)-coalesce((
       select sum(i.unit_cost*i.quantity)
       from public.ks_sale_items i where i.sale_id=v_sale_id
     ),0)
 where s.id=v_sale_id;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;

drop trigger if exists ks_sale_item_refresh_profit on public.ks_sale_items;
create trigger ks_sale_item_refresh_profit
after insert or update or delete on public.ks_sale_items
for each row execute function private.ks_refresh_sale_profit();

comment on column public.ks_products.purchase_cost is 'Latest unit purchase cost in company currency.';
comment on column public.ks_sales.gross_profit is 'Gross profit excluding VAT and after invoice discount; legacy rows may be null.';
comment on column public.ks_sale_items.unit_cost is 'Purchase cost snapshot captured when the sale is finalized.';
