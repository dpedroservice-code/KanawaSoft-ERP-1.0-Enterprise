
ALTER TABLE public.ks_chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_off_balance boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ks_seed_angola_chart_of_accounts(
  p_company_id uuid,p_accounts jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_account record; v_parent_id uuid; v_count integer:=0;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','editar') THEN
    RAISE EXCEPTION 'Sem permissões para importar o plano de contas.' USING errcode='42501';
  END IF;
  IF jsonb_typeof(p_accounts)<>'array' OR jsonb_array_length(p_accounts)<1 OR jsonb_array_length(p_accounts)>1000 THEN
    RAISE EXCEPTION 'O plano de contas enviado é inválido.' USING errcode='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.ks_chart_of_accounts WHERE company_id=p_company_id) THEN
    RAISE EXCEPTION 'Esta empresa já tem contas. A importação não substitui nem apaga contas existentes.' USING errcode='23505';
  END IF;
  FOR v_account IN
    SELECT * FROM jsonb_to_recordset(p_accounts) AS x(
      code text,name text,description text,pgc_class smallint,account_type text,
      normal_balance text,parent_code text,level smallint,is_group boolean,is_system boolean,is_off_balance boolean
    ) ORDER BY level,code
  LOOP
    IF nullif(trim(v_account.code),'') IS NULL OR nullif(trim(v_account.name),'') IS NULL
      OR v_account.account_type NOT IN ('asset','liability','equity','income','expense')
      OR v_account.normal_balance NOT IN ('debit','credit') THEN
      RAISE EXCEPTION 'Conta PGC inválida: %',v_account.code USING errcode='22023';
    END IF;
    v_parent_id:=NULL;
    IF v_account.parent_code IS NOT NULL THEN
      SELECT id INTO v_parent_id FROM public.ks_chart_of_accounts
      WHERE company_id=p_company_id AND account_code=v_account.parent_code;
      IF v_parent_id IS NULL THEN RAISE EXCEPTION 'Conta principal não encontrada para %',v_account.code; END IF;
    END IF;
    INSERT INTO public.ks_chart_of_accounts(
      company_id,account_code,name,description,account_type,parent_id,pgc_class,account_level,
      normal_balance,is_group,is_system,is_off_balance,is_active
    ) VALUES (
      p_company_id,trim(v_account.code),trim(v_account.name),nullif(trim(v_account.description),''),
      v_account.account_type,v_parent_id,v_account.pgc_class,v_account.level,v_account.normal_balance,
      coalesce(v_account.is_group,false),true,coalesce(v_account.is_off_balance,false),true
    ) ON CONFLICT(company_id,account_code) DO NOTHING;
    v_count:=v_count+1;
  END LOOP;
  RETURN jsonb_build_object('inserted',v_count,'source','PGC Angola — Decreto n.º 82/01','off_balance_accounts',
    (SELECT count(*) FROM public.ks_chart_of_accounts WHERE company_id=p_company_id AND is_off_balance));
END;
$function$;

CREATE OR REPLACE FUNCTION private.ks_accounting_snapshot(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','ver') THEN
    RAISE EXCEPTION 'Sem permissões para consultar a contabilidade.' USING errcode='42501';
  END IF;
  SELECT jsonb_build_object(
    'accounts',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,'account_code',a.account_code,'name',a.name,'description',a.description,
        'account_type',a.account_type,'parent_id',a.parent_id,'pgc_class',a.pgc_class,
        'account_level',a.account_level,'normal_balance',a.normal_balance,'is_group',a.is_group,
        'is_system',a.is_system,'is_off_balance',a.is_off_balance,
        'debit_total',coalesce(sum(l.debit) FILTER (WHERE e.id IS NOT NULL),0),
        'credit_total',coalesce(sum(l.credit) FILTER (WHERE e.id IS NOT NULL),0),
        'balance',coalesce(sum(l.debit-l.credit) FILTER (WHERE e.id IS NOT NULL),0)
      ) ORDER BY a.account_code)
      FROM public.ks_chart_of_accounts a
      LEFT JOIN public.ks_journal_lines l ON l.account_id=a.id AND l.company_id=a.company_id
      LEFT JOIN public.ks_journal_entries e ON e.id=l.journal_entry_id AND e.company_id=a.company_id AND e.status='posted'
      WHERE a.company_id=p_company_id AND a.is_active GROUP BY a.id
    ),'[]'::jsonb),
    'entries',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,'entry_number',e.entry_number,'entry_date',e.entry_date,'description',e.description,'status',e.status,
        'debit_total',coalesce((SELECT sum(l.debit) FROM public.ks_journal_lines l WHERE l.journal_entry_id=e.id AND l.company_id=e.company_id),0),
        'credit_total',coalesce((SELECT sum(l.credit) FROM public.ks_journal_lines l WHERE l.journal_entry_id=e.id AND l.company_id=e.company_id),0)
      ) ORDER BY e.entry_date DESC,e.created_at DESC)
      FROM (SELECT * FROM public.ks_journal_entries WHERE company_id=p_company_id ORDER BY entry_date DESC,created_at DESC LIMIT 200) e
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ks_accounting_reports(
  p_company_id uuid,p_from_date date,p_to_date date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_to_date<p_from_date THEN
    RAISE EXCEPTION 'Período contabilístico inválido.' USING errcode='22023';
  END IF;
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','ver') THEN
    RAISE EXCEPTION 'Sem permissões para consultar os relatórios contabilísticos.' USING errcode='42501';
  END IF;
  WITH movements AS (
    SELECT l.account_id,
      coalesce(sum(l.debit-l.credit) FILTER (WHERE e.entry_date<p_from_date),0) AS opening_balance,
      coalesce(sum(l.debit) FILTER (WHERE e.entry_date BETWEEN p_from_date AND p_to_date),0) AS period_debit,
      coalesce(sum(l.credit) FILTER (WHERE e.entry_date BETWEEN p_from_date AND p_to_date),0) AS period_credit,
      coalesce(sum(l.debit-l.credit) FILTER (WHERE e.entry_date<=p_to_date),0) AS closing_balance
    FROM public.ks_journal_lines l JOIN public.ks_journal_entries e
      ON e.id=l.journal_entry_id AND e.company_id=l.company_id
    WHERE l.company_id=p_company_id AND e.status='posted' AND e.entry_date<=p_to_date
    GROUP BY l.account_id
  ), tb AS (
    SELECT a.id,a.account_code,a.name,a.account_type,a.normal_balance,a.is_group,a.is_off_balance,
      coalesce(m.opening_balance,0) AS opening_balance,coalesce(m.period_debit,0) AS period_debit,
      coalesce(m.period_credit,0) AS period_credit,coalesce(m.closing_balance,0) AS closing_balance
    FROM public.ks_chart_of_accounts a LEFT JOIN movements m ON m.account_id=a.id
    WHERE a.company_id=p_company_id AND a.is_active
  ), totals AS (
    SELECT
      coalesce(sum(CASE WHEN account_type='asset' THEN closing_balance ELSE 0 END),0) AS assets,
      coalesce(sum(CASE WHEN account_type='liability' THEN -closing_balance ELSE 0 END),0) AS liabilities,
      coalesce(sum(CASE WHEN account_type='equity' THEN -closing_balance ELSE 0 END),0) AS equity,
      coalesce(sum(CASE WHEN account_type='income' THEN -closing_balance ELSE 0 END),0) AS income,
      coalesce(sum(CASE WHEN account_type='expense' THEN closing_balance ELSE 0 END),0) AS expenses
    FROM tb WHERE NOT is_group AND NOT is_off_balance
  )
  SELECT jsonb_build_object(
    'period_start',p_from_date,'period_end',p_to_date,
    'trial_balance',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'account_code',account_code,'name',name,'account_type',account_type,'normal_balance',normal_balance,
      'opening_balance',opening_balance,'period_debit',period_debit,'period_credit',period_credit,
      'closing_balance',closing_balance,'is_off_balance',is_off_balance
    ) ORDER BY account_code) FROM tb WHERE NOT is_group),'[]'::jsonb),
    'off_balance',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'account_code',account_code,'name',name,'opening_balance',opening_balance,
      'period_debit',period_debit,'period_credit',period_credit,'closing_balance',closing_balance
    ) ORDER BY account_code) FROM tb WHERE NOT is_group AND is_off_balance),'[]'::jsonb),
    'balance_sheet',(SELECT jsonb_build_object('assets',assets,'liabilities',liabilities,'equity',equity,
      'difference',assets-liabilities-equity) FROM totals),
    'income_statement',(SELECT jsonb_build_object('income',income,'expenses',expenses,'net_result',income-expenses) FROM totals),
    'ledger',coalesce((
      SELECT jsonb_agg(jsonb_build_object('entry_number',q.entry_number,'entry_date',q.entry_date,'description',q.description,
        'account_code',q.account_code,'account_name',q.account_name,'debit',q.debit,'credit',q.credit)
        ORDER BY q.entry_date,q.entry_number,q.account_code)
      FROM (
        SELECT e.entry_number,e.entry_date,e.description,a.account_code,a.name AS account_name,l.debit,l.credit
        FROM public.ks_journal_lines l
        JOIN public.ks_journal_entries e ON e.id=l.journal_entry_id AND e.company_id=l.company_id
        JOIN public.ks_chart_of_accounts a ON a.id=l.account_id AND a.company_id=l.company_id
        WHERE l.company_id=p_company_id AND e.status='posted' AND e.entry_date BETWEEN p_from_date AND p_to_date
        ORDER BY e.entry_date,e.entry_number,a.account_code LIMIT 500
      ) q
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
