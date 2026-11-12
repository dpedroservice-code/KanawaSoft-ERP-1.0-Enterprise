-- Per-user Kanawa Soft ERP language preference for all 11 requested locales.
ALTER TABLE public.ks_profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'pt';
ALTER TABLE public.ks_profiles DROP CONSTRAINT IF EXISTS ks_profiles_preferred_language_check;
ALTER TABLE public.ks_profiles ADD CONSTRAINT ks_profiles_preferred_language_check
  CHECK (preferred_language IN ('pt','en','fr','es','zh','ar','ln','cjk','umb','kmb','kon'));
COMMENT ON COLUMN public.ks_profiles.preferred_language IS
  'Preferred Kanawa Soft ERP interface language: pt, en, fr, es, zh, ar, ln, cjk, umb, kmb or kon.';
