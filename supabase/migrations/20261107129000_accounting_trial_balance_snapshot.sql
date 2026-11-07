-- Add posted-only balances to the tenant-scoped accounting snapshot.
create or replace function private.ks_accounting_snapshot(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if not private.ks_has_company_role(p_company_id, array['owner','admin','manager','gerente','accountant','contabilista']) then
    raise exception 'Sem permissões para consultar a contabilidade.' using errcode='42501';
  end if;
  select jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'account_code',a.account_code,'name',a.name,'account_type',a.account_type,'parent_id',a.parent_id,
      'debit_total',coalesce(sum(l.debit) filter (where e.id is not null),0),
      'credit_total',coalesce(sum(l.credit) filter (where e.id is not null),0),
      'balance',coalesce(sum(l.debit-l.credit) filter (where e.id is not null),0)
    ) order by a.account_code)
    from public.ks_chart_of_accounts a
    left join public.ks_journal_lines l on l.account_id=a.id and l.company_id=a.company_id
    left join public.ks_journal_entries e on e.id=l.journal_entry_id and e.company_id=a.company_id and e.status='posted'
    where a.company_id=p_company_id and a.is_active group by a.id), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'entry_number',e.entry_number,'entry_date',e.entry_date,'description',e.description,'status',e.status,
      'debit_total',coalesce((select sum(l.debit) from public.ks_journal_lines l where l.journal_entry_id=e.id),0),
      'credit_total',coalesce((select sum(l.credit) from public.ks_journal_lines l where l.journal_entry_id=e.id),0)
    ) order by e.entry_date desc,e.created_at desc) from public.ks_journal_entries e where e.company_id=p_company_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
