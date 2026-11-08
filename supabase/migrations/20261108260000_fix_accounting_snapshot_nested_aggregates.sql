-- Fix nested aggregates in the accounting snapshot without changing the existing ks_* schema.
-- Aggregate journal movements per account first; JSON aggregation happens in the outer query.
CREATE OR REPLACE FUNCTION private.ks_accounting_snapshot(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','ver') THEN
    RAISE EXCEPTION 'Sem permissões para consultar a contabilidade.' USING errcode='42501';
  END IF;

  WITH account_totals AS (
    SELECT
      a.id AS account_id,
      coalesce(sum(l.debit) FILTER (WHERE e.id IS NOT NULL),0) AS debit_total,
      coalesce(sum(l.credit) FILTER (WHERE e.id IS NOT NULL),0) AS credit_total,
      coalesce(sum(l.debit-l.credit) FILTER (WHERE e.id IS NOT NULL),0) AS balance
    FROM public.ks_chart_of_accounts a
    LEFT JOIN public.ks_journal_lines l
      ON l.account_id=a.id AND l.company_id=a.company_id
    LEFT JOIN public.ks_journal_entries e
      ON e.id=l.journal_entry_id
      AND e.company_id=a.company_id
      AND e.status='posted'
    WHERE a.company_id=p_company_id AND a.is_active
    GROUP BY a.id
  )
  SELECT jsonb_build_object(
    'accounts',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,
        'account_code',a.account_code,
        'name',a.name,
        'description',a.description,
        'account_type',a.account_type,
        'parent_id',a.parent_id,
        'pgc_class',a.pgc_class,
        'account_level',a.account_level,
        'normal_balance',a.normal_balance,
        'is_group',a.is_group,
        'is_system',a.is_system,
        'is_off_balance',a.is_off_balance,
        'debit_total',t.debit_total,
        'credit_total',t.credit_total,
        'balance',t.balance
      ) ORDER BY a.account_code)
      FROM public.ks_chart_of_accounts a
      JOIN account_totals t ON t.account_id=a.id
      WHERE a.company_id=p_company_id AND a.is_active
    ),'[]'::jsonb),
    'entries',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,
        'entry_number',e.entry_number,
        'entry_date',e.entry_date,
        'description',e.description,
        'status',e.status,
        'debit_total',coalesce((
          SELECT sum(l.debit)
          FROM public.ks_journal_lines l
          WHERE l.journal_entry_id=e.id AND l.company_id=e.company_id
        ),0),
        'credit_total',coalesce((
          SELECT sum(l.credit)
          FROM public.ks_journal_lines l
          WHERE l.journal_entry_id=e.id AND l.company_id=e.company_id
        ),0)
      ) ORDER BY e.entry_date DESC,e.created_at DESC)
      FROM (
        SELECT *
        FROM public.ks_journal_entries
        WHERE company_id=p_company_id
        ORDER BY entry_date DESC,created_at DESC
        LIMIT 200
      ) e
    ),'[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
