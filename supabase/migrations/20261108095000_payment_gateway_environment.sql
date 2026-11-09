alter table public.ks_company_integration_secrets
  add column if not exists environment text;

alter table public.ks_company_integration_secrets
  drop constraint if exists ks_company_integration_secrets_environment_check;

alter table public.ks_company_integration_secrets
  add constraint ks_company_integration_secrets_environment_check
  check (environment is null or environment in ('sandbox','production'));