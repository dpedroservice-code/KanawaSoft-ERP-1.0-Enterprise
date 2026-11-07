alter table public.ks_leave_requests alter column leave_type_id drop not null;
-- Payroll employer contribution and employee-facing workflows.
alter table public.ks_payroll_items
 add column if not exists employer_social_security numeric(18,2) not null default 0,
 add column if not exists bonus numeric(18,2) not null default 0,
 add column if not exists allowances numeric(18,2) not null default 0;
drop policy if exists ks_calendar_events_manager_insert on public.ks_calendar_events;
create policy ks_calendar_events_member_insert on public.ks_calendar_events for insert to authenticated
 with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[])
 and (organizer_user_id is null or organizer_user_id=(select auth.uid())));
drop policy if exists ks_meetings_manager_insert on public.ks_meetings;
create policy ks_meetings_member_insert on public.ks_meetings for insert to authenticated
 with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[])
 and (organizer_user_id is null or organizer_user_id=(select auth.uid())));
drop policy if exists ks_internal_messages_manager_insert on public.ks_internal_messages;
create policy ks_internal_messages_member_insert on public.ks_internal_messages for insert to authenticated
 with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[])
 and sender_user_id=(select auth.uid()));
drop policy if exists ks_leave_requests_manager_insert on public.ks_leave_requests;
create policy ks_leave_requests_employee_insert on public.ks_leave_requests for insert to authenticated
 with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[])
 and (requested_by is null or requested_by=(select auth.uid())));
drop policy if exists ks_approval_requests_manager_insert on public.ks_approval_requests;
create policy ks_approval_requests_member_insert on public.ks_approval_requests for insert to authenticated
 with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[])
 and (requested_by is null or requested_by=(select auth.uid())));
drop policy if exists ks_payment_proofs_storage_read on storage.objects;
create policy ks_payment_proofs_storage_read on storage.objects for select to authenticated
 using(bucket_id='ks-payment-proofs' and (private.ks_is_platform_admin()
 or private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::text[])));
