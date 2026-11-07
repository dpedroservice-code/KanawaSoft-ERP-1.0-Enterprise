-- Resolve the remaining public-table RLS gap and reduce duplicate permissive policies.
alter table public.ks_payment_requests enable row level security;
drop policy if exists ks_payment_requests_member_read on public.ks_payment_requests;
drop policy if exists ks_payment_requests_platform_admin_read on public.ks_payment_requests;
create policy ks_payment_requests_select_authorized on public.ks_payment_requests for select to authenticated
 using(private.ks_is_platform_admin() or private.ks_has_company_role(company_id,array['owner','admin']::text[]));

drop policy if exists ks_payroll_items_tenant_select on public.ks_payroll_items;
drop policy if exists ks_payroll_runs_tenant_select on public.ks_payroll_runs;

drop policy if exists ks_knowledge_articles_manage on public.ks_knowledge_articles;
create policy ks_knowledge_articles_manager_insert on public.ks_knowledge_articles for insert to authenticated
 with check(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_knowledge_articles_manager_update on public.ks_knowledge_articles for update to authenticated
 using(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]))
 with check(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_knowledge_articles_manager_delete on public.ks_knowledge_articles for delete to authenticated
 using(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));

drop policy if exists ks_legal_register_manage on public.ks_legal_register;
create policy ks_legal_register_manager_insert on public.ks_legal_register for insert to authenticated
 with check(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_legal_register_manager_update on public.ks_legal_register for update to authenticated
 using(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]))
 with check(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));
create policy ks_legal_register_manager_delete on public.ks_legal_register for delete to authenticated
 using(company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]));

-- Move the existing product sync SECURITY DEFINER implementation to the private schema.
alter function public.ks_sync_product(uuid,jsonb) set schema private;
grant usage on schema private to authenticated;
revoke all on function private.ks_sync_product(uuid,jsonb) from public,anon;
grant execute on function private.ks_sync_product(uuid,jsonb) to authenticated;
create or replace function public.ks_sync_product(p_company_id uuid,p_product jsonb)
returns uuid language sql security invoker set search_path = '' as $$
 select private.ks_sync_product(p_company_id,p_product);
$$;
revoke all on function public.ks_sync_product(uuid,jsonb) from public,anon;
grant execute on function public.ks_sync_product(uuid,jsonb) to authenticated;

-- Cover new tenant and foreign-key access paths with indexes for both RLS and normal queries.
create index if not exists ix_ks_company_parties_company on public.ks_company_parties(company_id);
create index if not exists ix_ks_company_documents_expiry on public.ks_company_documents(company_id,expires_at);
create index if not exists ix_ks_company_documents_responsible on public.ks_company_documents(responsible_user_id);
create index if not exists ix_ks_employee_documents_employee_expiry on public.ks_employee_documents(company_id,employee_id,expires_at);
create index if not exists ix_ks_employee_comp_employee_effective on public.ks_employee_compensation_history(company_id,employee_id,effective_from desc);
create index if not exists ix_ks_employee_comp_approver on public.ks_employee_compensation_history(approved_by);
create index if not exists ix_ks_departments_parent on public.ks_departments(company_id,parent_department_id);
create index if not exists ix_ks_departments_manager on public.ks_departments(manager_user_id);
create index if not exists ix_ks_cost_centers_department on public.ks_cost_centers(company_id,department_id);
create index if not exists ix_ks_leave_balances_employee_type on public.ks_leave_balances(company_id,employee_id,leave_type_id,year);
create index if not exists ix_ks_leave_requests_employee_dates on public.ks_leave_requests(company_id,employee_id,starts_on,ends_on);
create index if not exists ix_ks_leave_requests_type on public.ks_leave_requests(leave_type_id);
create index if not exists ix_ks_leave_requests_requested_by on public.ks_leave_requests(requested_by);
create index if not exists ix_ks_leave_requests_decided_by on public.ks_leave_requests(decided_by);
create index if not exists ix_ks_general_expenses_cost_center on public.ks_general_expenses(company_id,cost_center_id);
create index if not exists ix_ks_general_expenses_project on public.ks_general_expenses(company_id,project_id);
create index if not exists ix_ks_general_expenses_submitter on public.ks_general_expenses(submitted_by);
create index if not exists ix_ks_general_expenses_approver on public.ks_general_expenses(approved_by);
create index if not exists ix_ks_calendar_events_schedule on public.ks_calendar_events(company_id,starts_at);
create index if not exists ix_ks_calendar_events_organizer on public.ks_calendar_events(organizer_user_id);
create index if not exists ix_ks_meetings_schedule on public.ks_meetings(company_id,starts_at);
create index if not exists ix_ks_meetings_organizer on public.ks_meetings(organizer_user_id);
create index if not exists ix_ks_meeting_attendees_meeting on public.ks_meeting_attendees(company_id,meeting_id);
create index if not exists ix_ks_meeting_attendees_user on public.ks_meeting_attendees(user_id);
create index if not exists ix_ks_channels_creator on public.ks_communication_channels(created_by);
create index if not exists ix_ks_internal_messages_channel on public.ks_internal_messages(company_id,channel_id,created_at desc);
create index if not exists ix_ks_internal_messages_sender on public.ks_internal_messages(sender_user_id);
create index if not exists ix_ks_internal_messages_recipient on public.ks_internal_messages(recipient_user_id);
create index if not exists ix_ks_internal_messages_reply on public.ks_internal_messages(reply_to_id);
create index if not exists ix_ks_shared_files_shared_by on public.ks_shared_files(shared_by);
create index if not exists ix_ks_approval_requests_workflow on public.ks_approval_requests(company_id,workflow_id);
create index if not exists ix_ks_approval_requests_submitter on public.ks_approval_requests(requested_by);
create index if not exists ix_ks_approval_steps_approver on public.ks_approval_steps(approver_user_id);
create index if not exists ix_ks_manufacturing_routings_product on public.ks_manufacturing_routings(company_id,product_id);
create index if not exists ix_ks_maintenance_plans_asset on public.ks_maintenance_plans(company_id,asset_id);
create index if not exists ix_ks_maintenance_plans_vehicle on public.ks_maintenance_plans(company_id,vehicle_id);
create index if not exists ix_ks_maintenance_plans_assignee on public.ks_maintenance_plans(assigned_user_id);
create index if not exists ix_ks_budgets_department on public.ks_budgets(company_id,department_id);
create index if not exists ix_ks_budgets_cost_center on public.ks_budgets(company_id,cost_center_id);
create index if not exists ix_ks_payment_requests_company_created on public.ks_payment_requests(company_id,created_at desc);
create index if not exists ix_ks_payment_requests_plan on public.ks_payment_requests(plan_code);
create index if not exists ix_ks_payment_requests_requested_by on public.ks_payment_requests(requested_by);
create index if not exists ix_ks_payment_requests_reviewed_by on public.ks_payment_requests(reviewed_by);
create index if not exists ix_ks_license_keys_plan on public.ks_license_keys(plan_code);
create index if not exists ix_ks_license_keys_issued_by on public.ks_license_keys(issued_by);
create index if not exists ix_ks_license_keys_redeemed_company on public.ks_license_keys(redeemed_by_company);
create index if not exists ix_ks_license_keys_payment_request on public.ks_license_keys(payment_request_id);
create index if not exists ix_ks_license_audit_license on public.ks_license_activation_audit(license_id);
create index if not exists ix_ks_license_audit_actor on public.ks_license_activation_audit(actor_user_id);

create index if not exists ix_ks_channels_company on public.ks_communication_channels(company_id);
create index if not exists ix_ks_shared_files_company on public.ks_shared_files(company_id);
create index if not exists ix_ks_budget_lines_budget on public.ks_budget_lines(company_id,budget_id);
create index if not exists ix_ks_license_audit_company on public.ks_license_activation_audit(company_id);
create index if not exists ix_ks_license_keys_expiry on public.ks_license_keys(status,expires_at);
create index if not exists ix_ks_leave_requests_status on public.ks_leave_requests(company_id,status,starts_on);
create index if not exists ix_ks_calendar_events_status on public.ks_calendar_events(company_id,status,starts_at);
