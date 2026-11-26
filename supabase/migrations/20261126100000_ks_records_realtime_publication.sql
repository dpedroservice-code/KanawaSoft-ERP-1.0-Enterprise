-- Enable tenant-scoped Realtime notifications for the shared record mirror.
-- This migration is committed for review only; do not apply it to production without approval.
DO $$
BEGIN
  IF to_regclass('public.ks_records') IS NULL THEN
    RAISE EXCEPTION 'Realtime setup blocked: public.ks_records does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Realtime setup blocked: publication supabase_realtime does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ks_records'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ks_records';
  END IF;
END
$$;
