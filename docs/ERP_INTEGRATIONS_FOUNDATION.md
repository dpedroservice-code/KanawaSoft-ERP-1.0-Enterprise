# KanawaSoft 1.0 — ERP Expansion & Integration Foundation

This change is additive and targets ONLY the isolated Supabase project `mhaynctedpyqjxdhdisv` on the existing feature branch. It does not change `kanawasoft.shop`, Netlify, the production deployment, or the existing core schema.

## Database expansion
Migration `20261107100000_erp_integrations_foundation.sql` adds 45 operational tables, 3 legal/compliance tables and 28 enterprise-management/licensing tables for purchasing, warehouse/stock movements, customers, quotations, finance, HR/payroll, projects, service orders, assets, fleet/delivery, e-commerce, marketing, automation, support, knowledge articles and connectors. Existing core tables remain intact. Tenant RLS is enabled on the new operational tables. Credential vault and e-commerce API-key tables have RLS enabled with no client policies and are service-role-only.

## Meta / WhatsApp credentials
The app must not place Meta App Secret, WhatsApp token, access token, refresh token or webhook secret in HTML, browser storage, public JS, Git, or chat. The integration screen collects them only for a single HTTPS request to the Edge Function. The function verifies the Supabase JWT and active company membership, encrypts credentials with AES-256-GCM using the server-only key returned by the restricted `ks_get_integration_encryption_key()` RPC (Supabase Vault), and writes ciphertext using the service role. The key is never returned to the browser. Configure the Supabase project secrets and Vault migration before enabling saves.

## E-commerce API keys
API keys are generated server-side, displayed once, and stored only as SHA-256 digests. The clear key must be copied by the operator at creation time; it cannot be retrieved later. Revoke and rotate compromised keys.

## Integration status
This is a secure credential-storage and schema foundation, not a completed Meta OAuth/webhook/messaging integration. No messages or campaigns are sent by this change. A later phase must add Meta OAuth consent, token refresh, webhook signature validation, queue/retry workers, provider API versioning, and delivery/error monitoring.

## AI module guide
The database includes a knowledge-article store for Portuguese module instructions. The AI assistant should answer using company-authorized module metadata and published help articles; do not send passwords, access tokens, personal customer data or payroll data to an external model. AI provider keys belong in server-side environment secrets.

## Legal / compliance
Add configuration and workflow support, not legal certification. Angola fiscal settings and invoices must be checked against current AGT specifications and applicable legislation by qualified personnel. Never represent this ERP as AGT-certified or homologated until the official process is completed.


## E-commerce gateway
After deploying the `ecommerce-gateway` Edge Function, external storefronts can:
- `GET /functions/v1/ecommerce-gateway?action=catalog` with `x-api-key: ks_live_...` and `catalog:read` to read the active product catalogue.
- `POST /functions/v1/ecommerce-gateway?action=create_order` with `x-api-key` and `orders:write` to submit an order using `orderNumber`, `customer`, `items: [{ productId, quantity }]`, and optional `shippingTotal`.

Prices are taken from the ERP catalogue, not trusted from the storefront. The gateway checks product availability and stores orders as `pending`; it does not decrement stock or finalize a fiscal invoice until a user confirms the order in the ERP. Duplicate order numbers return HTTP 409. Use HTTPS and keep API keys only in the external store's server-side configuration, never in browser JavaScript.


See [Enterprise Management 1.0](ENTERPRISE_MANAGEMENT_1_0.md) for the expanded company-management, HR, payroll, calendar, expenses, licensing, package quotas and Angola legal registry scope. The total planned public table count after all migrations is 93.


## Cofre de cifragem e Edge Functions
A chave raiz AES-256-GCM é gerada no PostgreSQL e guardada no Supabase Vault. A função pública de leitura é SECURITY INVOKER e executável apenas por `service_role`; o código da Edge Function obtém a chave pelo RPC de servidor. O App Secret e os tokens Meta não ficam no HTML, LocalStorage, repositório ou nas respostas da interface.

Edge Functions publicadas no projecto isolado:
- `company-integrations` — exige JWT e valida utilizador/membership activa; guarda credenciais cifradas.
- `ecommerce-gateway` — autentica por API key hash e scopes; por isso está configurada sem validação JWT da plataforma e valida a chave própria em cada pedido.

As funções foram publicadas, mas ainda falta um teste funcional com uma conta/empresa sintética e credenciais de sandbox.


## Payment gateway credentials
The integration center reuses the same encrypted, company-scoped vault for PayPal, Stripe, PayPay and Multicaixa Express. It collects the merchant/account ID, public/client ID, private secret/API key, webhook signing secret and sandbox/production mode. Required fields are validated by the Edge Function (PayPal: Client ID + Secret Key; Stripe: Secret Key; PayPay and Multicaixa Express: Merchant ID + Secret Key). The provider allow-list is extended by migration `20261108110000_payment_gateway_integrations.sql`; no duplicate credentials table is created.

This phase securely stores and masks credentials and lets an authorized company administrator rotate or revoke them. It does **not** yet initiate real charges, process provider callbacks, settle transactions or reconcile bank statements. Those actions require provider-specific API adapters, merchant onboarding, callback signature verification, idempotency and sandbox tests. Do not enable production payments until these checks pass.


## Security and performance follow-up
The isolated Supabase project has the payment-provider allow-list migration applied and `company-integrations` Edge Function deployed with JWT verification enabled. Follow-up hardening consolidates overlapping membership/module/tax/invitation policies, moves three privileged RPC implementations into the non-exposed `private` schema behind public SECURITY INVOKER wrappers, and removes anonymous execution. Supabase SQL verification confirmed: anonymous execution is false, authenticated execution is true, and the public wrappers are not SECURITY DEFINER.

The OTP rate-limit table intentionally has RLS enabled with no client policies and denies SELECT to `anon` and `authenticated`; only `service_role` can read it. Performance advisors no longer report unindexed foreign keys or overlapping permissive policies. The remaining unused-index notices are informational on a test database with little or no workload; do not drop indexes solely because they have not yet been used.

One project-level Auth recommendation remains: enable leaked-password protection in Supabase Auth settings. This is a dashboard-level setting and was not changed by the repository migration. Live provider charges, webhook delivery, AGT certification/submission and manual end-to-end UI validation remain separate validation gates.
