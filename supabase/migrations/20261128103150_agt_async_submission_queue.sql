-- AGT asynchronous submission queue. Server-only writes; no client can mutate fiscal submission state.
create table if not exists public.ks_agt_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ks_companies(id) on delete cascade,
  document_id uuid not null references public.ks_fiscal_documents(id) on delete cascade,
  submission_guid uuid not null unique,
  request_id varchar(15),
  status text not null default 'PENDENTE' check (status in ('PENDENTE','SUBMETIDO','VALIDADO','REJEITADO','ERRO_REDE')),
  payload jsonb not null,
  submission_response jsonb,
  status_response jsonb,
  error_details jsonb not null default '{}'::jsonb,
  http_status integer,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz,
  submitted_at timestamptz,
  checked_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, document_id)
);
create index if not exists ks_agt_submissions_poll_idx on public.ks_agt_submissions(status, next_retry_at) where status in ('SUBMETIDO','ERRO_REDE');
create index if not exists ks_agt_submissions_company_created_idx on public.ks_agt_submissions(company_id, created_at desc);
alter table public.ks_agt_submissions enable row level security;
revoke all on public.ks_agt_submissions from anon, authenticated;
grant all on public.ks_agt_submissions to service_role;
