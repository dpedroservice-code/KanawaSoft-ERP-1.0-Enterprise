-- Supervisors only see the teams assigned to them; managers see the company, operators see their cashiers.
DROP POLICY IF EXISTS ks_records_module_select ON public.ks_records;
CREATE POLICY ks_records_module_select ON public.ks_records FOR SELECT TO authenticated USING (
  private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'ver')
  AND (
    store_key<>'vendas'
    OR (
      NOT private.ks_has_company_role(company_id,ARRAY['cashier','caixa'])
      AND NOT private.ks_has_company_role(company_id,ARRAY['operator','operador'])
    )
    OR payload->>'cashierUserId'=(select auth.uid())::text
    OR payload->>'operatorUserId'=(select auth.uid())::text
    OR (
      private.ks_has_company_role(company_id,ARRAY['operator','operador'])
      AND EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
        WHERE cashier.company_id=ks_records.company_id
          AND cashier.user_id::text=ks_records.payload->>'cashierUserId'
          AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
    )
  )
);

DROP POLICY IF EXISTS ks_sales_role_scoped_select ON public.ks_sales;
CREATE POLICY ks_sales_role_scoped_select ON public.ks_sales FOR SELECT TO authenticated USING (
  private.ks_has_company_permission(company_id,'vendas','ver')
  AND (
    (NOT private.ks_has_company_role(company_id,ARRAY['cashier','caixa']) AND NOT private.ks_has_company_role(company_id,ARRAY['operator','operador']))
    OR cashier_user_id=(select auth.uid())
    OR (
      private.ks_has_company_role(company_id,ARRAY['operator','operador'])
      AND EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
        WHERE cashier.company_id=ks_sales.company_id AND cashier.user_id=ks_sales.cashier_user_id
          AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
    )
  )
);

DROP POLICY IF EXISTS ks_cash_sessions_read ON public.ks_cash_sessions;
CREATE POLICY ks_cash_sessions_read ON public.ks_cash_sessions FOR SELECT TO authenticated USING (
  cashier_user_id=(select auth.uid())
  OR EXISTS(SELECT 1 FROM public.ks_company_memberships supervisor
    WHERE supervisor.company_id=ks_cash_sessions.company_id AND supervisor.user_id=(select auth.uid())
      AND supervisor.status='active' AND supervisor.role IN ('owner','admin','manager','gerente'))
  OR (
    EXISTS(SELECT 1 FROM public.ks_company_memberships supervisor
      WHERE supervisor.company_id=ks_cash_sessions.company_id AND supervisor.user_id=(select auth.uid())
        AND supervisor.status='active' AND supervisor.role IN ('operator','operador'))
    AND EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
      WHERE cashier.company_id=ks_cash_sessions.company_id AND cashier.user_id=ks_cash_sessions.cashier_user_id
        AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
  )
);

DROP POLICY IF EXISTS ks_sale_cancel_read ON public.ks_sale_cancellation_requests;
CREATE POLICY ks_sale_cancel_read ON public.ks_sale_cancellation_requests FOR SELECT TO authenticated USING (
  cashier_user_id=(select auth.uid())
  OR EXISTS(SELECT 1 FROM public.ks_company_memberships supervisor
    WHERE supervisor.company_id=ks_sale_cancellation_requests.company_id AND supervisor.user_id=(select auth.uid())
      AND supervisor.status='active' AND supervisor.role IN ('owner','admin','manager','gerente'))
  OR (
    EXISTS(SELECT 1 FROM public.ks_company_memberships supervisor
      WHERE supervisor.company_id=ks_sale_cancellation_requests.company_id AND supervisor.user_id=(select auth.uid())
        AND supervisor.status='active' AND supervisor.role IN ('operator','operador'))
    AND EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
      WHERE cashier.company_id=ks_sale_cancellation_requests.company_id AND cashier.user_id=ks_sale_cancellation_requests.cashier_user_id
        AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
  )
);
