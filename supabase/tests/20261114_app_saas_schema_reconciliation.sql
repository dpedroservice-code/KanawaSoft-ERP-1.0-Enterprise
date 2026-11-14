-- Read-only post-migration smoke checks for the APP schema reconciliation.
-- Run only against a disposable/test database AFTER the migration has been applied.
-- This script performs no INSERT/UPDATE/DELETE/DDL operations.

DO $$
DECLARE
  v_missing text;
BEGIN
  IF to_regclass('public.ks_license_terms') IS NULL
     OR to_regclass('public.ks_license_keys') IS NULL
     OR to_regclass('public.ks_payment_requests') IS NULL
     OR to_regclass('public.ks_saas_addons') IS NULL THEN
    RAISE EXCEPTION 'Missing one or more SaaS reconciliation tables';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ks_license_keys'
      AND column_name='key_hash'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ks_license_keys'
      AND column_name='license_key'
  ) THEN
    RAISE EXCEPTION 'License keys must store hashes, never plaintext keys';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ks_saas_plans
    WHERE code='starter' AND plan_code='trial'
      AND max_users=3 AND max_installations=2
      AND max_invoices_month=100 AND max_invoices_period=100
  ) THEN
    RAISE EXCEPTION 'Legacy starter trial compatibility or quotas are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ks_license_terms
    WHERE term_code='trial_14_days' AND duration_days=14
      AND duration_months=0 AND NOT internal_only
  ) OR NOT EXISTS (
    SELECT 1 FROM public.ks_license_terms
    WHERE term_code='lifetime_internal' AND is_lifetime AND internal_only
  ) THEN
    RAISE EXCEPTION 'Trial or internal lifetime term configuration is incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.ks_license_keys'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on ks_license_keys';
  END IF;

  IF has_table_privilege('anon','public.ks_license_keys','SELECT')
     OR has_table_privilege('authenticated','public.ks_license_keys','SELECT') THEN
    RAISE EXCEPTION 'Direct key-table reads must remain revoked';
  END IF;

  IF NOT has_function_privilege('authenticated',
       'public.ks_issue_license_key_by_term(text,text,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.ks_redeem_license_key(text,uuid)','EXECUTE')
     OR has_function_privilege('anon',
       'public.ks_issue_license_key_by_term(text,text,uuid)','EXECUTE')
     OR has_function_privilege('anon',
       'public.ks_redeem_license_key(text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Public RPC execution grants are not restricted correctly';
  END IF;

  IF has_function_privilege('anon',
       'private.ks_issue_license_key_by_term(text,text,uuid)','EXECUTE')
     OR has_function_privilege('anon',
       'private.ks_redeem_license_key(text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Private license functions are executable by anon';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ks_payment_requests'
      AND policyname='ks_payment_requests_company_insert'
      AND cmd='INSERT'
  ) THEN
    RAISE EXCEPTION 'Payment request insert policy is missing';
  END IF;

  RAISE NOTICE 'SaaS APP schema reconciliation smoke checks passed';
END;
$$;
