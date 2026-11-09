alter table public.ks_company_integration_secrets
  drop constraint if exists ks_company_integration_secrets_provider_check;
alter table public.ks_company_integration_secrets
  add constraint ks_company_integration_secrets_provider_check
  check (provider in (
    'meta','whatsapp','facebook','instagram','google','custom','agt',
    'paypal','stripe','paypay','multicaixa'
  ));