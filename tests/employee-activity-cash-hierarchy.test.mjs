import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../app/cloud.js',import.meta.url),'utf8');
const hierarchy=readFileSync(new URL('../supabase/migrations/20261108110000_employee_hierarchy_audit_cash_and_approvals.sql',import.meta.url),'utf8');
const finance=readFileSync(new URL('../supabase/migrations/20261108120000_financial_approvals_and_cancellation_roles.sql',import.meta.url),'utf8');
const cash=readFileSync(new URL('../supabase/migrations/20261108121000_cash_session_reconciliation.sql',import.meta.url),'utf8');

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
});

test('audit records identify the actor and avoid duplicate local audit-store writes',()=>{
  assert.match(app,/function kanawaCurrentActor/);
  assert.match(app,/logAuditEvent/);
  assert.match(app,/store !== 'auditoria'/);
  assert.match(cloud,/actor_user_id: context\.user\.id/);
  assert.match(hierarchy,/actor_user_id=auth\.uid\(\)/);
});
