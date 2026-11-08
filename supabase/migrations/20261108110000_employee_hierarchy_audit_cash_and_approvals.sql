-- Employee hierarchy, auditable operations, cash sessions and controlled sale cancellation.
ALTER TABLE public.ks_company_memberships
  ADD COLUMN IF NOT EXISTS supervisor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ks_team_invitations
  ADD COLUMN IF NOT EXISTS supervisor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ks_memberships_supervisor_idx
  ON public.ks_company_memberships(company_id, supervisor_user_id, status);
CREATE INDEX IF NOT EXISTS ks_team_invites_supervisor_idx
  ON public.ks_team_invitations(company_id, supervisor_user_id, expires_at);

CREATE OR REPLACE FUNCTION private.ks_can_invite_team_role(p_company_id uuid,p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ks_company_memberships m
    WHERE m.company_id=p_company_id AND m.user_id=auth.uid() AND m.status='active'
      AND (
        m.role IN ('owner','admin') AND p_role IN ('manager','operator','cashier','accountant','gerente','operador','caixa','contabilista')
        OR m.role IN ('manager','gerente') AND p_role IN ('operator','operador')
        OR m.role IN ('operator','operador') AND p_role IN ('cashier','caixa')
      )
  );
$function$;
REVOKE ALL ON FUNCTION private.ks_can_invite_team_role(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ks_can_invite_team_role(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ks_create_team_invitation(
  p_email text,p_full_name text,p_role text,p_permissions jsonb DEFAULT '{}'::jsonb,p_expires_hours integer DEFAULT 72
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_company_id uuid; v_code text; v_id uuid; v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão necessária.' USING errcode='42501'; END IF;
  SELECT m.company_id INTO v_company_id FROM public.ks_company_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active' ORDER BY m.created_at ASC LIMIT 1;
  IF v_company_id IS NULL OR NOT private.ks_can_invite_team_role(v_company_id,p_role) THEN
    RAISE EXCEPTION 'O seu perfil não pode convidar este tipo de colaborador.' USING errcode='42501';
  END IF;
  IF lower(trim(coalesce(p_email,''))) !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Email inválido.' USING errcode='22023';
  END IF;
  IF length(trim(coalesce(p_full_name,'')))<2 THEN RAISE EXCEPTION 'Informe o nome completo.' USING errcode='22023'; END IF;
  IF jsonb_typeof(coalesce(p_permissions,'{}'::jsonb))<>'object' OR octet_length(coalesce(p_permissions,'{}'::jsonb)::text)>16000 THEN
    RAISE EXCEPTION 'Permissões inválidas.' USING errcode='22023';
  END IF;
  IF coalesce(p_expires_hours,72) NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Validade inválida.' USING errcode='22023'; END IF;
  IF EXISTS(SELECT 1 FROM auth.users u WHERE lower(u.email)=lower(trim(p_email))) THEN
    RAISE EXCEPTION 'Este email já tem uma conta. Contacte o administrador.' USING errcode='23505';
  END IF;
  IF EXISTS(SELECT 1 FROM public.ks_team_invitations i WHERE i.company_id=v_company_id AND lower(i.email)=lower(trim(p_email)) AND i.accepted_at IS NULL AND i.expires_at>now()) THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este email.' USING errcode='23505';
  END IF;
  v_code:=encode(extensions.gen_random_bytes(24),'hex');
  v_expires:=now()+make_interval(hours=>coalesce(p_expires_hours,72));
  INSERT INTO public.ks_team_invitations(company_id,email,full_name,role,permissions,token_hash,expires_at,created_by,supervisor_user_id)
  VALUES(v_company_id,lower(trim(p_email)),trim(p_full_name),p_role,coalesce(p_permissions,'{}'::jsonb),
    encode(extensions.digest(convert_to(v_code,'UTF8'),'sha256'),'hex'),v_expires,auth.uid(),auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'email',lower(trim(p_email)),'invitation_code',v_code,'expires_at',v_expires);
END;
$function$;
REVOKE ALL ON FUNCTION public.ks_create_team_invitation(text,text,text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ks_create_team_invitation(text,text,text,jsonb,integer) TO authenticated;

DROP POLICY IF EXISTS ks_team_invitations_admin_insert ON public.ks_team_invitations;
DROP POLICY IF EXISTS ks_team_invitations_admin_read ON public.ks_team_invitations;
CREATE POLICY ks_team_invitations_hierarchy_insert ON public.ks_team_invitations
  FOR INSERT TO authenticated WITH CHECK (
    created_by=auth.uid() AND supervisor_user_id=auth.uid() AND accepted_at IS NULL
    AND expires_at>now() AND private.ks_can_invite_team_role(company_id,role)
  );
CREATE POLICY ks_team_invitations_hierarchy_read ON public.ks_team_invitations
  FOR SELECT TO authenticated USING (
    created_by=auth.uid() OR private.ks_has_company_role(company_id,ARRAY['owner','admin'])
  );

DROP POLICY IF EXISTS membership_read_team_supervisor ON public.ks_company_memberships;
CREATE POLICY membership_read_team_supervisor ON public.ks_company_memberships
  FOR SELECT TO authenticated USING (
    user_id=auth.uid()
    OR private.ks_has_company_role(company_id,ARRAY['owner','admin'])
    OR supervisor_user_id=auth.uid()
  );

CREATE OR REPLACE FUNCTION private.ks_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_company_id uuid; v_meta jsonb; v_plan text; v_trial boolean; v_legal jsonb;
  v_invitation_code text; v_invitation public.ks_team_invitations%ROWTYPE;
BEGIN
  v_meta:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
  v_invitation_code:=nullif(trim(v_meta->>'invitation_code'),'');
  INSERT INTO public.ks_profiles(user_id,full_name,phone)
  VALUES(new.id,v_meta->>'full_name',nullif(v_meta->>'phone',''))
  ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,updated_at=now();
  IF v_invitation_code IS NOT NULL THEN
    SELECT i.* INTO v_invitation FROM public.ks_team_invitations i
    WHERE lower(i.email)=lower(new.email)
      AND i.token_hash=encode(extensions.digest(convert_to(v_invitation_code,'UTF8'),'sha256'),'hex')
      AND i.accepted_at IS NULL AND i.expires_at>now() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Código de convite inválido, expirado ou associado a outro email.' USING errcode='42501'; END IF;
    IF v_invitation.role NOT IN ('manager','operator','cashier','accountant','gerente','operador','caixa','contabilista') THEN
      RAISE EXCEPTION 'Perfil de convite inválido.' USING errcode='22023';
    END IF;
    UPDATE public.ks_profiles SET full_name=v_invitation.full_name,updated_at=now() WHERE user_id=new.id;
    IF new.email_confirmed_at IS NULL THEN RETURN new; END IF;
    IF EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.user_id=new.id AND m.status='active') THEN
      RAISE EXCEPTION 'Esta conta já está associada a uma empresa.' USING errcode='23505';
    END IF;
    INSERT INTO public.ks_company_memberships(company_id,user_id,role,status,permissions,supervisor_user_id)
    VALUES(v_invitation.company_id,new.id,v_invitation.role,'active',coalesce(v_invitation.permissions,'{}'::jsonb),v_invitation.supervisor_user_id);
    UPDATE public.ks_team_invitations SET accepted_by=new.id,accepted_at=now() WHERE id=v_invitation.id;
    RETURN new;
  END IF;
  IF EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.user_id=new.id) THEN RETURN new; END IF;
  v_plan:=coalesce(nullif(v_meta->>'selected_plan',''),'trial'); v_trial:=v_plan='trial'; v_legal:=coalesce(v_meta->'legal_profile','{}'::jsonb);
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
    registered_address,province,municipality,parish,commercial_entry_number,commercial_certificate_expires_at,registry_office,extra_data)
  VALUES(v_company_id,v_legal->>'legal_form',nullif(v_legal->>'incorporation_date','')::date,v_legal->>'commercial_registry_number',
    nullif(v_legal->>'commercial_registry_date','')::date,v_legal->>'publication_number',nullif(v_legal->>'publication_date','')::date,
    v_legal->>'publication_url',nullif(v_legal->>'capital_amount','')::numeric,v_legal->>'activity_code',v_legal->>'activity_description',
    v_legal->>'alvara_number',v_legal->>'alvara_type',nullif(v_legal->>'alvara_issue_date','')::date,
    nullif(v_legal->>'alvara_expiry_date','')::date,v_legal->>'inss_employer_number',v_legal->>'registered_address',
    v_legal->>'province',v_legal->>'municipality',v_legal->>'parish',v_legal->>'commercial_entry_number',
    nullif(v_legal->>'commercial_certificate_expires_at','')::date,v_legal->>'registry_office',
    jsonb_build_object('owner_identity_number',v_legal->>'owner_identity_number','owner_nif',v_legal->>'owner_nif','owner_nationality',v_legal->>'owner_nationality'));
  IF nullif(v_legal->>'owner_identity_number','') IS NOT NULL THEN
    INSERT INTO public.ks_company_parties(company_id,party_type,full_name,identity_type,identity_number,nif,nationality,email,phone)
    VALUES(v_company_id,'representative',coalesce(v_meta->>'full_name','Representante'),'BI',v_legal->>'owner_identity_number',
      v_legal->>'owner_nif',coalesce(v_legal->>'owner_nationality','Angolana'),new.email,v_meta->>'phone');
  END IF;
  RETURN new;
END;
$function$;

-- Staff may write only their own audit events; administrators see all and team leads see their reporting chain.
DROP POLICY IF EXISTS ks_audit_events_insert ON public.ks_audit_events;
DROP POLICY IF EXISTS ks_audit_events_read ON public.ks_audit_events;
DROP POLICY IF EXISTS mg_ks_audit_events_sel ON public.ks_audit_events;
CREATE POLICY ks_audit_events_insert ON public.ks_audit_events
  FOR INSERT TO authenticated WITH CHECK (
    actor_user_id=auth.uid() AND EXISTS(
      SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=company_id AND m.user_id=auth.uid() AND m.status='active'
    ) AND octet_length(coalesce(details,'{}'::jsonb)::text)<=12000
  );
CREATE POLICY ks_audit_events_read ON public.ks_audit_events
  FOR SELECT TO authenticated USING (
    actor_user_id=auth.uid()
    OR private.ks_has_company_role(company_id,ARRAY['owner','admin'])
    OR (private.ks_has_company_role(company_id,ARRAY['manager','gerente']) AND EXISTS(
      SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=ks_audit_events.company_id AND m.user_id=ks_audit_events.actor_user_id
        AND (m.supervisor_user_id=auth.uid() OR m.supervisor_user_id IN (
          SELECT child.user_id FROM public.ks_company_memberships child
          WHERE child.company_id=ks_audit_events.company_id AND child.supervisor_user_id=auth.uid()
        ))
    ))
  );

CREATE TABLE IF NOT EXISTS public.ks_cash_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  cashier_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cashier_name text NOT NULL,
  supervisor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opening_float numeric(18,2) NOT NULL DEFAULT 0 CHECK(opening_float>=0),
  target_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(target_amount>=0),
  sales_total numeric(18,2) NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  expected_cash numeric(18,2) NOT NULL DEFAULT 0,
  counted_cash numeric(18,2),
  difference numeric(18,2),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  terminal_label text
);
CREATE UNIQUE INDEX IF NOT EXISTS ks_cash_sessions_one_open_per_cashier
  ON public.ks_cash_sessions(company_id,cashier_user_id) WHERE status='open';
CREATE INDEX IF NOT EXISTS ks_cash_sessions_company_opened_idx ON public.ks_cash_sessions(company_id,opened_at DESC);
ALTER TABLE public.ks_cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ks_cash_sessions_read ON public.ks_cash_sessions;
CREATE POLICY ks_cash_sessions_read ON public.ks_cash_sessions FOR SELECT TO authenticated USING (
  cashier_user_id=auth.uid() OR private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','operator','operador'])
);
DROP POLICY IF EXISTS ks_cash_sessions_insert ON public.ks_cash_sessions;
CREATE POLICY ks_cash_sessions_insert ON public.ks_cash_sessions FOR INSERT TO authenticated WITH CHECK (
  cashier_user_id=auth.uid() AND private.ks_has_company_role(company_id,ARRAY['cashier','caixa'])
);
DROP POLICY IF EXISTS ks_cash_sessions_update ON public.ks_cash_sessions;
CREATE POLICY ks_cash_sessions_update ON public.ks_cash_sessions FOR UPDATE TO authenticated USING (
  cashier_user_id=auth.uid() OR private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','operator','operador'])
) WITH CHECK (
  cashier_user_id=auth.uid() OR private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','operator','operador'])
);

ALTER TABLE public.ks_sales
  ADD COLUMN IF NOT EXISTS cashier_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.ks_cash_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE TABLE IF NOT EXISTS public.ks_sale_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  sale_external_id text NOT NULL,
  invoice_number text NOT NULL,
  cashier_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cashier_name text NOT NULL,
  reason text NOT NULL CHECK(length(trim(reason))>=5),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,sale_external_id,status) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS ks_sale_cancel_company_status_idx ON public.ks_sale_cancellation_requests(company_id,status,created_at DESC);
ALTER TABLE public.ks_sale_cancellation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ks_sale_cancel_read ON public.ks_sale_cancellation_requests FOR SELECT TO authenticated USING (
  cashier_user_id=auth.uid() OR private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','operator','operador'])
);
CREATE POLICY ks_sale_cancel_insert ON public.ks_sale_cancellation_requests FOR INSERT TO authenticated WITH CHECK (
  cashier_user_id=auth.uid() AND private.ks_has_company_role(company_id,ARRAY['cashier','caixa']) AND status='pending'
);
CREATE POLICY ks_sale_cancel_review ON public.ks_sale_cancellation_requests FOR UPDATE TO authenticated USING (
  private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','operator','operador'])
) WITH CHECK (
  private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','operator','operador'])
);

CREATE OR REPLACE FUNCTION public.ks_review_sale_cancellation(p_request_id uuid,p_approve boolean,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_req public.ks_sale_cancellation_requests%ROWTYPE; v_sale_id uuid; v_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão necessária.' USING errcode='42501'; END IF;
  SELECT m.company_id INTO v_company FROM public.ks_company_memberships m
    WHERE m.user_id=auth.uid() AND m.status='active' ORDER BY m.created_at LIMIT 1;
  IF v_company IS NULL OR NOT private.ks_has_company_role(v_company,ARRAY['owner','admin','manager','gerente','operator','operador']) THEN
    RAISE EXCEPTION 'Apenas operador, gerente ou administrador pode decidir cancelamentos.' USING errcode='42501';
  END IF;
  SELECT * INTO v_req FROM public.ks_sale_cancellation_requests
    WHERE id=p_request_id AND company_id=v_company AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido inexistente ou já processado.' USING errcode='P0002'; END IF;
  IF p_approve THEN
    UPDATE public.ks_sales SET status='cancelada',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=v_req.reason
      WHERE company_id=v_company AND external_id=v_req.sale_external_id RETURNING id INTO v_sale_id;
    IF v_sale_id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada no registo fiscal.' USING errcode='P0002'; END IF;
    UPDATE public.ks_records SET payload=jsonb_set(payload,'{status}','"cancelada"'::jsonb,true),updated_at=now()
      WHERE company_id=v_company AND store_key='vendas' AND record_id=v_req.sale_external_id;
  END IF;
  UPDATE public.ks_sale_cancellation_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),'') WHERE id=p_request_id;
  INSERT INTO public.ks_audit_events(company_id,actor_user_id,action,resource_type,resource_id,details)
  VALUES(v_company,auth.uid(),CASE WHEN p_approve THEN 'sale_cancelled' ELSE 'sale_cancellation_rejected' END,
    'sale',v_req.sale_external_id,jsonb_build_object('invoice_number',v_req.invoice_number,'cashier_user_id',v_req.cashier_user_id,'reason',v_req.reason,'review_note',p_note));
  RETURN jsonb_build_object('request_id',p_request_id,'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$function$;
REVOKE ALL ON FUNCTION public.ks_review_sale_cancellation(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_review_sale_cancellation(uuid,boolean,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.ks_commercial_approvals (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK(request_type IN ('price_override','service_price','quotation','sales_limit','discount')),
  reference_id text,
  description text NOT NULL,
  requested_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(requested_amount>=0),
  approved_amount numeric(18,2),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
ALTER TABLE public.ks_commercial_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY ks_commercial_approvals_read ON public.ks_commercial_approvals FOR SELECT TO authenticated USING (
  requested_by=auth.uid() OR private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','accountant','contabilista'])
);
CREATE POLICY ks_commercial_approvals_insert ON public.ks_commercial_approvals FOR INSERT TO authenticated WITH CHECK (
  requested_by=auth.uid() AND EXISTS(SELECT 1 FROM public.ks_company_memberships m WHERE m.company_id=company_id AND m.user_id=auth.uid() AND m.status='active')
);
CREATE POLICY ks_commercial_approvals_update ON public.ks_commercial_approvals FOR UPDATE TO authenticated USING (
  private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','accountant','contabilista'])
) WITH CHECK (
  private.ks_has_company_role(company_id,ARRAY['owner','admin','manager','gerente','accountant','contabilista'])
);
