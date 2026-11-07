-- Kanawa Soft 1.0: enterprise operations, Angola company registry, expiry alerts and licensing.
-- Apply only to the isolated Supabase project mhaynctedpyqjxdhdisv.
create extension if not exists pgcrypto;

alter table public.ks_saas_plans
  add column if not exists max_invoices_period integer not null default 500,
  add column if not exists billing_period text not null default 'monthly',
  add column if not exists duration_months integer not null default 1,
  add column if not exists display_order integer not null default 100,
  add column if not exists is_public boolean not null default false;
alter table public.ks_company_licenses
  add column if not exists max_invoices_override integer,
  add column if not exists term_months_override integer;

create table if not exists public.ks_company_legal_profiles (
 company_id uuid primary key references public.ks_companies(id) on delete cascade,
 legal_form text, incorporation_date date, commercial_registry_number text, commercial_registry_date date,
 publication_number text, publication_date date, publication_url text,
 capital_amount numeric(20,2), activity_code text, activity_description text,
 alvara_number text, alvara_type text, alvara_issue_date date, alvara_expiry_date date,
 inss_employer_number text, agt_taxpayer_status text, registered_address text,
 province text, municipality text, parish text, postal_code text,
 fiscal_year_start_month integer not null default 1 check(fiscal_year_start_month between 1 and 12),
 extra_data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_company_parties (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 party_type text not null check(party_type in ('shareholder','director','manager','representative','beneficial_owner','contact')),
 full_name text not null, identity_type text, identity_number text, nif text, nationality text,
 email text, phone text, ownership_percent numeric(7,4), appointment_date date, end_date date,
 document_path text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.ks_company_documents (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 document_type text not null, title text not null, document_number text,
 issued_at date, expires_at date, issuing_authority text, file_path text,
 status text not null default 'valid' check(status in ('valid','pending','expired','renewal_in_progress','archived')),
 reminder_days integer[] not null default array[90,60,30,15,7],
 responsible_user_id uuid references auth.users(id) on delete set null,
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_employee_documents (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 employee_id uuid not null references public.ks_employees(id) on delete cascade,
 document_type text not null, title text not null, document_number text,
 issued_at date, expires_at date, file_path text, status text not null default 'valid',
 reminder_days integer[] not null default array[60,30,15,7], notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ks_employee_compensation_history (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 employee_id uuid not null references public.ks_employees(id) on delete cascade,
 effective_from date not null, effective_to date, base_salary numeric(18,2) not null default 0,
 transport_allowance numeric(18,2) not null default 0, meal_allowance numeric(18,2) not null default 0,
 other_allowances numeric(18,2) not null default 0, recurring_bonus numeric(18,2) not null default 0,
 currency_code text not null default 'AOA', reason text, approved_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.ks_departments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, code text, manager_user_id uuid references auth.users(id), parent_department_id uuid references public.ks_departments(id),
 cost_center_code text, status text not null default 'active', created_at timestamptz not null default now(),
 unique(company_id,code)
);
create table if not exists public.ks_cost_centers (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 code text not null, name text not null, department_id uuid references public.ks_departments(id),
 budget_amount numeric(18,2) not null default 0, is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(company_id,code)
);
create table if not exists public.ks_leave_types (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 code text not null, name text not null, paid boolean not null default true,
 annual_days numeric(8,2), requires_document boolean not null default false,
 legal_reference text, active boolean not null default true, created_at timestamptz not null default now(),
 unique(company_id,code)
);
create table if not exists public.ks_leave_balances (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 employee_id uuid not null references public.ks_employees(id) on delete cascade,
 leave_type_id uuid not null references public.ks_leave_types(id) on delete cascade,
 year integer not null, entitled_days numeric(8,2) not null default 0,
 used_days numeric(8,2) not null default 0, carried_days numeric(8,2) not null default 0,
 updated_at timestamptz not null default now(), unique(company_id,employee_id,leave_type_id,year)
);
create table if not exists public.ks_leave_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 employee_id uuid not null references public.ks_employees(id) on delete cascade,
 leave_type_id uuid not null references public.ks_leave_types(id),
 starts_on date not null, ends_on date not null, requested_days numeric(8,2) not null,
 reason text, evidence_path text, status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 requested_by uuid references auth.users(id), decided_by uuid references auth.users(id), decided_at timestamptz,
 decision_note text, created_at timestamptz not null default now(), check(ends_on >= starts_on)
);
create table if not exists public.ks_general_expenses (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 expense_number text, category text not null, description text not null, supplier_name text,
 amount numeric(18,2) not null check(amount >= 0), tax_amount numeric(18,2) not null default 0,
 currency_code text not null default 'AOA', incurred_on date not null default current_date,
 due_on date, paid_at timestamptz, payment_method text, cost_center_id uuid references public.ks_cost_centers(id),
 project_id uuid references public.ks_projects(id), receipt_path text, status text not null default 'pending',
 submitted_by uuid references auth.users(id), approved_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.ks_calendar_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 title text not null, description text, event_type text not null default 'event',
 starts_at timestamptz not null, ends_at timestamptz, all_day boolean not null default false,
 location text, organizer_user_id uuid references auth.users(id), visibility text not null default 'company',
 status text not null default 'scheduled', recurrence_rule text, reminder_minutes integer[] not null default array[1440,60,15],
 related_record_type text, related_record_id text, created_at timestamptz not null default now()
);
create table if not exists public.ks_meetings (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 title text not null, agenda text, meeting_type text not null default 'internal',
 starts_at timestamptz not null, ends_at timestamptz, location text, meeting_url text,
 organizer_user_id uuid references auth.users(id), minutes text, decisions jsonb not null default '[]'::jsonb,
 status text not null default 'scheduled', created_at timestamptz not null default now()
);
create table if not exists public.ks_meeting_attendees (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 meeting_id uuid not null references public.ks_meetings(id) on delete cascade,
 user_id uuid references auth.users(id), external_name text, email text,
 attendance_status text not null default 'invited', response_at timestamptz,
 unique(meeting_id,user_id)
);
create table if not exists public.ks_communication_channels (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, channel_type text not null default 'group', created_by uuid references auth.users(id),
 is_private boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.ks_internal_messages (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 channel_id uuid references public.ks_communication_channels(id) on delete cascade,
 sender_user_id uuid not null references auth.users(id), recipient_user_id uuid references auth.users(id),
 body text not null, attachment_path text, reply_to_id uuid references public.ks_internal_messages(id),
 edited_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.ks_shared_files (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 title text not null, description text, file_path text not null, category text,
 shared_by uuid references auth.users(id), visibility text not null default 'company',
 expires_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.ks_approval_workflows (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 code text not null, name text not null, entity_type text not null,
 threshold_amount numeric(18,2), steps jsonb not null default '[]'::jsonb,
 active boolean not null default true, created_at timestamptz not null default now(),
 unique(company_id,code)
);
create table if not exists public.ks_approval_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 workflow_id uuid references public.ks_approval_workflows(id), entity_type text not null, entity_id text not null,
 title text not null, amount numeric(18,2), requested_by uuid references auth.users(id),
 current_step integer not null default 1, status text not null default 'pending',
 submitted_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.ks_approval_steps (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 request_id uuid not null references public.ks_approval_requests(id) on delete cascade,
 step_number integer not null, approver_user_id uuid references auth.users(id),
 decision text not null default 'pending', note text, decided_at timestamptz,
 unique(request_id,step_number)
);
create table if not exists public.ks_work_centers (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 code text not null, name text not null, location text, capacity_per_shift numeric(18,3),
 shifts_per_day numeric(8,2) not null default 1, hourly_cost numeric(18,2) not null default 0,
 status text not null default 'active', created_at timestamptz not null default now(), unique(company_id,code)
);
create table if not exists public.ks_manufacturing_routings (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 product_id uuid references public.ks_products(id), version text not null default '1',
 operations jsonb not null default '[]'::jsonb, setup_minutes numeric(12,2) not null default 0,
 run_minutes_per_unit numeric(12,4) not null default 0, active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_maintenance_plans (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 asset_id uuid references public.ks_assets(id), vehicle_id uuid references public.ks_vehicles(id),
 title text not null, interval_days integer, interval_hours numeric(12,2),
 last_service_at date, next_service_at date, checklist jsonb not null default '[]'::jsonb,
 assigned_user_id uuid references auth.users(id), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_budgets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 name text not null, fiscal_year integer not null, period_type text not null default 'annual',
 department_id uuid references public.ks_departments(id), cost_center_id uuid references public.ks_cost_centers(id),
 approved_amount numeric(18,2) not null default 0, status text not null default 'draft',
 created_at timestamptz not null default now(), unique(company_id,name,fiscal_year)
);
create table if not exists public.ks_budget_lines (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 budget_id uuid not null references public.ks_budgets(id) on delete cascade,
 account_code text, description text not null, period_month integer check(period_month between 1 and 12),
 planned_amount numeric(18,2) not null default 0, actual_amount numeric(18,2) not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.ks_payment_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 plan_code text not null references public.ks_saas_plans(plan_code), duration_months integer not null check(duration_months in (1,12,24,36)),
 amount numeric(18,2) not null, currency_code text not null default 'AOA',
 payment_method text not null check(payment_method in ('bank_transfer','card','multicaixa_express','cash_without_card')),
 transaction_reference text, proof_path text, status text not null default 'pending',
 requested_by uuid references auth.users(id), reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 review_note text, created_at timestamptz not null default now()
);
create table if not exists public.ks_license_keys (
 id uuid primary key default gen_random_uuid(), key_hash text not null unique, key_prefix text not null,
 plan_code text not null references public.ks_saas_plans(plan_code), duration_months integer not null check(duration_months in (1,12,24,36)),
 max_invoices_period integer not null, max_users integer not null, status text not null default 'issued',
 expires_at timestamptz, issued_by uuid references auth.users(id), redeemed_by_company uuid references public.ks_companies(id),
 redeemed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.ks_license_activation_audit (
 id uuid primary key default gen_random_uuid(), company_id uuid references public.ks_companies(id) on delete cascade,
 license_id uuid references public.ks_company_licenses(id) on delete set null,
 action text not null, actor_user_id uuid references auth.users(id), metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

-- Starter plan catalogue. Prices are proposed editable defaults; do not publish payment collection until approved.
insert into public.ks_saas_plans(plan_code,name,price,currency_code,max_users,max_installations,max_invoices_period,billing_period,duration_months,display_order,is_public,features)
values
 ('trial','Teste gratuito 14 dias',0,'AOA',3,2,100,'monthly',1,0,true,'{"all_modules":true,"trial_days":14,"read_only_after_expiry":true}'::jsonb),
 ('mini','Mini',15000,'AOA',3,2,500,'monthly',1,1,true,'{"recommended_for":"micro and small business","proposed_price":true}'::jsonb),
 ('standard','Standard',35000,'AOA',10,5,2500,'monthly',1,2,true,'{"recommended_for":"small and medium business","proposed_price":true}'::jsonb),
 ('premium','Premium',75000,'AOA',30,15,10000,'monthly',1,3,true,'{"recommended_for":"large business and multi-branch","proposed_price":true}'::jsonb),
 ('enterprise','Enterprise',0,'AOA',100,50,50000,'monthly',1,4,true,'{"recommended_for":"industry and enterprise","custom_quote":true}'::jsonb)
on conflict(plan_code) do update set max_invoices_period=excluded.max_invoices_period,
 billing_period=excluded.billing_period,duration_months=excluded.duration_months,
 display_order=excluded.display_order,is_public=excluded.is_public,features=excluded.features;

-- Tenant RLS. Business data is visible only to active members of the same company.
do $$
declare t text;
begin
 foreach t in array array[
 'ks_company_legal_profiles','ks_company_parties','ks_company_documents','ks_employee_documents',
 'ks_employee_compensation_history','ks_departments','ks_cost_centers','ks_leave_types',
 'ks_leave_balances','ks_leave_requests','ks_general_expenses','ks_calendar_events','ks_meetings',
 'ks_meeting_attendees','ks_communication_channels','ks_internal_messages','ks_shared_files',
 'ks_approval_workflows','ks_approval_requests','ks_approval_steps','ks_work_centers',
 'ks_manufacturing_routings','ks_maintenance_plans','ks_budgets','ks_budget_lines',
 'ks_license_activation_audit'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I on public.%I for select to authenticated using (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'',''cashier'',''caixa'',''operator'',''operador'']::text[]))',t||'_member_read',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'']::text[]))',t||'_manager_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'']::text[])) with check (private.ks_has_company_role(company_id,array[''owner'',''admin'',''manager'',''gerente'']::text[]))',t||'_manager_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (private.ks_has_company_role(company_id,array[''owner'',''admin'']::text[]))',t||'_admin_delete',t);
 end loop;
end $$;

alter table public.ks_license_keys enable row level security;
revoke all on public.ks_license_keys from anon, authenticated;
create policy ks_payment_requests_member_read on public.ks_payment_requests for select to authenticated
 using(private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_payment_requests_owner_insert on public.ks_payment_requests for insert to authenticated
 with check(requested_by=(select auth.uid()) and private.ks_has_company_role(company_id,array['owner','admin']::text[]));
create policy ks_payment_requests_platform_admin_read on public.ks_payment_requests for select to authenticated
 using(private.ks_is_platform_admin());
create policy ks_payment_requests_admin_update on public.ks_payment_requests for update to authenticated
 using(private.ks_is_platform_admin()) with check(private.ks_is_platform_admin());

-- Private document and payment-proof storage; path starts with the company UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ks-company-documents','ks-company-documents',false,15728640,
 array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ks-payment-proofs','ks-payment-proofs',false,10485760,
 array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy ks_company_docs_storage_read on storage.objects for select to authenticated
 using(bucket_id='ks-company-documents' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin','manager','gerente']::text[]));
create policy ks_company_docs_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='ks-company-documents' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin','manager','gerente']::text[]));
create policy ks_company_docs_storage_update on storage.objects for update to authenticated
 using(bucket_id='ks-company-documents' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin','manager','gerente']::text[]))
 with check(bucket_id='ks-company-documents' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin','manager','gerente']::text[]));
create policy ks_payment_proofs_storage_read on storage.objects for select to authenticated
 using(bucket_id='ks-payment-proofs' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::text[]));
create policy ks_payment_proofs_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='ks-payment-proofs' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::text[]));

-- Platform-admin-only key issuance. The plaintext key is returned exactly once; only its SHA-256 hash is stored.
create or replace function public.ks_issue_license_key(p_plan_code text,p_duration_months integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_key text; v_plan public.ks_saas_plans%rowtype; v_id uuid;
begin
 if not private.ks_is_platform_admin() then raise exception 'Apenas o administrador da plataforma pode emitir chaves'; end if;
 if p_duration_months not in (1,12,24,36) then raise exception 'Duração inválida'; end if;
 select * into v_plan from public.ks_saas_plans where plan_code=p_plan_code and is_active=true;
 if not found then raise exception 'Pacote não encontrado'; end if;
 v_key := 'KANAWA-' || upper(encode(gen_random_bytes(4),'hex')) || '-' || upper(encode(gen_random_bytes(4),'hex')) || '-' || upper(encode(gen_random_bytes(4),'hex'));
 insert into public.ks_license_keys(key_hash,key_prefix,plan_code,duration_months,max_invoices_period,max_users,issued_by,expires_at)
 values(encode(digest(v_key,'sha256'),'hex'),left(v_key,12),p_plan_code,p_duration_months,v_plan.max_invoices_period,v_plan.max_users,(select auth.uid()),now()+interval '90 days')
 returning id into v_id;
 return jsonb_build_object('id',v_id,'license_key',v_key,'plan_code',p_plan_code,'duration_months',p_duration_months,'max_invoices_period',v_plan.max_invoices_period);
end $$;

create or replace function public.ks_redeem_license_key(p_license_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_key public.ks_license_keys%rowtype; v_license_id uuid;
begin
 select company_id into v_company from public.ks_company_memberships
 where user_id=(select auth.uid()) and status='active' and role in ('owner','admin') order by created_at limit 1;
 if v_company is null then raise exception 'Apenas o proprietário ou administrador da empresa pode ativar a licença'; end if;
 select * into v_key from public.ks_license_keys
 where key_hash=encode(digest(trim(p_license_key),'sha256'),'hex') for update;
 if not found or v_key.status <> 'issued' or v_key.expires_at <= now() then raise exception 'Chave inválida, expirada ou já utilizada'; end if;
 insert into public.ks_company_licenses(company_id,plan_code,status,starts_at,expires_at,max_users_override,max_invoices_override,term_months_override)
 values(v_company,v_key.plan_code,'active',now(),now()+make_interval(months=>v_key.duration_months),v_key.max_users,v_key.max_invoices_period,v_key.duration_months)
 returning id into v_license_id;
 update public.ks_license_keys set status='redeemed',redeemed_by_company=v_company,redeemed_at=now() where id=v_key.id;
 update public.ks_payment_requests set status='approved',reviewed_at=now()
 where company_id=v_company and plan_code=v_key.plan_code and status='pending';
 insert into public.ks_license_activation_audit(company_id,license_id,action,actor_user_id,metadata)
 values(v_company,v_license_id,'license_redeemed',(select auth.uid()),jsonb_build_object('plan_code',v_key.plan_code,'duration_months',v_key.duration_months,'key_prefix',v_key.key_prefix));
 return jsonb_build_object('success',true,'plan_code',v_key.plan_code,'expires_at',now()+make_interval(months=>v_key.duration_months),'max_invoices_period',v_key.max_invoices_period);
end $$;
revoke all on function public.ks_issue_license_key(text,integer) from public, anon;
revoke all on function public.ks_redeem_license_key(text) from public, anon;
grant execute on function public.ks_issue_license_key(text,integer) to authenticated;
grant execute on function public.ks_redeem_license_key(text) to authenticated;

-- Include company legal registration metadata from the one-time onboarding wizard.
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
 registered_address,province,municipality,parish,extra_data)
 values(v_company_id,v_legal->>'legal_form',nullif(v_legal->>'incorporation_date','')::date,
 v_legal->>'commercial_registry_number',nullif(v_legal->>'commercial_registry_date','')::date,
 v_legal->>'publication_number',nullif(v_legal->>'publication_date','')::date,v_legal->>'publication_url',
 nullif(v_legal->>'capital_amount','')::numeric,v_legal->>'activity_code',v_legal->>'activity_description',
 v_legal->>'alvara_number',v_legal->>'alvara_type',nullif(v_legal->>'alvara_issue_date','')::date,
 nullif(v_legal->>'alvara_expiry_date','')::date,v_legal->>'inss_employer_number',
 v_legal->>'registered_address',v_legal->>'province',v_legal->>'municipality',v_legal->>'parish',
 coalesce(v_legal->'extra_data','{}'::jsonb));
 return new;
end $$;

-- Invoice creation is blocked after trial expiry, subscription expiry, suspension or quota exhaustion.
-- Existing data remains readable/exportable; only finalizing a new sale/invoice is stopped.
create or replace function public.ks_finalize_sale(p_company_id uuid,p_sale jsonb,p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
 v_sale_id uuid; v_item jsonb; v_product public.ks_products%rowtype; v_qty numeric;
 v_license public.ks_company_licenses%rowtype; v_plan public.ks_saas_plans%rowtype;
 v_limit integer; v_used integer;
begin
 if not private.ks_has_company_role(p_company_id,array['owner','admin','manager','gerente','cashier','caixa']::text[]) then
  raise exception 'Sem permissão para finalizar vendas';
 end if;
 insert into public.ks_sales(company_id,external_id,invoice_number,customer_name,customer_tax_id,customer_phone,subtotal,discount_value,tax_amount,total,amount_received,change_amount,payment_method,tax_regime,status,notes,operator_name,sold_at)
 values(p_company_id,p_sale->>'external_id',coalesce(p_sale->>'invoice_number','FT'),p_sale->>'customer_name',p_sale->>'customer_tax_id',p_sale->>'customer_phone',
 coalesce((p_sale->>'subtotal')::numeric,0),coalesce((p_sale->>'discount_value')::numeric,0),coalesce((p_sale->>'tax_amount')::numeric,0),coalesce((p_sale->>'total')::numeric,0),
 coalesce((p_sale->>'amount_received')::numeric,0),coalesce((p_sale->>'change_amount')::numeric,0),p_sale->>'payment_method',p_sale->>'tax_regime','finalizada',p_sale->>'notes',p_sale->>'operator_name',coalesce((p_sale->>'sold_at')::timestamptz,now()))
 on conflict(company_id,external_id) do update set external_id=excluded.external_id returning id into v_sale_id;
 if exists(select 1 from public.ks_sale_items where sale_id=v_sale_id) then return v_sale_id; end if;

 select * into v_license from public.ks_company_licenses where company_id=p_company_id order by created_at desc limit 1 for update;
 if not found or v_license.status not in ('trial','active') then raise exception 'LICENCE_REQUIRED: a licença não está activa. Solicite uma chave de activação.'; end if;
 if v_license.expires_at is null or v_license.expires_at <= now() then raise exception 'LICENCE_EXPIRED: o período de utilização terminou. As consultas e exportações continuam disponíveis; active uma licença para emitir novas facturas.'; end if;
 select * into v_plan from public.ks_saas_plans where plan_code=v_license.plan_code;
 v_limit:=coalesce(v_license.max_invoices_override,v_plan.max_invoices_period,0);
 select coalesce(sum(invoices_count),0)::integer into v_used from public.ks_license_usage_daily
 where company_id=p_company_id and usage_date >= date_trunc('month',now())::date;
 if v_limit > 0 and v_used >= v_limit then raise exception 'INVOICE_QUOTA_REACHED: o pacote atingiu o limite de facturas deste mês. Actualize o pacote ou aguarde o próximo período.'; end if;

 for v_item in select * from jsonb_array_elements(p_items) loop
  v_qty := (v_item->>'quantity')::numeric;
  if coalesce((v_item->>'stock_tracked')::boolean,true) then
   select * into v_product from public.ks_products where company_id=p_company_id and external_id=v_item->>'product_external_id' for update;
   if not found then raise exception 'Produto não encontrado: %',v_item->>'product_external_id'; end if;
   if v_product.stock_quantity < v_qty then raise exception 'Stock insuficiente para % (disponível %, solicitado %)',v_product.name,v_product.stock_quantity,v_qty; end if;
   update public.ks_products set stock_quantity=stock_quantity-v_qty,updated_at=now() where id=v_product.id;
  end if;
  insert into public.ks_sale_items(sale_id,company_id,product_external_id,product_name,quantity,unit_price,line_total,stock_tracked)
  values(v_sale_id,p_company_id,v_item->>'product_external_id',coalesce(v_item->>'product_name','Artigo'),v_qty,
  coalesce((v_item->>'unit_price')::numeric,0),coalesce((v_item->>'line_total')::numeric,0),coalesce((v_item->>'stock_tracked')::boolean,true));
 end loop;
 insert into public.ks_license_usage_daily(company_id,usage_date,invoices_count) values(p_company_id,current_date,1)
 on conflict(company_id,usage_date) do update set invoices_count=public.ks_license_usage_daily.invoices_count+1;
 return v_sale_id;
end $$;

create or replace function public.ks_get_company_entitlements(p_company_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'company_id',p_company_id,
  'license',(select to_jsonb(l)-'license_key' from public.ks_company_licenses l where l.company_id=p_company_id order by l.created_at desc limit 1),
  'plan',(select to_jsonb(p) from public.ks_saas_plans p join public.ks_company_licenses l on l.plan_code=p.plan_code where l.company_id=p_company_id order by l.created_at desc limit 1),
  'invoice_limit',(select coalesce(l.max_invoices_override,p.max_invoices_period) from public.ks_company_licenses l join public.ks_saas_plans p on p.plan_code=l.plan_code where l.company_id=p_company_id order by l.created_at desc limit 1),
  'invoice_usage',(select coalesce(sum(u.invoices_count),0) from public.ks_license_usage_daily u where u.company_id=p_company_id and u.usage_date>=date_trunc('month',now())::date),
  'read_only',not exists(select 1 from public.ks_company_licenses l where l.company_id=p_company_id and l.status in ('trial','active') and l.expires_at>now())
 );
$$;

grant execute on function public.ks_get_company_entitlements(uuid) to authenticated;
