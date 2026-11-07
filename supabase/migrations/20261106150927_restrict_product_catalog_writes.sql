-- Product catalog is readable by active company members, but only managers/admins can change it.
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

drop policy if exists ks_products_member on public.ks_products;
create policy ks_products_read_member on public.ks_products for select to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]));
create policy ks_products_insert_manager on public.ks_products for insert to authenticated
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_products_update_manager on public.ks_products for update to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]))
with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_products_delete_manager on public.ks_products for delete to authenticated
using(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
