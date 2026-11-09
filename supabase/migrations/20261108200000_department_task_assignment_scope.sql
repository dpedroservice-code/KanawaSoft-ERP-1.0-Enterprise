INSERT INTO private.ks_role_module_defaults(role,module_id,can_view,can_create,can_edit,can_delete,can_export,can_approve,can_cancel,can_configure)
VALUES('accountant','tarefas',true,true,true,false,true,false,false,false)
ON CONFLICT(role,module_id) DO UPDATE SET
  can_view=true,can_create=true,can_edit=true,can_delete=false,can_export=true,can_approve=false,can_cancel=false,can_configure=false;

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
  AND (
    store_key<>'tarefas'
    OR NOT private.ks_has_company_role(company_id,ARRAY['accountant','contabilista'])
    OR payload->>'responsavelId'=(select auth.uid())::text
  )
  AND (
    store_key<>'tarefas'
    OR NOT private.ks_has_company_role(company_id,ARRAY['operator','operador'])
    OR payload->>'responsavelId'=(select auth.uid())::text
    OR EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
      WHERE cashier.company_id=ks_records.company_id
        AND cashier.user_id::text=ks_records.payload->>'responsavelId'
        AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
  )
);

DROP POLICY IF EXISTS ks_records_module_insert ON public.ks_records;
CREATE POLICY ks_records_module_insert ON public.ks_records FOR INSERT TO authenticated WITH CHECK (
  private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'criar')
  AND (
    store_key<>'vendas'
    OR private.ks_has_company_role(company_id,ARRAY['owner','admin'])
    OR (
      private.ks_has_company_role(company_id,ARRAY['cashier','caixa'])
      AND payload->>'cashierUserId'=(select auth.uid())::text
    )
  )
  AND (
    store_key<>'vendas'
    OR EXISTS(SELECT 1 FROM public.ks_sales s
      WHERE s.company_id=ks_records.company_id AND s.external_id=ks_records.record_id
        AND s.cashier_user_id=(select auth.uid()))
    OR private.ks_has_company_role(company_id,ARRAY['owner','admin'])
  )
  AND (
    store_key<>'tarefas'
    OR NOT private.ks_has_company_role(company_id,ARRAY['accountant','contabilista','operator','operador'])
    OR payload->>'responsavelId'=(select auth.uid())::text
    OR (
      private.ks_has_company_role(company_id,ARRAY['operator','operador'])
      AND EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
        WHERE cashier.company_id=ks_records.company_id
          AND cashier.user_id::text=ks_records.payload->>'responsavelId'
          AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
    )
  )
);

DROP POLICY IF EXISTS ks_records_module_update ON public.ks_records;
CREATE POLICY ks_records_module_update ON public.ks_records FOR UPDATE TO authenticated USING (
  store_key<>'vendas' AND private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'editar')
  AND (
    store_key<>'tarefas'
    OR NOT private.ks_has_company_role(company_id,ARRAY['accountant','contabilista','operator','operador'])
    OR payload->>'responsavelId'=(select auth.uid())::text
    OR (
      private.ks_has_company_role(company_id,ARRAY['operator','operador'])
      AND EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
        WHERE cashier.company_id=ks_records.company_id
          AND cashier.user_id::text=ks_records.payload->>'responsavelId'
          AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
    )
  )
) WITH CHECK (
  store_key<>'vendas' AND private.ks_has_company_permission(company_id,private.ks_store_module(store_key),'editar')
  AND (
    store_key<>'tarefas'
    OR NOT private.ks_has_company_role(company_id,ARRAY['accountant','contabilista','operator','operador'])
    OR payload->>'responsavelId'=(select auth.uid())::text
    OR (
      private.ks_has_company_role(company_id,ARRAY['operator','operador'])
      AND EXISTS(SELECT 1 FROM public.ks_company_memberships cashier
        WHERE cashier.company_id=ks_records.company_id
          AND cashier.user_id::text=ks_records.payload->>'responsavelId'
          AND cashier.supervisor_user_id=(select auth.uid()) AND cashier.status='active')
    )
  )
);
