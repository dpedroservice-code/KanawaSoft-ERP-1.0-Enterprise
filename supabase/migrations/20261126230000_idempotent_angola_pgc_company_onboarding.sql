-- Make the Angola PGC seed safe to run during company onboarding and retries.
-- Existing/custom accounts are preserved; missing PGC accounts are inserted once.
CREATE OR REPLACE FUNCTION public.ks_seed_angola_chart_of_accounts(
  p_company_id uuid,
  p_accounts jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_account record;
  v_parent_id uuid;
  v_count integer := 0;
  v_rows_inserted integer := 0;
BEGIN
  IF NOT private.ks_has_company_permission(p_company_id,'contabilidade','editar') THEN
    RAISE EXCEPTION 'Sem permissões para importar o plano de contas.' USING errcode='42501';
  END IF;

  IF coalesce(jsonb_typeof(p_accounts),'') <> 'array'
     OR jsonb_array_length(p_accounts) < 1
     OR jsonb_array_length(p_accounts) > 1000 THEN
    RAISE EXCEPTION 'O plano de contas enviado é inválido.' USING errcode='22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_accounts) AS x(code text)
    GROUP BY code
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'O plano de contas contém códigos duplicados.' USING errcode='22023';
  END IF;

  -- Serialize seeds for the same tenant so concurrent first logins cannot race.
  PERFORM pg_advisory_xact_lock(hashtextextended('ks-pgc:' || p_company_id::text, 0));

  FOR v_account IN
    SELECT *
    FROM jsonb_to_recordset(p_accounts) AS x(
      code text,
      name text,
      description text,
      pgc_class smallint,
      account_type text,
      normal_balance text,
      parent_code text,
      level smallint,
      is_group boolean,
      is_system boolean,
      is_off_balance boolean
    )
    ORDER BY level, code
  LOOP
    IF nullif(trim(v_account.code),'') IS NULL
       OR nullif(trim(v_account.name),'') IS NULL
       OR v_account.account_type NOT IN ('asset','liability','equity','income','expense')
       OR v_account.normal_balance NOT IN ('debit','credit') THEN
      RAISE EXCEPTION 'Conta PGC inválida: %',v_account.code USING errcode='22023';
    END IF;

    v_parent_id := NULL;
    IF v_account.parent_code IS NOT NULL THEN
      SELECT id INTO v_parent_id
      FROM public.ks_chart_of_accounts
      WHERE company_id=p_company_id
        AND account_code=v_account.parent_code;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Conta principal não encontrada para %',v_account.code;
      END IF;
    END IF;

    INSERT INTO public.ks_chart_of_accounts(
      company_id,account_code,name,description,account_type,parent_id,pgc_class,account_level,
      normal_balance,is_group,is_system,is_off_balance,is_active
    ) VALUES (
      p_company_id,trim(v_account.code),trim(v_account.name),nullif(trim(v_account.description),''),
      v_account.account_type,v_parent_id,v_account.pgc_class,v_account.level,v_account.normal_balance,
      coalesce(v_account.is_group,false),true,coalesce(v_account.is_off_balance,false),true
    )
    ON CONFLICT(company_id,account_code) DO NOTHING;

    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
    v_count := v_count + v_rows_inserted;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted',v_count,
    'source','PGC Angola — Decreto n.º 82/01',
    'off_balance_accounts',(
      SELECT count(*)
      FROM public.ks_chart_of_accounts
      WHERE company_id=p_company_id AND is_off_balance
    ),
    'total_accounts',(
      SELECT count(*)
      FROM public.ks_chart_of_accounts
      WHERE company_id=p_company_id
    )
  );
END;
$function$;
