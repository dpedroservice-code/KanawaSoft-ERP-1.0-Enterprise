-- Follow-up RLS for nullable-company help articles and audit records.
alter table public.ks_knowledge_articles enable row level security;
create policy ks_knowledge_articles_read on public.ks_knowledge_articles
for select to authenticated using (
  (company_id is null and published = true)
  or (company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','cashier','operator','gerente','caixa','operador']::text[]))
);
create policy ks_knowledge_articles_manage on public.ks_knowledge_articles
for all to authenticated using (
  company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
) with check (
  company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
);

alter table public.ks_audit_events enable row level security;
create policy ks_audit_events_read on public.ks_audit_events
for select to authenticated using (
  company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
);
create policy ks_audit_events_insert on public.ks_audit_events
for insert to authenticated with check (
  company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
);
revoke all on public.ks_company_integration_secrets from anon, authenticated;
revoke all on public.ks_ecommerce_api_keys from anon, authenticated;
