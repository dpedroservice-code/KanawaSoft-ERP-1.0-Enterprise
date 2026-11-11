-- Prevent duplicate company registration before the existing auth.users signup trigger creates tenant rows.
-- Matching is global across the Kanawa Soft platform and uses normalized NIF or legal/trade name.
create or replace function private.ks_normalize_company_tax_id(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(upper(btrim(coalesce(p_value,''))), '[^A-Z0-9]', '', 'g'), '');
$$;

create or replace function private.ks_normalize_company_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Treat punctuation and repeated whitespace consistently (e.g. "D.Pedro" = "D Pedro").
  select nullif(
    btrim(regexp_replace(regexp_replace(lower(coalesce(p_value,'')), '[[:punct:]]+', ' ', 'g'), '[[:space:]]+', ' ', 'g')),
    ''
  );
$$;

create or replace function private.ks_reject_duplicate_company_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tax_id text;
  v_company_name text;
  v_lock_key text;
  v_existing_name text;
begin
  v_tax_id := private.ks_normalize_company_tax_id(new.raw_user_meta_data->>'company_tax_id');
  v_company_name := private.ks_normalize_company_name(new.raw_user_meta_data->>'company_legal_name');

  -- The legacy signup trigger uses "Empresa" when no name was supplied.
  if v_company_name = 'empresa' then v_company_name := null; end if;
  if v_tax_id is null and v_company_name is null then
    return new;
  end if;

  -- Serialize attempts that share either identifier, avoiding concurrent duplicate signups.
  for v_lock_key in
    select lock_value
    from unnest(array[
      case when v_tax_id is not null then 'company-tax:' || v_tax_id end,
      case when v_company_name is not null then 'company-name:' || v_company_name end
    ]) as locks(lock_value)
    where lock_value is not null
    order by lock_value
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  end loop;

  select coalesce(c.legal_name, c.trade_name, 'empresa')
    into v_existing_name
  from public.ks_companies c
  where (v_tax_id is not null and private.ks_normalize_company_tax_id(c.tax_id) = v_tax_id)
     or (v_company_name is not null and (
          private.ks_normalize_company_name(c.legal_name) = v_company_name
          or private.ks_normalize_company_name(c.trade_name) = v_company_name
        ))
  order by c.created_at
  limit 1;

  if found then
    raise exception 'A empresa "%" já está registada. Verifique o NIF ou o nome antes de criar uma nova conta.', v_existing_name
      using errcode = '23505',
            detail = 'COMPANY_ALREADY_REGISTERED';
  end if;

  return new;
end;
$$;

revoke all on function private.ks_normalize_company_tax_id(text) from public, anon, authenticated;
revoke all on function private.ks_normalize_company_name(text) from public, anon, authenticated;
revoke all on function private.ks_reject_duplicate_company_signup() from public, anon, authenticated;

drop trigger if exists ks_prevent_duplicate_company_signup on auth.users;
create trigger ks_prevent_duplicate_company_signup
before insert on auth.users
for each row execute function private.ks_reject_duplicate_company_signup();
