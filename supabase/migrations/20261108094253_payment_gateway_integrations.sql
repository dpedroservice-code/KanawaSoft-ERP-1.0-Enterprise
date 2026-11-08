-- Extend the existing encrypted integration vault for payment providers.
-- No new credential table: reuse company/provider uniqueness and server-only access.
alter table public.ks_company_integration_secrets
  drop constraint if exists ks_company_integration_secrets_provider_check;

alter table public.ks_company_integration_secrets
  add constraint ks_company_integration_secrets_provider_check
  check (provider in (
    'meta','whatsapp','facebook','instagram','google','custom',
    'paypal','stripe','paypay','multicaixa'
  ));

comment on table public.ks_company_integration_secrets is
  'Server-only encrypted credentials for messaging, marketing and payment providers. Never expose ciphertext or plaintext to browser clients.';

notify pgrst, 'reload schema';
