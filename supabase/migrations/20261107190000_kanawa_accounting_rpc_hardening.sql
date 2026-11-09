
-- Tighten accounting RPCs so UI and database enforce the same module permissions.
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
        'is_system',a.is_system,
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

CREATE OR REPLACE FUNCTION private.ks_save_chart_account(
  p_company_id uuid,p_account_code text,p_name text,p_account_type text,p_parent_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_id uuid; v_normal_balance text;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','editar') THEN
    RAISE EXCEPTION 'Sem permissões para alterar o plano de contas.' USING errcode='42501';
  END IF;
  IF nullif(trim(p_account_code),'') IS NULL OR nullif(trim(p_name),'') IS NULL
    OR p_account_type NOT IN ('asset','liability','equity','income','expense') THEN
    RAISE EXCEPTION 'Código, nome e tipo de conta válidos são obrigatórios.';
  END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.ks_chart_of_accounts WHERE id=p_parent_id AND company_id=p_company_id AND is_active
  ) THEN RAISE EXCEPTION 'A conta principal não pertence a esta empresa.'; END IF;
  v_normal_balance:=CASE WHEN p_account_type IN ('liability','equity','income') THEN 'credit' ELSE 'debit' END;
  INSERT INTO public.ks_chart_of_accounts(company_id,account_code,name,account_type,parent_id,is_active,normal_balance,is_group)
  VALUES(p_company_id,trim(p_account_code),trim(p_name),p_account_type,p_parent_id,true,v_normal_balance,false)
  ON CONFLICT(company_id,account_code) DO UPDATE
    SET name=excluded.name,account_type=excluded.account_type,parent_id=excluded.parent_id,
        is_active=true,normal_balance=excluded.normal_balance
  RETURNING id INTO v_id;
  IF p_parent_id IS NOT NULL THEN
    UPDATE public.ks_chart_of_accounts SET is_group=true WHERE id=p_parent_id AND company_id=p_company_id;
  END IF;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.ks_post_journal_entry(
  p_company_id uuid,p_entry_date date,p_description text,p_lines jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_year integer; v_number integer; v_entry_id uuid; v_debit numeric(20,2); v_credit numeric(20,2);
  v_count integer; v_line jsonb; v_account_id uuid; v_line_debit numeric(20,2); v_line_credit numeric(20,2);
  v_entry_number text;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','criar') THEN
    RAISE EXCEPTION 'Sem permissões para lançar movimentos contabilísticos.' USING errcode='42501';
  END IF;
  IF p_entry_date IS NULL OR nullif(trim(p_description),'') IS NULL OR jsonb_typeof(p_lines)<>'array' THEN
    RAISE EXCEPTION 'Data, descrição e linhas contabilísticas são obrigatórias.';
  END IF;
  v_count:=jsonb_array_length(p_lines);
  IF v_count<2 OR v_count>200 THEN RAISE EXCEPTION 'O lançamento exige entre 2 e 200 linhas.'; END IF;
  SELECT coalesce(sum((x->>'debit')::numeric),0),coalesce(sum((x->>'credit')::numeric),0)
    INTO v_debit,v_credit FROM jsonb_array_elements(p_lines) x;
  IF v_debit<=0 OR v_credit<=0 OR round(v_debit,2)<>round(v_credit,2) THEN
    RAISE EXCEPTION 'O lançamento não está equilibrado: débito deve ser igual ao crédito.' USING errcode='22000';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_account_id:=(v_line->>'account_id')::uuid;
    v_line_debit:=coalesce((v_line->>'debit')::numeric,0);
    v_line_credit:=coalesce((v_line->>'credit')::numeric,0);
    IF v_line_debit<0 OR v_line_credit<0 OR (v_line_debit=0 AND v_line_credit=0) OR (v_line_debit>0 AND v_line_credit>0) THEN
      RAISE EXCEPTION 'Cada linha deve ter apenas débito ou crédito positivo.';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.ks_chart_of_accounts
      WHERE id=v_account_id AND company_id=p_company_id AND is_active AND NOT is_group) THEN
      RAISE EXCEPTION 'A conta indicada não existe, não está activa, é de agrupamento ou pertence a outra empresa.';
    END IF;
  END LOOP;
  v_year:=extract(year FROM p_entry_date)::integer;
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text),v_year);
  SELECT coalesce(max(substring(entry_number FROM '^(?:DIARIO-)[0-9]{4}-([0-9]+)$')::integer),0)+1
    INTO v_number FROM public.ks_journal_entries WHERE company_id=p_company_id AND entry_number LIKE 'DIARIO-'||v_year||'-%';
  v_entry_number:='DIARIO-'||v_year||'-'||lpad(v_number::text,6,'0');
  INSERT INTO public.ks_journal_entries(company_id,entry_number,entry_date,description,source_type,status)
  VALUES(p_company_id,v_entry_number,p_entry_date,trim(p_description),'manual','posted') RETURNING id INTO v_entry_id;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.ks_journal_lines(company_id,journal_entry_id,account_id,debit,credit)
    VALUES(p_company_id,v_entry_id,(v_line->>'account_id')::uuid,
      coalesce((v_line->>'debit')::numeric,0),coalesce((v_line->>'credit')::numeric,0));
  END LOOP;
  RETURN jsonb_build_object('id',v_entry_id,'entry_number',v_entry_number,'debit_total',v_debit,'credit_total',v_credit);
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
    FROM public.ks_journal_lines l
    JOIN public.ks_journal_entries e ON e.id=l.journal_entry_id AND e.company_id=l.company_id
    WHERE l.company_id=p_company_id AND e.status='posted' AND e.entry_date<=p_to_date
    GROUP BY l.account_id
  ), tb AS (
    SELECT a.id,a.account_code,a.name,a.account_type,a.normal_balance,a.is_group,
      coalesce(m.opening_balance,0) AS opening_balance,
      coalesce(m.period_debit,0) AS period_debit,
      coalesce(m.period_credit,0) AS period_credit,
      coalesce(m.closing_balance,0) AS closing_balance
    FROM public.ks_chart_of_accounts a LEFT JOIN movements m ON m.account_id=a.id
    WHERE a.company_id=p_company_id AND a.is_active
  ), totals AS (
    SELECT
      coalesce(sum(CASE WHEN account_type='asset' THEN closing_balance ELSE 0 END),0) AS assets,
      coalesce(sum(CASE WHEN account_type='liability' THEN -closing_balance ELSE 0 END),0) AS liabilities,
      coalesce(sum(CASE WHEN account_type='equity' THEN -closing_balance ELSE 0 END),0) AS equity,
      coalesce(sum(CASE WHEN account_type='income' THEN -closing_balance ELSE 0 END),0) AS income,
      coalesce(sum(CASE WHEN account_type='expense' THEN closing_balance ELSE 0 END),0) AS expenses
    FROM tb WHERE NOT is_group
  )
  SELECT jsonb_build_object(
    'period_start',p_from_date,'period_end',p_to_date,
    'trial_balance',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'account_code',account_code,'name',name,'account_type',account_type,'normal_balance',normal_balance,
      'opening_balance',opening_balance,'period_debit',period_debit,'period_credit',period_credit,
      'closing_balance',closing_balance
    ) ORDER BY account_code) FROM tb WHERE NOT is_group),'[]'::jsonb),
    'balance_sheet',(SELECT jsonb_build_object('assets',assets,'liabilities',liabilities,'equity',equity,
      'difference',assets-liabilities-equity) FROM totals),
    'income_statement',(SELECT jsonb_build_object('income',income,'expenses',expenses,'net_result',income-expenses) FROM totals),
    'ledger',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'entry_number',q.entry_number,'entry_date',q.entry_date,'description',q.description,
        'account_code',q.account_code,'account_name',q.account_name,'debit',q.debit,'credit',q.credit
      ) ORDER BY q.entry_date,q.entry_number,q.account_code)
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
