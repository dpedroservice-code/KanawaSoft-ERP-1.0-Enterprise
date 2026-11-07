
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
    -- Validate immediately at sign-up, but consume the invitation only after email confirmation.
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
    UPDATE public.ks_profiles SET full_name=v_invitation.full_name,updated_at=now() WHERE user_id=new.id;
    IF new.email_confirmed_at IS NULL THEN RETURN new; END IF;

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
