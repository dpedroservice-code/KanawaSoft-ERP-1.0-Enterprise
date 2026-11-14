-- Kanawa Soft ERP — F0 read-only audit
-- Somente SELECT/CTE. Não altera schema, políticas, funções ou dados.
-- Executar preferencialmente com role de leitura no projecto isolado.

-- 1) Tabelas e estado RLS por schema
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2;

-- 2) Colunas com provável chave de tenant (company_id e nomes comuns)
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
  AND column_name IN ('company_id','tenant_id','organization_id','org_id')
ORDER BY 1,2,3;

-- 3) Tabelas RLS e políticas, incluindo expressões
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, policyname;

-- 4) Grants explícitos em tabelas/views/sequences
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2,3,4;

-- 5) Funções SECURITY DEFINER, owner, search_path e grants
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       p.proacl AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2,3;

-- 6) Foreign keys e definição
SELECT ns.nspname AS schema_name, tbl.relname AS table_name,
       con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition,
       con.convalidated AS validated
FROM pg_constraint con
JOIN pg_class tbl ON tbl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
WHERE con.contype = 'f'
  AND ns.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2,3;

-- 7) Índices existentes (não inferir que índice unused deve ser removido)
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2,3;

-- 8) Triggers não internos
SELECT event_object_schema, event_object_table, trigger_name,
       event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_schema NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2,3,4;

-- 9) Existência de tabelas de migrations/ledger e tabelas fiscais
-- A consulta só informa presença; não assume o nome do ledger da ferramenta.
SELECT to_regclass('supabase_migrations.schema_migrations') AS supabase_migration_ledger,
       to_regclass('public.schema_migrations') AS public_migration_ledger,
       to_regclass('public.ks_fiscal_documents') AS fiscal_documents,
       to_regclass('public.ks_company_licenses') AS company_licenses,
       to_regclass('public.ks_payment_requests') AS payment_requests;

-- 10) Consultar versões aplicadas manualmente apenas se o ledger padrão existir.
-- Se a relação existir, executar separadamente:
-- SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- Caso contrário, identificar primeiro a ferramenta/tabela de migrations do projecto.
