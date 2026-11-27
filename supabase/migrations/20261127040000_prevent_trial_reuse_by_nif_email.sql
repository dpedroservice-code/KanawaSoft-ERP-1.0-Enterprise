-- Kanawa Soft ERP 1.0 — one 14-day trial per company NIF and owner email.
-- Uses a separate BEFORE INSERT guard so the existing onboarding trigger is not replaced.
-- Review against the target project's migration history before applying.

CREATE TABLE IF NOT EXISTS private.ks_trial_nif_claims (
  normalized_nif text PRIMARY KEY,
  user_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.ks_trial_email_claims (
  normalized_email text PRIMARY KEY,
  user_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.ks_trial_nif_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.ks_trial_email_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.ks_trial_nif_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.ks_trial_email_claims FROM PUBLIC, anon, authenticated;

-- Preserve previous trial eligibility even after the 14-day entitlement has expired.
INSERT INTO private.ks_trial_nif_claims(normalized_nif,user_id,claimed_at)
SELECT DISTINCT ON (upper(regexp_replace(upper(coalesce(c.tax_id,'')),'[^A-Z0-9]','','g')))
  upper(regexp_replace(upper(coalesce(c.tax_id,'')),'[^A-Z0-9]','','g')),
  c.owner_user_id,
  coalesce(l.created_at,c.created_at,now())
FROM public.ks_companies c
JOIN public.ks_company_licenses l ON l.company_id=c.id
WHERE (l.plan_code='trial' OR l.status='trial')
  AND upper(regexp_replace(upper(coalesce(c.tax_id,'')),'[^A-Z0-9]','','g')) <> ''
ORDER BY upper(regexp_replace(upper(coalesce(c.tax_id,'')),'[^A-Z0-9]','','g')),
         coalesce(l.created_at,c.created_at,now()), c.owner_user_id
ON CONFLICT(normalized_nif) DO NOTHING;

INSERT INTO private.ks_trial_email_claims(normalized_email,user_id,claimed_at)
SELECT DISTINCT ON (lower(trim(coalesce(nullif(c.email,''),u.email,''))))
  lower(trim(coalesce(nullif(c.email,''),u.email,''))),
  c.owner_user_id,
  coalesce(l.created_at,c.created_at,now())
FROM public.ks_companies c
JOIN public.ks_company_licenses l ON l.company_id=c.id
LEFT JOIN auth.users u ON u.id=c.owner_user_id
WHERE (l.plan_code='trial' OR l.status='trial')
  AND lower(trim(coalesce(nullif(c.email,''),u.email,''))) <> ''
ORDER BY lower(trim(coalesce(nullif(c.email,''),u.email,''))),
         coalesce(l.created_at,c.created_at,now()), c.owner_user_id
ON CONFLICT(normalized_email) DO NOTHING;

CREATE OR REPLACE FUNCTION private.ks_guard_trial_reuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_meta jsonb;
  v_plan text;
  v_normalized_nif text;
  v_normalized_email text;
BEGIN
  v_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  -- Team invitations use the existing company and must not consume a new trial.
  IF nullif(trim(v_meta->>'invitation_code'), '') IS NOT NULL THEN
    RETURN new;
  END IF;

  v_plan := coalesce(nullif(v_meta->>'selected_plan', ''), 'trial');
  IF v_plan <> 'trial' THEN
    RETURN new;
  END IF;

  v_normalized_nif := upper(regexp_replace(upper(coalesce(v_meta->>'company_tax_id', '')), '[^A-Z0-9]', '', 'g'));
  v_normalized_email := lower(trim(coalesce(new.email, '') ));

  IF v_normalized_nif = '' THEN
    RAISE EXCEPTION 'O NIF da empresa é obrigatório para iniciar o teste gratuito.' USING errcode='22023';
  END IF;
  IF v_normalized_email = '' THEN
    RAISE EXCEPTION 'O Gmail da empresa é obrigatório para iniciar o teste gratuito.' USING errcode='22023';
  END IF;

  INSERT INTO private.ks_trial_nif_claims(normalized_nif,user_id)
  VALUES(v_normalized_nif,new.id)
  ON CONFLICT(normalized_nif) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este NIF já utilizou o período experimental de 14 dias. Escolha um pacote pago.' USING errcode='23505';
  END IF;

  INSERT INTO private.ks_trial_email_claims(normalized_email,user_id)
  VALUES(v_normalized_email,new.id)
  ON CONFLICT(normalized_email) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este Gmail já utilizou o período experimental de 14 dias. Entre na conta existente ou escolha um pacote pago.' USING errcode='23505';
  END IF;

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION private.ks_guard_trial_reuse() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.ks_guard_trial_reuse() TO service_role;

DROP TRIGGER IF EXISTS ks_auth_user_trial_guard ON auth.users;
CREATE TRIGGER ks_auth_user_trial_guard
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.ks_guard_trial_reuse();
