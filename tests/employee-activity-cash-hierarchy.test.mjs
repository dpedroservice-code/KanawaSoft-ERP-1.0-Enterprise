import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../app/cloud.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const hierarchy=readFileSync(new URL('../supabase/migrations/20261108110000_employee_hierarchy_audit_cash_and_approvals.sql',import.meta.url),'utf8');
const finance=readFileSync(new URL('../supabase/migrations/20261108120000_financial_approvals_and_cancellation_roles.sql',import.meta.url),'utf8');
const cash=readFileSync(new URL('../supabase/migrations/20261108121000_cash_session_reconciliation.sql',import.meta.url),'utf8');
const policy=readFileSync(new URL('../supabase/migrations/20261108130000_financial_commercial_policy_enforcement.sql',import.meta.url),'utf8');
const scopes=readFileSync(new URL('../supabase/migrations/20261108150000_scope_cashier_sales_and_module_records.sql',import.meta.url),'utf8');
const ownership=readFileSync(new URL('../supabase/migrations/20261108160000_enforce_cashier_sale_ownership.sql',import.meta.url),'utf8');
const enforcement=readFileSync(new URL('../supabase/migrations/20261108170000_enforce_financial_and_cashier_sale_limits.sql',import.meta.url),'utf8');
const hierarchyFinal=readFileSync(new URL('../supabase/migrations/20261108180000_team_hierarchy_and_cancel_reconciliation.sql',import.meta.url),'utf8');
const taskScope=readFileSync(new URL('../supabase/migrations/20261108200000_department_task_assignment_scope.sql',import.meta.url),'utf8');
const operatorScope=readFileSync(new URL('../supabase/migrations/20261108190000_scope_operator_to_assigned_cashiers.sql',import.meta.url),'utf8');

test('application and cloud bridge parse after team monitoring and cash workflows',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.doesNotThrow(()=>new vm.Script(cloud));
});

test('team invitations enforce administrator, manager and operator hierarchy',()=>{
  assert.match(app,/kanawaInviteRoles/);
  assert.match(app,/role==='admin'.*manager.*accountant/s);
  assert.match(app,/role==='gerente'.*operator/s);
  assert.match(app,/role==='operador'.*cashier/s);
  assert.match(hierarchy,/ks_can_invite_team_role/);
  assert.match(hierarchy,/m\.role IN \('manager','gerente'\) AND p_role IN \('operator','operador'\)/);
  assert.match(hierarchy,/m\.role IN \('operator','operador'\) AND p_role IN \('cashier','caixa'\)/);
  assert.match(hierarchy,/supervisor_user_id/);
});

test('administrator dashboard has named staff activity and employee sales charts',()=>{
  assert.match(app,/Monitorização de actividades/);
  assert.match(app,/Colaborador/);
  assert.match(app,/Função/);
  assert.match(app,/dashChartEmployeeSales/);
  assert.match(app,/dashChartEmployeeActivity/);
  assert.match(app,/listAuditEvents/);
  assert.match(app,/clienteEndereco/);
  assert.match(app,/lucroBruto/);
});

test('sales include cashier identity, customer address, products, profit and cash session',()=>{
  assert.match(app,/clienteEndereco: pdvState\.cliente\.endereco/);
  assert.match(app,/operatorUserId: actor\.id/);
  assert.match(app,/cashSessionId: cashSession/);
  assert.match(app,/Apenas o Caixa pode registar vendas/);
  assert.match(app,/solicitarCancelamentoVenda/);
  assert.match(app,/cashierUserId\|\|x\.operatorUserId/);
  assert.match(cloud,/attachSaleContext/);
});

test('cash opening and closing calculate targets and reconcile cash-only payments',()=>{
  assert.match(app,/async function renderCaixa/);
  assert.match(app,/Abrir caixa/);
  assert.match(app,/Fechar caixa/);
  assert.match(cloud,/ks_open_cash_session/);
  assert.match(cloud,/ks_close_cash_session/);
  assert.match(hierarchy,/ks_cash_sessions_one_open_per_cashier/);
  assert.match(cash,/cash_sales_total/);
  assert.match(cash,/lower\(coalesce\(r\.payload->>'pagamento'/);
});

test('cashier requests cancellation while operator or administrator decides it',()=>{
  assert.match(app,/Apenas o caixa solicita; o operador decide/);
  assert.match(hierarchy,/ks_request_sale_cancellation/);
  assert.match(finance,/ARRAY\['owner','admin','operator','operador'\]/);
  assert.doesNotMatch(finance,/ARRAY\['owner','admin','manager','gerente','operator','operador'\]/);
});

test('finance approves product and service prices before catalog values are updated',()=>{
  assert.match(app,/Autorizações de preços, descontos e orçamentos/);
  assert.match(app,/decidirAprovacaoComercial/);
  assert.match(cloud,/ks_request_commercial_approval/);
  assert.match(cloud,/ks_decide_commercial_approval/);
  assert.match(finance,/ks_commercial_approvals/);
  assert.match(finance,/store_key='produtos'/);
  assert.match(finance,/store_key='servicos'/);
  assert.match(policy,/ks_commercial_policies/);
  assert.match(policy,/max_discount_percent/);
  assert.match(policy,/max_sale_amount/);
  assert.match(app,/O Financeiro definiu o limite de venda/);
  assert.match(app,/max_discount_percent/);
});

test('audit records identify the actor and avoid duplicate local audit-store writes',()=>{
  assert.match(app,/function kanawaCurrentActor/);
  assert.match(app,/logAuditEvent/);
  assert.match(app,/store !== 'auditoria'/);
  assert.match(cloud,/actor_user_id: context\.user\.id/);
  assert.match(hierarchy,/actor_user_id=auth\.uid\(\)/);
});


test('invited staff can sign in with confirmed Gmail and password, with six-digit OTP fallback',()=>{
  assert.match(html,/id="loginPassword"/);
  assert.match(html,/id="loginUseOtp"/);
  assert.match(app,/signInWithPassword/);
  assert.match(app,/Gmail e palavra-passe/);
  assert.match(app,/Confirme o Gmail/);
  assert.match(cloud,/auth\.signInWithPassword/);
  assert.match(cloud,/email not confirmed/i);
  assert.match(cloud,/options: \{ shouldCreateUser: false \}/);
});


test('cashier data is row-scoped and only cashier/admin can finalize sales',()=>{
  assert.match(scopes,/ks_records_module_select/);
  assert.match(scopes,/payload->>'cashierUserId'/);
  assert.match(scopes,/ks_sales_role_scoped_select/);
  assert.match(scopes,/cashier_user_id=\(select auth\.uid\(\)\)/);
  assert.match(scopes,/Apenas o Caixa ou Administrador pode finalizar vendas/);
  assert.match(scopes,/ARRAY\['owner','admin','cashier','caixa'\]/);
  assert.match(scopes,/DROP POLICY IF EXISTS ks_sales_role_scoped_insert/);
  assert.match(scopes,/DROP POLICY IF EXISTS ks_sale_items_role_scoped_insert/);
  assert.match(scopes,/store_key<>'vendas' AND private\.ks_has_company_permission/);
});


test('cashier cannot impersonate another seller or request cancellation of another cashier sale',()=>{
  assert.match(ownership,/ks_enforce_cashier_sale_identity/);
  assert.match(ownership,/OLD\.cashier_user_id<>auth\.uid\(\)/);
  assert.match(ownership,/payload->>'cashierUserId'=auth\.uid\(\)::text/);
  assert.match(ownership,/Venda não encontrada na sua caixa/);
  assert.match(scopes,/private\.ks_has_company_role\(p_company_id,ARRAY\['owner','admin','cashier','caixa'\]\)/);
});


test('POS server enforces open cash, finance-approved limits and catalog prices',()=>{
  assert.match(enforcement,/Abra a sua caixa antes de finalizar uma venda/);
  assert.match(enforcement,/ks_commercial_policies/);
  assert.match(enforcement,/v_max_sale/);
  assert.match(enforcement,/v_max_discount/);
  assert.match(enforcement,/preço de % foi alterado ou não foi autorizado pelo Financeiro/);
  assert.match(enforcement,/Apenas o Caixa ou Administrador pode finalizar vendas/);
});


test('administrator creates only managers/accountants and cancellation updates cash reconciliation',()=>{
  assert.match(hierarchyFinal,/m\.role IN \('owner','admin'\) AND p_role IN \('manager','accountant','gerente','contabilista'\)/);
  assert.match(hierarchyFinal,/m\.role IN \('manager','gerente'\) AND p_role IN \('operator','operador'\)/);
  assert.match(hierarchyFinal,/m\.role IN \('operator','operador'\) AND p_role IN \('cashier','caixa'\)/);
  assert.match(hierarchyFinal,/cash_sales_total=v_cash_total/);
  assert.match(hierarchyFinal,/difference=CASE WHEN counted_cash IS NULL/);
});


test('manager supervises but does not cancel sales; operator is the cancellation authority',()=>{
  assert.match(app,/gerente: \{[\s\S]*?acoes: \['criar','editar','ver','aprovar','exportar'\]/);
  assert.match(app,/operador: \{[\s\S]*?acoes: \['criar','ver','cancelar','aprovar'\]/);
  assert.match(app,/canReview=\['admin','operador'\]/);
});


test('operator can monitor only assigned cashiers while manager and administrator retain company oversight',()=>{
  assert.match(operatorScope,/supervisor\.role IN \('operator','operador'\)/);
  assert.match(operatorScope,/cashier\.supervisor_user_id=\(select auth\.uid\(\)\)/);
  assert.match(operatorScope,/ks_cash_sessions_read/);
  assert.match(operatorScope,/ks_sale_cancel_read/);
  assert.match(operatorScope,/ks_sales_role_scoped_select/);
  assert.match(operatorScope,/ks_records_module_select/);
});


test('department tasks can be assigned to teams and are scoped to their responsible users',()=>{
  assert.match(app,/responsavelId/);
  assert.match(app,/responsavelNome/);
  assert.match(app,/departamento/);
  assert.match(app,/dashTaskMonitoring/);
  assert.match(app,/dashChartEmployeeTasks/);
  assert.match(app,/Atribuída por/);
  assert.match(taskScope,/VALUES\('accountant','tarefas',true,true,true/);
  assert.match(taskScope,/payload->>'responsavelId'/);
  assert.match(taskScope,/cashier\.supervisor_user_id=\(select auth\.uid\(\)\)/);
});
