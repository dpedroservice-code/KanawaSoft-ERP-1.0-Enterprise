-- Create a supporting index for every remaining public-schema FK whose child columns
-- are not already covered by an index prefix. This also optimizes the original ERP tables.
do $$
declare
 fk record;
 col_list text;
 idx_name text;
begin
 for fk in
  select con.oid, con.conname, con.conrelid, con.conkey, cls.relname as table_name
  from pg_constraint con
  join pg_class cls on cls.oid=con.conrelid
  join pg_namespace ns on ns.oid=cls.relnamespace
  where con.contype='f' and ns.nspname='public'
 loop
  if not exists (
   select 1 from pg_index i
   where i.indrelid=fk.conrelid and i.indisvalid and i.indisready
    and (
     select array_agg(k.attnum::smallint order by k.ord)
     from unnest(i.indkey::smallint[]) with ordinality as k(attnum,ord)
     where k.ord <= cardinality(fk.conkey)
    ) = fk.conkey
  ) then
   select string_agg(format('%I',a.attname),', ' order by ck.ord)
    into col_list
    from unnest(fk.conkey) with ordinality as ck(attnum,ord)
    join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=ck.attnum;
   idx_name:=left('ix_fk_'||fk.table_name||'_'||fk.conname,60);
   execute format('create index if not exists %I on %s (%s)',idx_name,fk.conrelid::regclass,col_list);
  end if;
 end loop;
end $$;
