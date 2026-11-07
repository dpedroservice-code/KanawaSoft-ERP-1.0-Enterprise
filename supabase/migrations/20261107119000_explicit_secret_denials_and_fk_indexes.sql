-- Explicit deny policies document the intended server-only access for secret vault tables.
create policy ks_company_integration_secrets_deny_client on public.ks_company_integration_secrets
 for all to anon,authenticated using(false) with check(false);
create policy ks_ecommerce_api_keys_deny_client on public.ks_ecommerce_api_keys
 for all to anon,authenticated using(false) with check(false);
create policy ks_license_keys_deny_client on public.ks_license_keys
 for all to anon,authenticated using(false) with check(false);

-- Index individual FK columns as well as tenant-composite relationships.
create index if not exists ix_ks_approval_requests_workflow_id on public.ks_approval_requests(workflow_id);
create index if not exists ix_ks_approval_steps_request_tenant on public.ks_approval_steps(company_id,request_id);
create index if not exists ix_ks_approval_steps_company_id on public.ks_approval_steps(company_id);
create index if not exists ix_ks_budget_lines_budget_id on public.ks_budget_lines(budget_id);
create index if not exists ix_ks_budgets_cost_center_id on public.ks_budgets(cost_center_id);
create index if not exists ix_ks_budgets_department_id on public.ks_budgets(department_id);
create index if not exists ix_ks_cost_centers_department_id on public.ks_cost_centers(department_id);
create index if not exists ix_ks_departments_parent_id on public.ks_departments(parent_department_id);
create index if not exists ix_ks_employee_compensation_employee_id on public.ks_employee_compensation_history(employee_id);
create index if not exists ix_ks_employee_documents_employee_id on public.ks_employee_documents(employee_id);
create index if not exists ix_ks_general_expenses_cost_center_id on public.ks_general_expenses(cost_center_id);
create index if not exists ix_ks_general_expenses_project_id on public.ks_general_expenses(project_id);
create index if not exists ix_ks_internal_messages_channel_id on public.ks_internal_messages(channel_id);
create index if not exists ix_ks_leave_balances_type_tenant on public.ks_leave_balances(company_id,leave_type_id);
create index if not exists ix_ks_leave_balances_employee_id on public.ks_leave_balances(employee_id);
create index if not exists ix_ks_leave_balances_leave_type_id on public.ks_leave_balances(leave_type_id);
create index if not exists ix_ks_leave_requests_type_tenant on public.ks_leave_requests(company_id,leave_type_id);
create index if not exists ix_ks_leave_requests_employee_id on public.ks_leave_requests(employee_id);
create index if not exists ix_ks_maintenance_plans_asset_id on public.ks_maintenance_plans(asset_id);
create index if not exists ix_ks_maintenance_plans_vehicle_id on public.ks_maintenance_plans(vehicle_id);
create index if not exists ix_ks_manufacturing_routings_product_id on public.ks_manufacturing_routings(product_id);
