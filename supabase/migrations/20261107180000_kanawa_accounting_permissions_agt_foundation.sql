
-- Kanawa Soft ERP 1.0: permissions, accounting and Angolan fiscal foundations.
-- Additive schema changes only. Existing OTP authentication routines are untouched.

ALTER TABLE public.ks_company_memberships
  DROP CONSTRAINT IF EXISTS ks_company_memberships_role_check;
ALTER TABLE public.ks_company_memberships
  ADD CONSTRAINT ks_company_memberships_role_check
  CHECK (role = ANY (ARRAY['owner','admin','manager','cashier','operator','gerente','caixa','operador','accountant','contabilista']));

ALTER TABLE public.ks_team_invitations
  DROP CONSTRAINT IF EXISTS ks_team_invitations_role_check;
ALTER TABLE public.ks_team_invitations
  ADD CONSTRAINT ks_team_invitations_role_check
  CHECK (role = ANY (ARRAY['manager','operator','cashier','accountant','gerente','operador','caixa','contabilista']));

ALTER TABLE public.ks_chart_of_accounts
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS pgc_class smallint,
  ADD COLUMN IF NOT EXISTS account_level smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS normal_balance text NOT NULL DEFAULT 'debit',
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.ks_chart_of_accounts
  DROP CONSTRAINT IF EXISTS ks_chart_of_accounts_normal_balance_check;
ALTER TABLE public.ks_chart_of_accounts
  ADD CONSTRAINT ks_chart_of_accounts_normal_balance_check CHECK (normal_balance IN ('debit','credit'));

CREATE TABLE IF NOT EXISTS public.ks_company_module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  module_id text NOT NULL CHECK (module_id ~ '^[a-z0-9-]{1,64}$'),
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,module_id)
);
ALTER TABLE public.ks_company_module_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ks_company_modules_member_read ON public.ks_company_module_settings;
CREATE POLICY ks_company_modules_member_read ON public.ks_company_module_settings
  FOR SELECT TO authenticated
  USING (private.ks_has_company_role(company_id, ARRAY['owner','admin','manager','gerente','accountant','contabilista','operator','operador','cashier','caixa']));

DROP POLICY IF EXISTS ks_company_modules_admin_write ON public.ks_company_module_settings;
CREATE POLICY ks_company_modules_admin_write ON public.ks_company_module_settings
  FOR ALL TO authenticated
  USING (private.ks_has_company_role(company_id, ARRAY['owner','admin']))
  WITH CHECK (private.ks_has_company_role(company_id, ARRAY['owner','admin']));

CREATE OR REPLACE FUNCTION public.ks_set_company_module_enabled(
  p_company_id uuid, p_module_id text, p_enabled boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_module text;
BEGIN
  v_module := lower(trim(coalesce(p_module_id,'')));
  IF auth.uid() IS NULL OR NOT private.ks_has_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Apenas o proprietário ou administrador pode activar/desactivar módulos.' USING errcode='42501';
  END IF;
  IF v_module !~ '^[a-z0-9-]{1,64}$' OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'Módulo ou estado inválido.' USING errcode='22023';
  END IF;
  INSERT INTO public.ks_company_module_settings(company_id,module_id,enabled,updated_by,updated_at)
  VALUES(p_company_id,v_module,p_enabled,auth.uid(),now())
  ON CONFLICT(company_id,module_id) DO UPDATE
    SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
  RETURN jsonb_build_object('company_id',p_company_id,'module_id',v_module,'enabled',p_enabled);
END;
$function$;

CREATE OR REPLACE FUNCTION private.ks_has_company_permission(
  p_company_id uuid, p_module text, p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_permissions jsonb;
  v_override jsonb;
  v_enabled boolean;
  v_module text := lower(trim(coalesce(p_module,'')));
  v_action text := lower(trim(coalesce(p_action,'')));
BEGIN
  IF private.ks_is_platform_admin() THEN RETURN true; END IF;

  SELECT lower(coalesce(m.role,'')),coalesce(m.permissions,'{}'::jsonb)
    INTO v_role,v_permissions
  FROM public.ks_company_memberships m
  WHERE m.company_id=p_company_id AND m.user_id=auth.uid() AND m.status='active'
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_role IN ('owner','admin') THEN RETURN true; END IF;

  SELECT s.enabled INTO v_enabled
  FROM public.ks_company_module_settings s
  WHERE s.company_id=p_company_id AND s.module_id=v_module;
  IF v_enabled IS FALSE THEN RETURN false; END IF;

  IF v_action IN ('view','read') THEN v_action := 'ver'; END IF;
  IF v_action='create' THEN v_action := 'criar'; END IF;
  IF v_action='edit' THEN v_action := 'editar'; END IF;
  IF v_action='delete' THEN v_action := 'excluir'; END IF;
  IF v_action='export' THEN v_action := 'exportar'; END IF;

  v_override := v_permissions #> ARRAY['modules',v_module,v_action];
  IF v_override IS NULL THEN v_override := v_permissions #> ARRAY[v_module,v_action]; END IF;
  IF v_override IS NOT NULL AND jsonb_typeof(v_override)='boolean' THEN
    RETURN (v_override::text)::boolean;
  END IF;

  IF v_action='ver' THEN
    RETURN CASE
      WHEN v_role IN ('manager','gerente') THEN true
      WHEN v_role IN ('accountant','contabilista') THEN v_module IN
        ('dashboard','contabilidade','fiscal','financeiro','relatorios','documentos','auditoria','perfil','ativos','orcamentos','folha-salarial')
      WHEN v_role IN ('cashier','caixa') THEN v_module IN
        ('dashboard','pdv','vendas','produtos','clientes','estoque','perfil')
      WHEN v_role IN ('operator','operador') THEN v_module IN
        ('dashboard','produtos','estoque','compras','clientes','fornecedores','os','servicos','perfil')
      ELSE false END;
  END IF;

  IF v_action IN ('criar','editar') THEN
    RETURN CASE
      WHEN v_role IN ('manager','gerente') THEN v_module NOT IN ('usuarios','modulos','licenca','config','integracoes','auditoria')
      WHEN v_role IN ('accountant','contabilista') THEN v_module IN ('contabilidade','fiscal','financeiro','relatorios','ativos','orcamentos','folha-salarial')
      WHEN v_role IN ('cashier','caixa') THEN v_module IN ('pdv','vendas','clientes')
      WHEN v_role IN ('operator','operador') THEN v_module IN ('estoque','os','servicos','compras')
      ELSE false END;
  END IF;

  IF v_action='exportar' THEN
    RETURN v_role IN ('manager','gerente','accountant','contabilista')
      AND v_module IN ('contabilidade','fiscal','financeiro','relatorios','documentos');
  END IF;

  IF v_action='aprovar' THEN
    RETURN v_role IN ('manager','gerente') AND v_module IN ('compras','vendas','orcamentos','financeiro');
  END IF;

  RETURN false;
END;
$function$;

-- Add module-aware policies for accounting and fiscal tables.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname,tablename FROM pg_policies
    WHERE schemaname='public'
      AND tablename = ANY(ARRAY[
        'ks_chart_of_accounts','ks_journal_entries','ks_journal_lines',
        'ks_bank_accounts','ks_bank_reconciliations','ks_tax_rules'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,p.tablename);
  END LOOP;
END $$;

CREATE POLICY ks_chart_accounts_read ON public.ks_chart_of_accounts
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','ver'));
CREATE POLICY ks_chart_accounts_insert ON public.ks_chart_of_accounts
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'contabilidade','criar'));
CREATE POLICY ks_chart_accounts_update ON public.ks_chart_of_accounts
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'contabilidade','editar'));
CREATE POLICY ks_chart_accounts_delete ON public.ks_chart_of_accounts
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','excluir'));

CREATE POLICY ks_journal_entries_read ON public.ks_journal_entries
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','ver'));
CREATE POLICY ks_journal_entries_insert ON public.ks_journal_entries
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'contabilidade','criar'));
CREATE POLICY ks_journal_entries_update ON public.ks_journal_entries
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'contabilidade','editar'));
CREATE POLICY ks_journal_entries_delete ON public.ks_journal_entries
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','excluir'));

CREATE POLICY ks_journal_lines_read ON public.ks_journal_lines
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','ver'));
CREATE POLICY ks_journal_lines_insert ON public.ks_journal_lines
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'contabilidade','criar'));
CREATE POLICY ks_journal_lines_update ON public.ks_journal_lines
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'contabilidade','editar'));
CREATE POLICY ks_journal_lines_delete ON public.ks_journal_lines
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'contabilidade','excluir'));

CREATE POLICY ks_bank_accounts_read ON public.ks_bank_accounts
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'financeiro','ver'));
CREATE POLICY ks_bank_accounts_insert ON public.ks_bank_accounts
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'financeiro','criar'));
CREATE POLICY ks_bank_accounts_update ON public.ks_bank_accounts
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'financeiro','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'financeiro','editar'));
CREATE POLICY ks_bank_accounts_delete ON public.ks_bank_accounts
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'financeiro','excluir'));

CREATE POLICY ks_bank_reconciliations_read ON public.ks_bank_reconciliations
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'financeiro','ver'));
CREATE POLICY ks_bank_reconciliations_insert ON public.ks_bank_reconciliations
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'financeiro','criar'));
CREATE POLICY ks_bank_reconciliations_update ON public.ks_bank_reconciliations
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'financeiro','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'financeiro','editar'));
CREATE POLICY ks_bank_reconciliations_delete ON public.ks_bank_reconciliations
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'financeiro','excluir'));

CREATE POLICY ks_tax_rules_read ON public.ks_tax_rules
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','ver'));
CREATE POLICY ks_tax_rules_insert ON public.ks_tax_rules
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','criar'));
CREATE POLICY ks_tax_rules_update ON public.ks_tax_rules
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','editar'));
CREATE POLICY ks_tax_rules_delete ON public.ks_tax_rules
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','excluir'));

-- A controlled policy for assigning the accountant role to a member.
DROP POLICY IF EXISTS ks_memberships_admin_insert_accountant ON public.ks_company_memberships;
CREATE POLICY ks_memberships_admin_insert_accountant ON public.ks_company_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    role IN ('manager','operator','cashier','accountant','gerente','operador','caixa','contabilista')
    AND private.ks_has_company_role(company_id,ARRAY['owner','admin'])
  );
DROP POLICY IF EXISTS ks_memberships_admin_update_accountant ON public.ks_company_memberships;
CREATE POLICY ks_memberships_admin_update_accountant ON public.ks_company_memberships
  FOR UPDATE TO authenticated
  USING (private.ks_has_company_role(company_id,ARRAY['owner','admin']))
  WITH CHECK (
    role IN ('manager','operator','cashier','accountant','gerente','operador','caixa','contabilista')
    AND private.ks_has_company_role(company_id,ARRAY['owner','admin'])
  );

DROP POLICY IF EXISTS ks_team_invitation_admin_insert_accountant ON public.ks_team_invitations;
CREATE POLICY ks_team_invitation_admin_insert_accountant ON public.ks_team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    role IN ('manager','operator','cashier','accountant','gerente','operador','caixa','contabilista')
    AND private.ks_has_company_role(company_id,ARRAY['owner','admin'])
  );

CREATE OR REPLACE FUNCTION public.ks_create_team_invitation(
  p_email text,p_full_name text,p_role text,p_permissions jsonb DEFAULT '{}'::jsonb,p_expires_hours integer DEFAULT 72
) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO ''
AS $function$
DECLARE v_company_id uuid; v_email text; v_code text; v_id uuid; v_expires timestamptz;
BEGIN
  v_email:=lower(trim(coalesce(p_email,'')));
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão necessária.' USING errcode='42501'; END IF;
  SELECT m.company_id INTO v_company_id FROM public.ks_company_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active' AND m.role IN ('owner','admin')
    ORDER BY m.created_at ASC LIMIT 1;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Apenas o proprietário ou administrador pode convidar membros.' USING errcode='42501'; END IF;
  IF v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Email inválido.' USING errcode='22023';
  END IF;
  IF length(trim(coalesce(p_full_name,'')))<2 THEN RAISE EXCEPTION 'Informe o nome completo.' USING errcode='22023'; END IF;
  IF p_role NOT IN ('manager','operator','cashier','accountant') THEN RAISE EXCEPTION 'Perfil de convite não permitido.' USING errcode='22023'; END IF;
  IF jsonb_typeof(coalesce(p_permissions,'{}'::jsonb))<>'object' OR octet_length(coalesce(p_permissions,'{}'::jsonb)::text)>16000 THEN
    RAISE EXCEPTION 'Permissões inválidas.' USING errcode='22023';
  END IF;
  IF coalesce(p_expires_hours,72) NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'A validade do convite deve estar entre 1 e 168 horas.' USING errcode='22023'; END IF;
  IF EXISTS(SELECT 1 FROM auth.users u WHERE lower(u.email)=v_email) THEN
    RAISE EXCEPTION 'Este email já tem uma conta. O utilizador deve iniciar sessão e ser associado pela administração.' USING errcode='23505';
  END IF;
  IF EXISTS(SELECT 1 FROM public.ks_team_invitations i WHERE i.company_id=v_company_id AND lower(i.email)=v_email AND i.accepted_at IS NULL AND i.expires_at>now()) THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este email.' USING errcode='23505';
  END IF;
  v_code:=encode(extensions.gen_random_bytes(24),'hex');
  v_expires:=now()+make_interval(hours=>coalesce(p_expires_hours,72));
  INSERT INTO public.ks_team_invitations(company_id,email,full_name,role,permissions,token_hash,expires_at,created_by)
  VALUES(v_company_id,v_email,trim(p_full_name),p_role,coalesce(p_permissions,'{}'::jsonb),
    encode(extensions.digest(convert_to(v_code,'UTF8'),'sha256'),'hex'),v_expires,auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'email',v_email,'invitation_code',v_code,'expires_at',v_expires);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ks_update_team_member_access(
  p_user_id uuid,p_role text,p_permissions jsonb DEFAULT '{}'::jsonb,p_status text DEFAULT 'active'
) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO ''
AS $function$
DECLARE v_company_id uuid; v_target_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão necessária.' USING errcode='42501'; END IF;
  SELECT m.company_id INTO v_company_id FROM public.ks_company_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active' AND m.role IN ('owner','admin')
    ORDER BY m.created_at ASC LIMIT 1;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Apenas o proprietário ou administrador pode gerir acessos.' USING errcode='42501'; END IF;
  IF p_user_id IS NULL OR p_user_id=auth.uid() THEN RAISE EXCEPTION 'Não pode alterar o próprio acesso por esta operação.' USING errcode='42501'; END IF;
  IF p_role NOT IN ('manager','operator','cashier','accountant') OR p_status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'Perfil ou estado inválido.' USING errcode='22023';
  END IF;
  IF jsonb_typeof(coalesce(p_permissions,'{}'::jsonb))<>'object' OR octet_length(coalesce(p_permissions,'{}'::jsonb)::text)>16000 THEN
    RAISE EXCEPTION 'Permissões inválidas.' USING errcode='22023';
  END IF;
  SELECT role INTO v_target_role FROM public.ks_company_memberships
    WHERE company_id=v_company_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado nesta empresa.' USING errcode='P0002'; END IF;
  IF v_target_role IN ('owner','admin') THEN RAISE EXCEPTION 'Acesso do proprietário e dos administradores protegidos.' USING errcode='42501'; END IF;
  UPDATE public.ks_company_memberships SET role=p_role,permissions=coalesce(p_permissions,'{}'::jsonb),status=p_status
    WHERE company_id=v_company_id AND user_id=p_user_id;
  RETURN jsonb_build_object('user_id',p_user_id,'role',p_role,'status',p_status,'permissions',coalesce(p_permissions,'{}'::jsonb));
END;
$function$;

-- Make invitations idempotent and validate the code before associating a new user.
CREATE OR REPLACE FUNCTION private.ks_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_company_id uuid;
  v_meta jsonb;
  v_plan text;
  v_trial boolean;
  v_legal jsonb;
  v_invitation_code text;
  v_invitation public.ks_team_invitations%ROWTYPE;
BEGIN
  v_meta:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
  v_invitation_code:=nullif(trim(v_meta->>'invitation_code'),'');
  INSERT INTO public.ks_profiles(user_id,full_name,phone)
  VALUES(new.id,v_meta->>'full_name',nullif(v_meta->>'phone',''))
  ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,updated_at=now();

  IF v_invitation_code IS NOT NULL THEN
    -- Wait for email confirmation before consuming the invitation.
    IF new.email_confirmed_at IS NULL THEN RETURN new; END IF;

    SELECT i.* INTO v_invitation
    FROM public.ks_team_invitations i
    WHERE lower(i.email)=lower(new.email)
      AND i.token_hash=encode(extensions.digest(convert_to(v_invitation_code,'UTF8'),'sha256'),'hex')
      AND i.accepted_at IS NULL AND i.expires_at>now()
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Código de convite inválido, expirado ou associado a outro email.' USING errcode='42501';
    END IF;
    IF v_invitation.role NOT IN ('manager','operator','cashier','accountant','gerente','operador','caixa','contabilista') THEN
      RAISE EXCEPTION 'O perfil deste convite não é permitido.' USING errcode='22023';
    END IF;
    IF EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.user_id=new.id AND m.status='active') THEN
      RAISE EXCEPTION 'Esta conta já está associada a uma empresa.' USING errcode='23505';
    END IF;
    INSERT INTO public.ks_company_memberships(company_id,user_id,role,status,permissions)
    VALUES(v_invitation.company_id,new.id,v_invitation.role,'active',coalesce(v_invitation.permissions,'{}'::jsonb));
    UPDATE public.ks_team_invitations SET accepted_by=new.id,accepted_at=now() WHERE id=v_invitation.id;
    RETURN new;
  END IF;

  -- Existing accounts must not receive a second company when the email-confirmation trigger runs.
  IF EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.user_id=new.id) THEN RETURN new; END IF;

  v_plan:=coalesce(nullif(v_meta->>'selected_plan',''),'trial');
  v_trial:=v_plan='trial';
  v_legal:=coalesce(v_meta->'legal_profile','{}'::jsonb);
  INSERT INTO public.ks_companies(owner_user_id,legal_name,trade_name,tax_id,phone,email,country_code,currency_code,tax_regime)
  VALUES(new.id,coalesce(nullif(v_meta->>'company_legal_name',''),'Empresa'),coalesce(nullif(v_meta->>'company_trade_name',''),'Empresa'),
    v_meta->>'company_tax_id',nullif(v_meta->>'phone',''),new.email,coalesce(v_meta->>'country_code','AO'),coalesce(v_meta->>'currency_code','AOA'),coalesce(v_meta->>'tax_regime','not_configured'))
  RETURNING id INTO v_company_id;
  INSERT INTO public.ks_company_memberships(company_id,user_id,role,status) VALUES(v_company_id,new.id,'owner','active');
  INSERT INTO public.ks_company_licenses(company_id,plan_code,status,starts_at,expires_at,max_invoices_override)
  VALUES(v_company_id,case when v_trial then 'trial' else v_plan end,case when v_trial then 'trial' else 'suspended' end,
    now(),case when v_trial then now()+interval '14 days' else null end,case when v_trial then 100 else null end);
  INSERT INTO public.ks_company_legal_profiles(company_id,legal_form,incorporation_date,commercial_registry_number,
    commercial_registry_date,publication_number,publication_date,publication_url,capital_amount,activity_code,
    activity_description,alvara_number,alvara_type,alvara_issue_date,alvara_expiry_date,inss_employer_number,
    registered_address,province,municipality,parish,commercial_entry_number,commercial_certificate_expires_at,
    registry_office,extra_data)
  VALUES(v_company_id,v_legal->>'legal_form',nullif(v_legal->>'incorporation_date','')::date,
    v_legal->>'commercial_registry_number',nullif(v_legal->>'commercial_registry_date','')::date,
    v_legal->>'publication_number',nullif(v_legal->>'publication_date','')::date,v_legal->>'publication_url',
    nullif(v_legal->>'capital_amount','')::numeric,v_legal->>'activity_code',v_legal->>'activity_description',
    v_legal->>'alvara_number',v_legal->>'alvara_type',nullif(v_legal->>'alvara_issue_date','')::date,
    nullif(v_legal->>'alvara_expiry_date','')::date,v_legal->>'inss_employer_number',
    v_legal->>'registered_address',v_legal->>'province',v_legal->>'municipality',v_legal->>'parish',
    v_legal->>'commercial_entry_number',nullif(v_legal->>'commercial_certificate_expires_at','')::date,
    v_legal->>'registry_office',jsonb_build_object('owner_identity_number',v_legal->>'owner_identity_number',
    'owner_nif',v_legal->>'owner_nif','owner_nationality',v_legal->>'owner_nationality'));
  IF nullif(v_legal->>'owner_identity_number','') IS NOT NULL THEN
    INSERT INTO public.ks_company_parties(company_id,party_type,full_name,identity_type,identity_number,nif,nationality,email,phone)
    VALUES(v_company_id,'representative',coalesce(v_meta->>'full_name','Representante'),'BI',
      v_legal->>'owner_identity_number',v_legal->>'owner_nif',coalesce(v_legal->>'owner_nationality','Angolana'),new.email,v_meta->>'phone');
  END IF;
  RETURN new;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.ks_tax_rule_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'AO',
  tax_type text NOT NULL,
  tax_group text,
  regime text,
  lower_bound numeric(20,2) NOT NULL DEFAULT 0,
  upper_bound numeric(20,2),
  fixed_amount numeric(20,2) NOT NULL DEFAULT 0,
  rate numeric(9,6) NOT NULL DEFAULT 0,
  excess_threshold numeric(20,2) NOT NULL DEFAULT 0,
  effective_from date NOT NULL,
  effective_to date,
  legal_reference text NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code,tax_type,tax_group,regime,effective_from,lower_bound)
);
ALTER TABLE public.ks_tax_rule_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ks_tax_rule_catalog_read ON public.ks_tax_rule_catalog;
CREATE POLICY ks_tax_rule_catalog_read ON public.ks_tax_rule_catalog
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ks_tax_rule_catalog_platform_write ON public.ks_tax_rule_catalog;
CREATE POLICY ks_tax_rule_catalog_platform_write ON public.ks_tax_rule_catalog
  FOR ALL TO authenticated USING (private.ks_is_platform_admin())
  WITH CHECK (private.ks_is_platform_admin());

INSERT INTO public.ks_tax_rule_catalog(country_code,tax_type,tax_group,regime,lower_bound,upper_bound,fixed_amount,rate,excess_threshold,effective_from,legal_reference,source_url)
VALUES
('AO','IRT','A','geral',0,150000,0,0,0,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',150000.01,200000,12500,0.16,150000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',200000.01,300000,31250,0.18,200000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',300000.01,500000,49250,0.19,300000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',500000.01,1000000,87250,0.20,500000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',1000000.01,1500000,187250,0.21,1000000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',1500000.01,2000000,292250,0.22,1500000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',2000000.01,2500000,402250,0.23,2000000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',2500000.01,5000000,517250,0.24,2500000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',5000000.01,10000000,1117250,0.245,5000000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf'),
('AO','IRT','A','geral',10000000.01,NULL,2342250,0.25,10000000,'2026-01-01','Lei n.º 14/25 — OGE 2026, Anexo I','https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw41/mje2/~edisp/minfin5216784.pdf')
ON CONFLICT DO NOTHING;

ALTER TABLE public.ks_tax_rules
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS legal_reference text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS tax_group text,
  ADD COLUMN IF NOT EXISTS regime text,
  ADD COLUMN IF NOT EXISTS fixed_amount numeric(20,2),
  ADD COLUMN IF NOT EXISTS excess_threshold numeric(20,2);

CREATE TABLE IF NOT EXISTS public.ks_tax_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  tax_type text NOT NULL CHECK (tax_type IN ('IVA','IRT_A','IRT_B','IRT_C','II','IS','IPU','RETENCAO')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  tax_regime text,
  taxable_base numeric(20,2) NOT NULL DEFAULT 0,
  tax_amount numeric(20,2) NOT NULL DEFAULT 0,
  tax_credit numeric(20,2) NOT NULL DEFAULT 0,
  payable_amount numeric(20,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','submitted','accepted','rejected')),
  submission_reference text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS ks_tax_returns_company_period_idx ON public.ks_tax_returns(company_id,period_start,period_end);
ALTER TABLE public.ks_tax_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ks_tax_returns_read ON public.ks_tax_returns;
CREATE POLICY ks_tax_returns_read ON public.ks_tax_returns
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','ver'));
DROP POLICY IF EXISTS ks_tax_returns_insert ON public.ks_tax_returns;
CREATE POLICY ks_tax_returns_insert ON public.ks_tax_returns
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','criar'));
DROP POLICY IF EXISTS ks_tax_returns_update ON public.ks_tax_returns;
CREATE POLICY ks_tax_returns_update ON public.ks_tax_returns
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','editar'));
DROP POLICY IF EXISTS ks_tax_returns_delete ON public.ks_tax_returns;
CREATE POLICY ks_tax_returns_delete ON public.ks_tax_returns
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','excluir'));

CREATE TABLE IF NOT EXISTS public.ks_tax_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  tax_return_id uuid NOT NULL REFERENCES public.ks_tax_returns(id) ON DELETE CASCADE,
  line_code text,
  description text NOT NULL,
  taxable_base numeric(20,2) NOT NULL DEFAULT 0,
  rate numeric(9,6) NOT NULL DEFAULT 0,
  amount numeric(20,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ks_tax_return_lines_return_idx ON public.ks_tax_return_lines(company_id,tax_return_id);
ALTER TABLE public.ks_tax_return_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ks_tax_return_lines_read ON public.ks_tax_return_lines;
CREATE POLICY ks_tax_return_lines_read ON public.ks_tax_return_lines
  FOR SELECT TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','ver'));
DROP POLICY IF EXISTS ks_tax_return_lines_insert ON public.ks_tax_return_lines;
CREATE POLICY ks_tax_return_lines_insert ON public.ks_tax_return_lines
  FOR INSERT TO authenticated WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','criar'));
DROP POLICY IF EXISTS ks_tax_return_lines_update ON public.ks_tax_return_lines;
CREATE POLICY ks_tax_return_lines_update ON public.ks_tax_return_lines
  FOR UPDATE TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','editar'))
  WITH CHECK (private.ks_has_company_permission(company_id,'fiscal','editar'));
DROP POLICY IF EXISTS ks_tax_return_lines_delete ON public.ks_tax_return_lines;
CREATE POLICY ks_tax_return_lines_delete ON public.ks_tax_return_lines
  FOR DELETE TO authenticated USING (private.ks_has_company_permission(company_id,'fiscal','excluir'));

CREATE OR REPLACE FUNCTION public.ks_accounting_reports(
  p_company_id uuid,p_from_date date,p_to_date date
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_to_date<p_from_date THEN
    RAISE EXCEPTION 'Período contabilístico inválido.' USING errcode='22023';
  END IF;
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','ver') THEN
    RAISE EXCEPTION 'Sem permissões para consultar os relatórios contabilísticos.' USING errcode='42501';
  END IF;
  WITH movements AS (
    SELECT l.account_id,
      coalesce(sum(l.debit-l.credit) FILTER (WHERE e.entry_date<p_from_date),0) AS opening_balance,
      coalesce(sum(l.debit) FILTER (WHERE e.entry_date BETWEEN p_from_date AND p_to_date),0) AS period_debit,
      coalesce(sum(l.credit) FILTER (WHERE e.entry_date BETWEEN p_from_date AND p_to_date),0) AS period_credit,
      coalesce(sum(l.debit-l.credit) FILTER (WHERE e.entry_date<=p_to_date),0) AS closing_balance
    FROM public.ks_journal_lines l
    JOIN public.ks_journal_entries e ON e.id=l.journal_entry_id AND e.company_id=l.company_id
    WHERE l.company_id=p_company_id AND e.status='posted' AND e.entry_date<=p_to_date
    GROUP BY l.account_id
  ), tb AS (
    SELECT a.id,a.account_code,a.name,a.account_type,a.normal_balance,
      coalesce(m.opening_balance,0) AS opening_balance,
      coalesce(m.period_debit,0) AS period_debit,
      coalesce(m.period_credit,0) AS period_credit,
      coalesce(m.closing_balance,0) AS closing_balance
    FROM public.ks_chart_of_accounts a
    LEFT JOIN movements m ON m.account_id=a.id
    WHERE a.company_id=p_company_id AND a.is_active
  ), totals AS (
    SELECT
      coalesce(sum(CASE WHEN account_type='asset' THEN closing_balance ELSE 0 END),0) AS assets,
      coalesce(sum(CASE WHEN account_type='liability' THEN -closing_balance ELSE 0 END),0) AS liabilities,
      coalesce(sum(CASE WHEN account_type='equity' THEN -closing_balance ELSE 0 END),0) AS equity,
      coalesce(sum(CASE WHEN account_type='income' THEN -closing_balance ELSE 0 END),0) AS income,
      coalesce(sum(CASE WHEN account_type='expense' THEN closing_balance ELSE 0 END),0) AS expenses
    FROM tb
  )
  SELECT jsonb_build_object(
    'period_start',p_from_date,'period_end',p_to_date,
    'trial_balance',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'account_code',account_code,'name',name,'account_type',account_type,'normal_balance',normal_balance,
      'opening_balance',opening_balance,'period_debit',period_debit,'period_credit',period_credit,
      'closing_balance',closing_balance
    ) ORDER BY account_code) FROM tb),'[]'::jsonb),
    'balance_sheet',(SELECT jsonb_build_object('assets',assets,'liabilities',liabilities,'equity',equity,
      'difference',assets-liabilities-equity) FROM totals),
    'income_statement',(SELECT jsonb_build_object('income',income,'expenses',expenses,'net_result',income-expenses) FROM totals),
    'ledger',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'entry_number',e.entry_number,'entry_date',e.entry_date,'description',e.description,
      'account_code',a.account_code,'account_name',a.name,'debit',l.debit,'credit',l.credit
    ) ORDER BY e.entry_date,e.entry_number,a.account_code)
    FROM public.ks_journal_lines l
    JOIN public.ks_journal_entries e ON e.id=l.journal_entry_id AND e.company_id=l.company_id
    JOIN public.ks_chart_of_accounts a ON a.id=l.account_id AND a.company_id=l.company_id
    WHERE l.company_id=p_company_id AND e.status='posted' AND e.entry_date BETWEEN p_from_date AND p_to_date
    LIMIT 500),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ks_seed_angola_chart_of_accounts(
  p_company_id uuid,p_accounts jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_account record; v_parent_id uuid; v_count integer:=0;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','editar') THEN
    RAISE EXCEPTION 'Sem permissões para importar o plano de contas.' USING errcode='42501';
  END IF;
  IF jsonb_typeof(p_accounts)<>'array' OR jsonb_array_length(p_accounts)<1 OR jsonb_array_length(p_accounts)>1000 THEN
    RAISE EXCEPTION 'O plano de contas enviado é inválido.' USING errcode='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.ks_chart_of_accounts WHERE company_id=p_company_id) THEN
    RAISE EXCEPTION 'Esta empresa já tem contas. A importação não substitui nem apaga contas existentes.' USING errcode='23505';
  END IF;
  FOR v_account IN
    SELECT * FROM jsonb_to_recordset(p_accounts) AS x(
      code text,name text,description text,pgc_class smallint,account_type text,
      normal_balance text,parent_code text,level smallint,is_group boolean,is_system boolean
    ) ORDER BY level,code
  LOOP
    IF nullif(trim(v_account.code),'') IS NULL OR nullif(trim(v_account.name),'') IS NULL
      OR v_account.account_type NOT IN ('asset','liability','equity','income','expense')
      OR v_account.normal_balance NOT IN ('debit','credit') THEN
      RAISE EXCEPTION 'Conta PGC inválida: %',v_account.code USING errcode='22023';
    END IF;
    v_parent_id:=NULL;
    IF v_account.parent_code IS NOT NULL THEN
      SELECT id INTO v_parent_id FROM public.ks_chart_of_accounts
      WHERE company_id=p_company_id AND account_code=v_account.parent_code;
    END IF;
    INSERT INTO public.ks_chart_of_accounts(
      company_id,account_code,name,description,account_type,parent_id,pgc_class,account_level,normal_balance,is_group,is_system,is_active
    ) VALUES (
      p_company_id,trim(v_account.code),trim(v_account.name),nullif(trim(v_account.description),''),
      v_account.account_type,v_parent_id,v_account.pgc_class,v_account.level,v_account.normal_balance,
      coalesce(v_account.is_group,false),true,true
    ) ON CONFLICT(company_id,account_code) DO NOTHING;
    v_count:=v_count+1;
  END LOOP;
  RETURN jsonb_build_object('inserted',v_count,'source','PGC Angola — Decreto n.º 82/01');
END;
$function$;

ALTER TABLE public.ks_company_integration_secrets
  DROP CONSTRAINT IF EXISTS ks_company_integration_secrets_provider_check;
ALTER TABLE public.ks_company_integration_secrets
  ADD CONSTRAINT ks_company_integration_secrets_provider_check
  CHECK (provider = ANY (ARRAY['meta','whatsapp','facebook','instagram','google','custom','agt']));
