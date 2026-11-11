-- Limit the anonymous Data API to the two intended public flows.
-- Company-scoped data remains available to authenticated users under existing RLS policies.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON TABLE public.ks_saas_plans TO anon;
GRANT INSERT ON TABLE public.ks_demo_requests TO anon;

-- Remove anonymous sequence access and prevent future objects created by postgres
-- from inheriting broad anonymous privileges.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
