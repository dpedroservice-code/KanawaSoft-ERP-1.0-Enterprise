-- Supplementary Angola registry fields and initial employer compliance references.
alter table public.ks_company_legal_profiles
 add column if not exists commercial_entry_number text,
 add column if not exists commercial_certificate_expires_at date,
 add column if not exists registry_office text,
 add column if not exists tax_registration_date date,
 add column if not exists tax_regime_effective_date date;
insert into public.ks_legal_register(company_id,jurisdiction,instrument_code,title,subject_area,source_url,status,notes)
values
(null,'AO','Lei 11/15 + DP 153/16 + DP 60/20 + DE 168/20','Publicação online dos actos das empresas no GUE','Registo comercial e publicidade societária','https://gue.gov.ao/portal/public/publicacoes','to_review','O GUE informa que a publicação online dispensa publicação no Diário da República. Registar referência/link da publicação GUE e confirmar regras aplicáveis a cada acto.'),
(null,'AO','Decreto Presidencial 295/20','Regime Jurídico de Vinculação e Contribuição da Protecção Social Obrigatória','INSS e contribuições sociais','https://portal.inss.gov.ao/','to_review','Registar número de inscrição da entidade empregadora, trabalhadores, datas de início e alterações; confirmar prazos e obrigações actuais.'),
(null,'AO','Lei 21/20','Alteração ao Código Geral Tributário','Fiscalidade e obrigações declarativas','https://portaldocontribuinte.minfin.gov.ao/legislacao','to_review','Consultar texto consolidado e alterações subsequentes no Portal do Contribuinte.'),
(null,'AO','Lei 14/23','Código do Imposto sobre o Valor Acrescentado (alterações e regime aplicável)','IVA e facturação','https://portaldocontribuinte.minfin.gov.ao/legislacao','to_review','Confirmar o texto vigente, periodicidade declarativa e obrigações por regime antes de automatizar declarações.')
on conflict do nothing;

-- Persist the owner/representative identity details supplied during company registration.
create or replace function public.ks_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_company_id uuid; v_meta jsonb; v_plan text; v_trial boolean; v_legal jsonb;
begin
 v_meta:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
 v_plan:=coalesce(nullif(v_meta->>'selected_plan',''),'trial');
 v_trial:=v_plan='trial';
 v_legal:=coalesce(v_meta->'legal_profile','{}'::jsonb);
 insert into public.ks_profiles(user_id,full_name,phone) values(new.id,v_meta->>'full_name',nullif(v_meta->>'phone',''))
 on conflict(user_id) do update set full_name=excluded.full_name,phone=excluded.phone,updated_at=now();
 insert into public.ks_companies(owner_user_id,legal_name,trade_name,tax_id,phone,email,country_code,currency_code,tax_regime)
 values(new.id,coalesce(nullif(v_meta->>'company_legal_name',''),'Empresa'),coalesce(nullif(v_meta->>'company_trade_name',''),'Empresa'),
 v_meta->>'company_tax_id',nullif(v_meta->>'phone',''),new.email,coalesce(v_meta->>'country_code','AO'),coalesce(v_meta->>'currency_code','AOA'),coalesce(v_meta->>'tax_regime','not_configured'))
 returning id into v_company_id;
 insert into public.ks_company_memberships(company_id,user_id,role,status) values(v_company_id,new.id,'owner','active');
 insert into public.ks_company_licenses(company_id,plan_code,status,starts_at,expires_at,max_invoices_override)
 values(v_company_id,case when v_trial then 'trial' else v_plan end,case when v_trial then 'trial' else 'suspended' end,
 now(),case when v_trial then now()+interval '14 days' else null end,case when v_trial then 100 else null end);
 insert into public.ks_company_legal_profiles(company_id,legal_form,incorporation_date,commercial_registry_number,
 commercial_registry_date,publication_number,publication_date,publication_url,capital_amount,activity_code,
 activity_description,alvara_number,alvara_type,alvara_issue_date,alvara_expiry_date,inss_employer_number,
 registered_address,province,municipality,parish,commercial_entry_number,commercial_certificate_expires_at,
 registry_office,extra_data)
 values(v_company_id,v_legal->>'legal_form',nullif(v_legal->>'incorporation_date','')::date,
 v_legal->>'commercial_registry_number',nullif(v_legal->>'commercial_registry_date','')::date,
 v_legal->>'publication_number',nullif(v_legal->>'publication_date','')::date,v_legal->>'publication_url',
 nullif(v_legal->>'capital_amount','')::numeric,v_legal->>'activity_code',v_legal->>'activity_description',
 v_legal->>'alvara_number',v_legal->>'alvara_type',nullif(v_legal->>'alvara_issue_date','')::date,
 nullif(v_legal->>'alvara_expiry_date','')::date,v_legal->>'inss_employer_number',
 v_legal->>'registered_address',v_legal->>'province',v_legal->>'municipality',v_legal->>'parish',
 v_legal->>'commercial_entry_number',nullif(v_legal->>'commercial_certificate_expires_at','')::date,
 v_legal->>'registry_office',jsonb_build_object('owner_identity_number',v_legal->>'owner_identity_number',
 'owner_nif',v_legal->>'owner_nif','owner_nationality',v_legal->>'owner_nationality'));
 if nullif(v_legal->>'owner_identity_number','') is not null then
  insert into public.ks_company_parties(company_id,party_type,full_name,identity_type,identity_number,nif,nationality,email,phone)
  values(v_company_id,'representative',coalesce(v_meta->>'full_name','Representante'),'BI',
   v_legal->>'owner_identity_number',v_legal->>'owner_nif',coalesce(v_legal->>'owner_nationality','Angolana'),new.email,v_meta->>'phone');
 end if;
 return new;
end $$;
