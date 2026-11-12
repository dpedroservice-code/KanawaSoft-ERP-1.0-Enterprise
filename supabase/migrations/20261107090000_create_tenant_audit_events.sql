-- Create the tenant audit event store before the audit RLS hardening migration.
-- This prerequisite is intentionally ordered before 20261107101000_help_audit_rls_hardening.sql.

CREATE TABLE IF NOT EXISTS public.ks_audit_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 100),
  resource_type text NOT NULL DEFAULT 'module',
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ks_audit_events_details_object CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX IF NOT EXISTS ks_audit_events_company_created_idx
  ON public.ks_audit_events(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ks_audit_events_actor_created_idx
  ON public.ks_audit_events(company_id, actor_user_id, created_at DESC);

ALTER TABLE public.ks_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ks_audit_events FROM anon;
GRANT SELECT, INSERT ON public.ks_audit_events TO authenticated;
