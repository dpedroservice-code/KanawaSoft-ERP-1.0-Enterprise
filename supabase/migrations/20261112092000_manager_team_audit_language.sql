-- Manager team access, durable audit events and per-user language preference.
-- Prepared for review only. Do not apply until the APP migration history is reconciled.

ALTER TABLE public.ks_company_memberships
  ADD COLUMN IF NOT EXISTS supervisor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ks_team_invitations
  ADD COLUMN IF NOT EXISTS supervisor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ks_profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'pt';

DO $$
BEGIN
  ALTER TABLE public.ks_profiles
    ADD CONSTRAINT ks_profiles_preferred_language_check
    CHECK (preferred_language IN ('pt','en','fr','es','zh','ar'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS ks_memberships_supervisor_idx
  ON public.ks_company_memberships(company_id, supervisor_user_id, status);

CREATE INDEX IF NOT EXISTS ks_team_invites_supervisor_idx
  ON public.ks_team_invitations(company_id, supervisor_user_id, expires_at);

-- The application already writes and reads this table, but it is absent from the APP project.
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

DROP POLICY IF EXISTS ks_audit_events_read ON public.ks_audit_events;
DROP POLICY IF EXISTS ks_audit_events_insert ON public.ks_audit_events;
DROP POLICY IF EXISTS mg_ks_audit_events_sel ON public.ks_audit_events;
DROP POLICY IF EXISTS ks_audit_events_read_scoped ON public.ks_audit_events;
DROP POLICY IF EXISTS ks_audit_events_insert_own ON public.ks_audit_events;

CREATE POLICY ks_audit_events_read_scoped ON public.ks_audit_events
  FOR SELECT TO authenticated
  USING (
    private.ks_has_company_role(company_id, ARRAY['owner','admin','manager','gerente','operator','operador','cashier','caixa','accountant','contabilista','viewer']::text[])
    AND (
      actor_user_id = (SELECT auth.uid())
      OR private.ks_has_company_role(company_id, ARRAY['owner','admin','accountant','contabilista']::text[])
      OR (
        private.ks_has_company_role(company_id, ARRAY['manager','gerente','operator','operador']::text[])
        AND EXISTS (
          SELECT 1
          FROM public.ks_company_memberships target
          WHERE target.company_id = ks_audit_events.company_id
            AND target.user_id = ks_audit_events.actor_user_id
            AND target.status IN ('active','invited','suspended')
            AND target.supervisor_user_id = (SELECT auth.uid())
        )
      )
    )
  );

CREATE POLICY ks_audit_events_insert_own ON public.ks_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = (SELECT auth.uid())
    AND octet_length(coalesce(details, '{}'::jsonb)::text) <= 12000
    AND private.ks_has_company_role(company_id, ARRAY['owner','admin','manager','gerente','operator','operador','cashier','caixa','accountant','contabilista','viewer']::text[])
    AND EXISTS (
      SELECT 1
      FROM public.ks_company_memberships actor
      WHERE actor.company_id = ks_audit_events.company_id
        AND actor.user_id = (SELECT auth.uid())
        AND actor.status = 'active'
    )
  );

-- A manager may read only their own membership and their direct reports.
DROP POLICY IF EXISTS membership_read_company_admin ON public.ks_company_memberships;
DROP POLICY IF EXISTS membership_read_team_supervisor ON public.ks_company_memberships;
CREATE POLICY membership_read_company_team ON public.ks_company_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.ks_has_company_role(company_id, ARRAY['owner','admin']::text[])
    OR (
      private.ks_has_company_role(company_id, ARRAY['manager','gerente','operator','operador']::text[])
      AND supervisor_user_id = (SELECT auth.uid())
    )
  );

-- Managers see the invitations they created; administrators see all invitations in the company.
DROP POLICY IF EXISTS ks_team_invitations_admin_select ON public.ks_team_invitations;
DROP POLICY IF EXISTS ks_team_invitations_admin_read ON public.ks_team_invitations;
DROP POLICY IF EXISTS ks_team_invitations_hierarchy_read ON public.ks_team_invitations;
DROP POLICY IF EXISTS ks_team_invitations_scoped_read ON public.ks_team_invitations;
CREATE POLICY ks_team_invitations_scoped_read ON public.ks_team_invitations
  FOR SELECT TO authenticated
  USING (
    private.ks_has_company_role(company_id, ARRAY['owner','admin']::text[])
    OR (
      created_by = (SELECT auth.uid())
      AND private.ks_has_company_role(company_id, ARRAY['manager','gerente','operator','operador']::text[])
    )
  );

DROP POLICY IF EXISTS ks_team_invitations_admin_insert ON public.ks_team_invitations;
DROP POLICY IF EXISTS ks_team_invitations_hierarchy_insert ON public.ks_team_invitations;
DROP POLICY IF EXISTS ks_team_invitations_scoped_insert ON public.ks_team_invitations;
CREATE POLICY ks_team_invitations_scoped_insert ON public.ks_team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND accepted_at IS NULL
    AND expires_at > now()
    AND private.ks_has_company_role(company_id, ARRAY['owner','admin','manager','gerente','operator','operador']::text[])
    AND (
      EXISTS (
        SELECT 1 FROM public.ks_company_memberships actor
        WHERE actor.company_id = ks_team_invitations.company_id
          AND actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role IN ('owner','admin')
          AND role IN ('manager','accountant','operator','cashier','viewer')
      )
      OR EXISTS (
        SELECT 1 FROM public.ks_company_memberships actor
        WHERE actor.company_id = ks_team_invitations.company_id
          AND actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role IN ('manager','gerente')
          AND role = 'operator'
          AND supervisor_user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.ks_company_memberships actor
        WHERE actor.company_id = ks_team_invitations.company_id
          AND actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role = 'operator'
          AND role = 'cashier'
          AND supervisor_user_id = (SELECT auth.uid())
      )
    )
  );

-- Staff display names are available only to administrators/accountants or the manager's own team.
DROP POLICY IF EXISTS profile_read_company_admin ON public.ks_profiles;
DROP POLICY IF EXISTS ks_profiles_select_supervisor_team ON public.ks_profiles;
DROP POLICY IF EXISTS profile_read_team_scoped ON public.ks_profiles;
CREATE POLICY profile_read_team_scoped ON public.ks_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.ks_company_memberships actor
      JOIN public.ks_company_memberships target
        ON target.company_id = actor.company_id
      WHERE actor.user_id = (SELECT auth.uid())
        AND actor.status = 'active'
        AND target.user_id = ks_profiles.user_id
        AND target.status IN ('active','invited','suspended')
        AND (
          private.ks_has_company_role(actor.company_id, ARRAY['owner','admin','accountant','contabilista']::text[])
          OR (
            private.ks_has_company_role(actor.company_id, ARRAY['manager','gerente','operator','operador']::text[])
            AND target.supervisor_user_id = (SELECT auth.uid())
          )
        )
    )
  );

-- Preserve the supervisor chain when an invited account is created.
CREATE OR REPLACE FUNCTION private.ks_redeem_team_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_code text;
  v_invite public.ks_team_invitations%ROWTYPE;
  v_status text;
BEGIN
  v_code := nullif(new.raw_user_meta_data ->> 'invitation_code','');
  IF v_code IS NULL THEN RETURN new; END IF;

  SELECT * INTO v_invite
  FROM public.ks_team_invitations i
  WHERE i.token_hash = encode(extensions.digest(convert_to(v_code,'UTF8'),'sha256'),'hex')
    AND lower(i.email) = lower(new.email)
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, expirado ou associado a outro email.' USING ERRCODE = '42501';
  END IF;

  v_status := CASE WHEN new.email_confirmed_at IS NOT NULL THEN 'active' ELSE 'invited' END;

  INSERT INTO public.ks_company_memberships(
    company_id,user_id,role,status,permissions,supervisor_user_id
  )
  VALUES (
    v_invite.company_id,new.id,v_invite.role,v_status,v_invite.permissions,v_invite.supervisor_user_id
  )
  ON CONFLICT (company_id,user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = EXCLUDED.status,
        permissions = EXCLUDED.permissions,
        supervisor_user_id = EXCLUDED.supervisor_user_id;

  UPDATE public.ks_team_invitations
  SET accepted_by = new.id, accepted_at = now()
  WHERE id = v_invite.id;

  RETURN new;
END;
$function$;

-- Explicitly scoped RPC: administrators may invite management roles; managers may invite operators;
-- operators may invite cashiers. The target company is never inferred from an arbitrary membership.
CREATE OR REPLACE FUNCTION public.ks_create_team_invitation_for_company(
  p_company_id uuid,
  p_email text,
  p_full_name text,
  p_role text,
  p_permissions jsonb DEFAULT '{}'::jsonb,
  p_expires_hours integer DEFAULT 72
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_role text;
  v_email text;
  v_token text;
  v_id uuid;
  v_expires timestamptz;
  v_supervisor uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Sessão necessária.' USING ERRCODE = '42501';
  END IF;

  SELECT m.role INTO v_actor_role
  FROM public.ks_company_memberships m
  WHERE m.company_id = p_company_id
    AND m.user_id = (SELECT auth.uid())
    AND m.status = 'active'
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Não existe uma associação activa à empresa seleccionada.' USING ERRCODE = '42501';
  END IF;

  IF NOT private.ks_has_company_role(p_company_id, ARRAY[v_actor_role]::text[]) THEN
    RAISE EXCEPTION 'A licença ou o acesso à empresa não permite convidar colaboradores.' USING ERRCODE = '42501';
  END IF;

  IF v_actor_role IN ('owner','admin') THEN
    IF p_role NOT IN ('manager','accountant','operator','cashier','viewer') THEN
      RAISE EXCEPTION 'Perfil de convite não permitido.' USING ERRCODE = '42501';
    END IF;
    v_supervisor := NULL;
  ELSIF v_actor_role IN ('manager','gerente') THEN
    IF p_role <> 'operator' THEN
      RAISE EXCEPTION 'O gerente só pode convidar operadores.' USING ERRCODE = '42501';
    END IF;
    v_supervisor := (SELECT auth.uid());
  ELSIF v_actor_role = 'operator' THEN
    IF p_role <> 'cashier' THEN
      RAISE EXCEPTION 'O operador só pode convidar caixas.' USING ERRCODE = '42501';
    END IF;
    v_supervisor := (SELECT auth.uid());
  ELSE
    RAISE EXCEPTION 'O seu perfil não pode convidar colaboradores.' USING ERRCODE = '42501';
  END IF;

  v_email := lower(trim(coalesce(p_email,'')));
  IF v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Email inválido.' USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_full_name,''))) < 2 THEN
    RAISE EXCEPTION 'Informe o nome completo.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(coalesce(p_permissions,'{}'::jsonb)) <> 'object'
     OR octet_length(coalesce(p_permissions,'{}'::jsonb)::text) > 16000 THEN
    RAISE EXCEPTION 'Permissões inválidas.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_expires_hours,72) NOT BETWEEN 1 AND 168 THEN
    RAISE EXCEPTION 'A validade do convite deve estar entre 1 e 168 horas.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'Este email já tem uma conta. Contacte a administração.' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ks_team_invitations i
    WHERE i.company_id = p_company_id
      AND lower(i.email) = v_email
      AND i.accepted_at IS NULL
      AND i.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este email.' USING ERRCODE = '23505';
  END IF;

  PERFORM private.ks_validate_team_permissions(coalesce(p_permissions,'{}'::jsonb));
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + make_interval(hours => greatest(1, least(coalesce(p_expires_hours,72),168)));

  INSERT INTO public.ks_team_invitations(
    company_id,email,full_name,role,permissions,token_hash,created_by,supervisor_user_id,expires_at
  )
  VALUES (
    p_company_id,v_email,trim(p_full_name),p_role,coalesce(p_permissions,'{}'::jsonb),
    encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),
    (SELECT auth.uid()),v_supervisor,v_expires
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',v_id,
    'email',v_email,
    'full_name',trim(p_full_name),
    'role',p_role,
    'invitation_code',v_token,
    'expires_at',v_expires
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ks_create_team_invitation_for_company(uuid,text,text,text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ks_create_team_invitation_for_company(uuid,text,text,text,jsonb,integer) TO authenticated;
