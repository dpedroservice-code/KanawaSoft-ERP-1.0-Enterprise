-- Restrict account language preferences to the four maintained locales.
-- Legacy preferences for removed languages are safely reset to Portuguese (Angola).
UPDATE public.ks_profiles
SET preferred_language = 'pt'
WHERE preferred_language NOT IN ('pt','en','fr','es');

ALTER TABLE public.ks_profiles
  DROP CONSTRAINT IF EXISTS ks_profiles_preferred_language_check;

ALTER TABLE public.ks_profiles
  ADD CONSTRAINT ks_profiles_preferred_language_check
  CHECK (preferred_language IN ('pt','en','fr','es'));

COMMENT ON COLUMN public.ks_profiles.preferred_language IS
  'Preferred Kanawa Soft ERP interface language: pt, en, fr or es.';
