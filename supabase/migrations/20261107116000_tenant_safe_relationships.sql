-- Enforce tenant-consistent foreign keys for employee, project, asset and workflow relations.
create unique index if not exists ux_ks_employees_company_id on public.ks_employees(company_id,id);
create unique index if not exists ux_ks_payroll_runs_company_id on public.ks_payroll_runs(company_id,id);
create unique index if not exists ux_ks_meetings_company_id on public.ks_meetings(company_id,id);
create unique index if not exists ux_ks_communication_channels_company_id on public.ks_communication_channels(company_id,id);
create unique index if not exists ux_ks_approval_requests_company_id on public.ks_approval_requests(company_id,id);
create unique index if not exists ux_ks_approval_workflows_company_id on public.ks_approval_workflows(company_id,id);
create unique index if not exists ux_ks_departments_company_id on public.ks_departments(company_id,id);
create unique index if not exists ux_ks_cost_centers_company_id on public.ks_cost_centers(company_id,id);
create unique index if not exists ux_ks_projects_company_id on public.ks_projects(company_id,id);
create unique index if not exists ux_ks_assets_company_id on public.ks_assets(company_id,id);
create unique index if not exists ux_ks_vehicles_company_id on public.ks_vehicles(company_id,id);
create unique index if not exists ux_ks_products_company_id on public.ks_products(company_id,id);
create unique index if not exists ux_ks_leave_types_company_id on public.ks_leave_types(company_id,id);
create unique index if not exists ux_ks_budgets_company_id on public.ks_budgets(company_id,id);

do $$
begin
 if not exists(select 1 from pg_constraint where conname='fk_ks_empdocs_tenant') then
  alter table public.ks_employee_documents add constraint fk_ks_empdocs_tenant foreign key(company_id,employee_id) references public.ks_employees(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_comp_history_tenant') then
  alter table public.ks_employee_compensation_history add constraint fk_ks_comp_history_tenant foreign key(company_id,employee_id) references public.ks_employees(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_leave_balance_emp_tenant') then
  alter table public.ks_leave_balances add constraint fk_ks_leave_balance_emp_tenant foreign key(company_id,employee_id) references public.ks_employees(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_leave_balance_type_tenant') then
  alter table public.ks_leave_balances add constraint fk_ks_leave_balance_type_tenant foreign key(company_id,leave_type_id) references public.ks_leave_types(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_leave_request_emp_tenant') then
  alter table public.ks_leave_requests add constraint fk_ks_leave_request_emp_tenant foreign key(company_id,employee_id) references public.ks_employees(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_leave_request_type_tenant') then
  alter table public.ks_leave_requests add constraint fk_ks_leave_request_type_tenant foreign key(company_id,leave_type_id) references public.ks_leave_types(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_payroll_item_emp_tenant') then
  alter table public.ks_payroll_items add constraint fk_ks_payroll_item_emp_tenant foreign key(company_id,employee_id) references public.ks_employees(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_payroll_item_run_tenant') then
  alter table public.ks_payroll_items add constraint fk_ks_payroll_item_run_tenant foreign key(company_id,payroll_run_id) references public.ks_payroll_runs(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_meeting_attendee_tenant') then
  alter table public.ks_meeting_attendees add constraint fk_ks_meeting_attendee_tenant foreign key(company_id,meeting_id) references public.ks_meetings(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_message_channel_tenant') then
  alter table public.ks_internal_messages add constraint fk_ks_message_channel_tenant foreign key(company_id,channel_id) references public.ks_communication_channels(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_approval_step_tenant') then
  alter table public.ks_approval_steps add constraint fk_ks_approval_step_tenant foreign key(company_id,request_id) references public.ks_approval_requests(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_approval_workflow_tenant') then
  alter table public.ks_approval_requests add constraint fk_ks_approval_workflow_tenant foreign key(company_id,workflow_id) references public.ks_approval_workflows(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_budget_line_tenant') then
  alter table public.ks_budget_lines add constraint fk_ks_budget_line_tenant foreign key(company_id,budget_id) references public.ks_budgets(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_cost_center_dept_tenant') then
  alter table public.ks_cost_centers add constraint fk_ks_cost_center_dept_tenant foreign key(company_id,department_id) references public.ks_departments(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_department_parent_tenant') then
  alter table public.ks_departments add constraint fk_ks_department_parent_tenant foreign key(company_id,parent_department_id) references public.ks_departments(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_expense_cost_center_tenant') then
  alter table public.ks_general_expenses add constraint fk_ks_expense_cost_center_tenant foreign key(company_id,cost_center_id) references public.ks_cost_centers(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_expense_project_tenant') then
  alter table public.ks_general_expenses add constraint fk_ks_expense_project_tenant foreign key(company_id,project_id) references public.ks_projects(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_routing_product_tenant') then
  alter table public.ks_manufacturing_routings add constraint fk_ks_routing_product_tenant foreign key(company_id,product_id) references public.ks_products(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_maintenance_asset_tenant') then
  alter table public.ks_maintenance_plans add constraint fk_ks_maintenance_asset_tenant foreign key(company_id,asset_id) references public.ks_assets(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_maintenance_vehicle_tenant') then
  alter table public.ks_maintenance_plans add constraint fk_ks_maintenance_vehicle_tenant foreign key(company_id,vehicle_id) references public.ks_vehicles(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_project_task_project_tenant') then
  alter table public.ks_project_tasks add constraint fk_ks_project_task_project_tenant foreign key(company_id,project_id) references public.ks_projects(company_id,id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_project_task_employee_tenant') then
  alter table public.ks_project_tasks add constraint fk_ks_project_task_employee_tenant foreign key(company_id,assigned_to) references public.ks_employees(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_maintenance_order_asset_tenant') then
  alter table public.ks_maintenance_orders add constraint fk_ks_maintenance_order_asset_tenant foreign key(company_id,asset_id) references public.ks_assets(company_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='fk_ks_delivery_driver_tenant') then
  alter table public.ks_delivery_routes add constraint fk_ks_delivery_driver_tenant foreign key(company_id,assigned_driver) references public.ks_employees(company_id,id);
 end if;
end $$;
