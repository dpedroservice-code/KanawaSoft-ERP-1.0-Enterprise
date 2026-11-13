-- Add leading-column indexes for foreign-key checks identified by the Supabase advisor.
-- Tables were measured before this migration: ks_fiscal_documents ~112 kB (3 rows),
-- ks_journal_entries ~64 kB (0 rows). Partial indexes omit NULL references.

create index if not exists ks_fiscal_documents_created_by_fk_idx
  on public.ks_fiscal_documents(created_by)
  where created_by is not null;

create index if not exists ks_fiscal_documents_source_document_fk_idx
  on public.ks_fiscal_documents(source_document_id)
  where source_document_id is not null;

create index if not exists ks_fiscal_documents_source_sale_fk_idx
  on public.ks_fiscal_documents(source_sale_id)
  where source_sale_id is not null;

create index if not exists ks_journal_entries_created_by_user_fk_idx
  on public.ks_journal_entries(created_by_user_id)
  where created_by_user_id is not null;
