-- Cover the remaining foreign keys reported by Supabase performance advisors.
create index if not exists ix_ks_company_module_settings_updated_by
  on public.ks_company_module_settings(updated_by)
  where updated_by is not null;

create index if not exists ix_ks_tax_return_lines_tax_return_id
  on public.ks_tax_return_lines(tax_return_id);

create index if not exists ix_ks_tax_returns_created_by
  on public.ks_tax_returns(created_by)
  where created_by is not null;
