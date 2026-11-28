-- Cover the four foreign keys identified by the Supabase performance advisor.
-- Idempotent and safe to re-run; no application data is modified.
create index if not exists ix_ks_fiscal_documents_created_by
  on public.ks_fiscal_documents (created_by);
create index if not exists ix_ks_fiscal_documents_source_document_id
  on public.ks_fiscal_documents (source_document_id);
create index if not exists ix_ks_fiscal_documents_source_sale_id
  on public.ks_fiscal_documents (source_sale_id);
create index if not exists ix_ks_journal_entries_created_by_user_id
  on public.ks_journal_entries (created_by_user_id);
