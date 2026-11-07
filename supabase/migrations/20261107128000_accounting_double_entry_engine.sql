-- Accounting foundation: tenant-checked account plan, balanced double-entry journals.
create or replace function private.ks_accounting_snapshot(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if not private.ks_has_company_role(p_company_id, array['owner','admin','manager','gerente','accountant','contabilista']) then
    raise exception 'Sem permissões para consultar a contabilidade.' using errcode='42501';
  end if;
  select jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.account_code) from public.ks_chart_of_accounts a where a.company_id=p_company_id and a.is_active), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'entry_number',e.entry_number,'entry_date',e.entry_date,'description',e.description,'status',e.status,
      'debit_total',coalesce((select sum(l.debit) from public.ks_journal_lines l where l.journal_entry_id=e.id),0),
      'credit_total',coalesce((select sum(l.credit) from public.ks_journal_lines l where l.journal_entry_id=e.id),0)
    ) order by e.entry_date desc,e.created_at desc) from public.ks_journal_entries e where e.company_id=p_company_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function private.ks_save_chart_account(p_company_id uuid,p_account_code text,p_name text,p_account_type text,p_parent_id uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.ks_has_company_role(p_company_id, array['owner','admin','manager','gerente','accountant','contabilista']) then
    raise exception 'Sem permissões para alterar o plano de contas.' using errcode='42501';
  end if;
  if nullif(trim(p_account_code),'') is null or nullif(trim(p_name),'') is null or p_account_type not in ('asset','liability','equity','income','expense') then
    raise exception 'Código, nome e tipo de conta válidos são obrigatórios.';
  end if;
  if p_parent_id is not null and not exists(select 1 from public.ks_chart_of_accounts where id=p_parent_id and company_id=p_company_id) then
    raise exception 'A conta principal não pertence a esta empresa.';
  end if;
  insert into public.ks_chart_of_accounts(company_id,account_code,name,account_type,parent_id,is_active)
  values(p_company_id,trim(p_account_code),trim(p_name),p_account_type,p_parent_id,true)
  on conflict(company_id,account_code) do update set name=excluded.name,account_type=excluded.account_type,parent_id=excluded.parent_id,is_active=true
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.ks_post_journal_entry(p_company_id uuid,p_entry_date date,p_description text,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_year integer; v_number integer; v_entry_id uuid; v_debit numeric(20,2); v_credit numeric(20,2);
  v_count integer; v_line jsonb; v_account_id uuid; v_line_debit numeric(20,2); v_line_credit numeric(20,2); v_entry_number text;
begin
  if not private.ks_has_company_role(p_company_id, array['owner','admin','manager','gerente','accountant','contabilista']) then
    raise exception 'Sem permissões para lançar movimentos contabilísticos.' using errcode='42501';
  end if;
  if p_entry_date is null or nullif(trim(p_description),'') is null or jsonb_typeof(p_lines)<>'array' then
    raise exception 'Data, descrição e linhas contabilísticas são obrigatórias.';
  end if;
  v_count:=jsonb_array_length(p_lines);
  if v_count<2 then raise exception 'Um lançamento exige pelo menos duas linhas.'; end if;
  select coalesce(sum((x->>'debit')::numeric),0),coalesce(sum((x->>'credit')::numeric),0)
    into v_debit,v_credit from jsonb_array_elements(p_lines) x;
  if v_debit<=0 or v_credit<=0 or round(v_debit,2)<>round(v_credit,2) then
    raise exception 'O lançamento não está equilibrado: débito deve ser igual ao crédito.' using errcode='22000';
  end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_account_id:=(v_line->>'account_id')::uuid;
    v_line_debit:=coalesce((v_line->>'debit')::numeric,0);
    v_line_credit:=coalesce((v_line->>'credit')::numeric,0);
    if v_line_debit<0 or v_line_credit<0 or (v_line_debit=0 and v_line_credit=0) or (v_line_debit>0 and v_line_credit>0) then
      raise exception 'Cada linha deve ter apenas débito ou crédito positivo.';
    end if;
    if not exists(select 1 from public.ks_chart_of_accounts where id=v_account_id and company_id=p_company_id and is_active) then
      raise exception 'Uma conta indicada não existe, não está activa ou pertence a outra empresa.';
    end if;
  end loop;
  v_year:=extract(year from p_entry_date)::integer;
  perform pg_advisory_xact_lock(hashtext(p_company_id::text),v_year);
  select coalesce(max(substring(entry_number from '^(?:DIARIO-)[0-9]{4}-([0-9]+)$')::integer),0)+1
    into v_number from public.ks_journal_entries where company_id=p_company_id and entry_number like 'DIARIO-'||v_year||'-%';
  v_entry_number:='DIARIO-'||v_year||'-'||lpad(v_number::text,6,'0');
  insert into public.ks_journal_entries(company_id,entry_number,entry_date,description,source_type,status)
  values(p_company_id,v_entry_number,p_entry_date,trim(p_description),'manual','posted')
  returning id into v_entry_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    insert into public.ks_journal_lines(company_id,journal_entry_id,account_id,debit,credit)
    values(p_company_id,v_entry_id,(v_line->>'account_id')::uuid,coalesce((v_line->>'debit')::numeric,0),coalesce((v_line->>'credit')::numeric,0));
  end loop;
  return jsonb_build_object('id',v_entry_id,'entry_number',v_entry_number,'debit_total',v_debit,'credit_total',v_credit);
end;
$$;

revoke all on function private.ks_accounting_snapshot(uuid) from public,anon;
revoke all on function private.ks_save_chart_account(uuid,text,text,text,uuid) from public,anon;
revoke all on function private.ks_post_journal_entry(uuid,date,text,jsonb) from public,anon;
grant execute on function private.ks_accounting_snapshot(uuid) to authenticated,service_role;
grant execute on function private.ks_save_chart_account(uuid,text,text,text,uuid) to authenticated,service_role;
grant execute on function private.ks_post_journal_entry(uuid,date,text,jsonb) to authenticated,service_role;

create or replace function public.ks_accounting_snapshot(p_company_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.ks_accounting_snapshot(p_company_id); $$;
create or replace function public.ks_save_chart_account(p_company_id uuid,p_account_code text,p_name text,p_account_type text,p_parent_id uuid default null)
returns uuid language sql security invoker set search_path=''
as $$ select private.ks_save_chart_account(p_company_id,p_account_code,p_name,p_account_type,p_parent_id); $$;
create or replace function public.ks_post_journal_entry(p_company_id uuid,p_entry_date date,p_description text,p_lines jsonb)
returns jsonb language sql security invoker set search_path=''
as $$ select private.ks_post_journal_entry(p_company_id,p_entry_date,p_description,p_lines); $$;
revoke all on function public.ks_accounting_snapshot(uuid) from public,anon;
revoke all on function public.ks_save_chart_account(uuid,text,text,text,uuid) from public,anon;
revoke all on function public.ks_post_journal_entry(uuid,date,text,jsonb) from public,anon;
grant execute on function public.ks_accounting_snapshot(uuid) to authenticated;
grant execute on function public.ks_save_chart_account(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.ks_post_journal_entry(uuid,date,text,jsonb) to authenticated;
