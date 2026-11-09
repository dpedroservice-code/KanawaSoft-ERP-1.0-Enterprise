-- SAF-T (AO) accounting export foundation. Additive only.
ALTER TABLE public.ks_journal_entries
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_user_code text;
ALTER TABLE public.ks_journal_entries
  DROP CONSTRAINT IF EXISTS ks_journal_entries_source_user_code_check;
ALTER TABLE public.ks_journal_entries
  ADD CONSTRAINT ks_journal_entries_source_user_code_check
  CHECK (source_user_code IS NULL OR (length(source_user_code) BETWEEN 1 AND 30 AND source_user_code !~ '\s'));
CREATE INDEX IF NOT EXISTS ks_journal_entries_company_date_status_idx
  ON public.ks_journal_entries(company_id,entry_date,status);

CREATE OR REPLACE FUNCTION private.ks_post_journal_entry(
  p_company_id uuid,p_entry_date date,p_description text,p_lines jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_year integer; v_number integer; v_entry_id uuid; v_debit numeric(20,2); v_credit numeric(20,2);
  v_count integer; v_line jsonb; v_account_id uuid; v_line_debit numeric(20,2); v_line_credit numeric(20,2);
  v_entry_number text; v_user_id uuid; v_source_user_code text;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','criar') THEN
    RAISE EXCEPTION 'Sem permissões para lançar movimentos contabilísticos.' USING errcode='42501';
  END IF;
  v_user_id:=auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sessão autenticada obrigatória.' USING errcode='42501'; END IF;
  v_source_user_code:='USR'||left(replace(v_user_id::text,'-',''),27);
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
  INSERT INTO public.ks_journal_entries(
    company_id,entry_number,entry_date,description,source_type,status,created_by_user_id,source_user_code
  ) VALUES(p_company_id,v_entry_number,p_entry_date,trim(p_description),'manual','posted',v_user_id,v_source_user_code)
  RETURNING id INTO v_entry_id;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.ks_journal_lines(company_id,journal_entry_id,account_id,debit,credit)
    VALUES(p_company_id,v_entry_id,(v_line->>'account_id')::uuid,
      coalesce((v_line->>'debit')::numeric,0),coalesce((v_line->>'credit')::numeric,0));
  END LOOP;
  RETURN jsonb_build_object('id',v_entry_id,'entry_number',v_entry_number,'debit_total',v_debit,'credit_total',v_credit);
END;
$function$;

CREATE OR REPLACE FUNCTION private.ks_accounting_saft_snapshot(
  p_company_id uuid,p_from_date date,p_to_date date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_company jsonb; v_period jsonb; v_accounts jsonb; v_entries jsonb;
  v_fiscal_month integer; v_fiscal_year integer;
BEGIN
  IF p_company_id IS NULL OR p_from_date IS NULL OR p_to_date IS NULL OR p_to_date<p_from_date THEN
    RAISE EXCEPTION 'Empresa e período contabilístico válidos são obrigatórios.' USING errcode='22023';
  END IF;
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','exportar') THEN
    RAISE EXCEPTION 'Sem permissão para exportar SAF-T de contabilidade.' USING errcode='42501';
  END IF;

  SELECT jsonb_build_object(
    'taxRegistrationNumber',c.tax_id,
    'companyId',coalesce(nullif(p.commercial_registry_number,''),nullif(p.commercial_entry_number,'')),
    'companyName',c.legal_name,'businessName',c.trade_name,
    'telephone',c.phone,'email',c.email,
    'address',jsonb_build_object(
      'addressDetail',p.registered_address,
      'city',coalesce(nullif(p.municipality,''),nullif(p.province,'')),
      'province',p.province,'postalCode',p.postal_code
    )
  ),coalesce(p.fiscal_year_start_month,1)
  INTO v_company,v_fiscal_month
  FROM public.ks_companies c
  LEFT JOIN public.ks_company_legal_profiles p ON p.company_id=c.id
  WHERE c.id=p_company_id;
  IF v_company IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
  IF nullif(v_company->>'taxRegistrationNumber','') IS NULL
     OR nullif(v_company->>'companyId','') IS NULL
     OR nullif(v_company#>>'{address,addressDetail}','') IS NULL
     OR nullif(v_company#>>'{address,city}','') IS NULL THEN
    RAISE EXCEPTION 'Complete o NIF, registo comercial e endereço legal da empresa antes de exportar SAF-T.';
  END IF;

  v_fiscal_year:=extract(year FROM p_to_date)::integer;
  IF extract(month FROM p_to_date)::integer < v_fiscal_month THEN v_fiscal_year:=v_fiscal_year-1; END IF;
  v_period:=jsonb_build_object('fiscalYear',v_fiscal_year,'fiscalYearStartMonth',v_fiscal_month,
    'startDate',p_from_date,'endDate',p_to_date);

  WITH movements AS (
    SELECT l.account_id,
      coalesce(sum(l.debit) FILTER (WHERE e.entry_date<p_from_date),0) AS opening_debit_total,
      coalesce(sum(l.credit) FILTER (WHERE e.entry_date<p_from_date),0) AS opening_credit_total,
      coalesce(sum(l.debit) FILTER (WHERE e.entry_date<=p_to_date),0) AS closing_debit_total,
      coalesce(sum(l.credit) FILTER (WHERE e.entry_date<=p_to_date),0) AS closing_credit_total
    FROM public.ks_journal_lines l
    JOIN public.ks_journal_entries e ON e.id=l.journal_entry_id AND e.company_id=l.company_id
    WHERE l.company_id=p_company_id AND e.status='posted' AND e.entry_date<=p_to_date
    GROUP BY l.account_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'accountId',a.account_code,'description',a.name,
    'openingDebitBalance',greatest(coalesce(m.opening_debit_total,0)-coalesce(m.opening_credit_total,0),0),
    'openingCreditBalance',greatest(coalesce(m.opening_credit_total,0)-coalesce(m.opening_debit_total,0),0),
    'closingDebitBalance',greatest(coalesce(m.closing_debit_total,0)-coalesce(m.closing_credit_total,0),0),
    'closingCreditBalance',greatest(coalesce(m.closing_credit_total,0)-coalesce(m.closing_debit_total,0),0),
    'groupingCategory',CASE
      WHEN a.pgc_class=9 THEN CASE WHEN a.account_level=1 THEN 'AR' WHEN a.is_group THEN 'AA' ELSE 'AM' END
      ELSE CASE WHEN a.account_level=1 THEN 'GR' WHEN a.is_group THEN 'GA' ELSE 'GM' END END,
    'groupingCode',parent.account_code
  ) ORDER BY a.account_code),'[]'::jsonb)
  INTO v_accounts
  FROM public.ks_chart_of_accounts a
  LEFT JOIN movements m ON m.account_id=a.id
  LEFT JOIN public.ks_chart_of_accounts parent ON parent.id=a.parent_id AND parent.company_id=a.company_id AND parent.is_active
  WHERE a.company_id=p_company_id AND a.is_active;

  IF EXISTS(
    SELECT 1 FROM public.ks_chart_of_accounts a
    LEFT JOIN public.ks_chart_of_accounts parent ON parent.id=a.parent_id AND parent.company_id=a.company_id AND parent.is_active
    WHERE a.company_id=p_company_id AND a.is_active AND a.account_level>1 AND parent.id IS NULL
  ) THEN RAISE EXCEPTION 'Há contas sem conta agregadora activa. Corrija a hierarquia do plano de contas.'; END IF;

  WITH ranked_lines AS (
    SELECT l.*,a.account_code,
      row_number() OVER(PARTITION BY l.journal_entry_id ORDER BY l.id) AS record_id
    FROM public.ks_journal_lines l
    JOIN public.ks_chart_of_accounts a ON a.id=l.account_id AND a.company_id=l.company_id
    WHERE l.company_id=p_company_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'transactionId',e.entry_date::text||' '||e.source_user_code||' '||e.entry_number,
    'transactionDate',e.entry_date,'sourceId',e.source_user_code,
    'description',e.description,'docArchivalNumber',e.entry_number,
    'transactionType','N','glPostingDate',e.entry_date,
    'systemEntryDate',to_char(e.created_at AT TIME ZONE 'Africa/Luanda','YYYY-MM-DD"T"HH24:MI:SS'),
    'journalId','GERAL','journalDescription','Diário geral','status','posted',
    'lines',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'recordId',rl.record_id::text,'accountId',rl.account_code,
      'debit',rl.debit,'credit',rl.credit,
      'systemEntryDate',to_char(e.created_at AT TIME ZONE 'Africa/Luanda','YYYY-MM-DD"T"HH24:MI:SS'),
      'description',e.description
    ) ORDER BY rl.record_id),'[]'::jsonb)
      FROM ranked_lines rl WHERE rl.journal_entry_id=e.id)
  ) ORDER BY e.entry_date,e.entry_number),'[]'::jsonb)
  INTO v_entries
  FROM public.ks_journal_entries e
  WHERE e.company_id=p_company_id AND e.status='posted' AND e.entry_date BETWEEN p_from_date AND p_to_date;

  IF EXISTS(
    SELECT 1 FROM public.ks_journal_entries e
    WHERE e.company_id=p_company_id AND e.status='posted' AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND (e.source_user_code IS NULL OR e.source_user_code !~ '^[^ ]{1,30}$'
        OR length(e.entry_number)>20 OR e.entry_number ~ '\s')
  ) THEN RAISE EXCEPTION 'Existem lançamentos sem identificador de utilizador SAF-T ou com número de arquivo inválido. Reveja os lançamentos históricos.'; END IF;

  RETURN jsonb_build_object('company',v_company,'period',v_period,'accounts',v_accounts,'entries',v_entries,
    'dateCreated',to_char(now() AT TIME ZONE 'Africa/Luanda','YYYY-MM-DD'));
END;
$function$;

REVOKE ALL ON FUNCTION private.ks_accounting_saft_snapshot(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.ks_accounting_saft_snapshot(uuid,date,date) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ks_accounting_saft_snapshot(p_company_id uuid,p_from_date date,p_to_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.ks_accounting_saft_snapshot($1,$2,$3); $function$;
REVOKE ALL ON FUNCTION public.ks_accounting_saft_snapshot(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ks_accounting_saft_snapshot(uuid,date,date) TO authenticated;
