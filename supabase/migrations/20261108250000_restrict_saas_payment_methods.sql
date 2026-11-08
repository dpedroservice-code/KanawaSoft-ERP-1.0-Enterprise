-- SaaS payment requests: only retain the currently supported manual payment paths.
-- Multicaixa Express remains manual until a verified provider API/webhook is configured.
-- NOT VALID preserves historical requests using legacy methods while enforcing new writes.
ALTER TABLE public.ks_payment_requests
  DROP CONSTRAINT IF EXISTS ks_payment_requests_payment_method_check;

ALTER TABLE public.ks_payment_requests
  ADD CONSTRAINT ks_payment_requests_payment_method_check
  CHECK (payment_method IN ('bank_transfer', 'multicaixa_express')) NOT VALID;

COMMENT ON COLUMN public.ks_payment_requests.payment_method IS
  'Allowed current SaaS payment paths: bank_transfer or multicaixa_express. Both remain pending manual verification until a provider webhook is configured.';

NOTIFY pgrst, 'reload schema';
