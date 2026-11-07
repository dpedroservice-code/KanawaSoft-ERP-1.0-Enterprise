-- Legal/compliance register for Angola. References are informational and must be reviewed by counsel.
create table if not exists public.ks_legal_register (
 id uuid primary key default gen_random_uuid(), company_id uuid references public.ks_companies(id) on delete cascade,
 jurisdiction text not null default 'AO', instrument_code text not null, title text not null,
 subject_area text not null, source_url text, status text not null default 'to_review',
 effective_from date, last_verified_at timestamptz, notes text, created_at timestamptz not null default now(),
 unique(company_id,instrument_code)
);
create table if not exists public.ks_policy_acceptances (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null, policy_code text not null, policy_version text not null,
 accepted_at timestamptz not null default now(), acceptance_method text not null default 'in_app',
 evidence jsonb not null default '{}'::jsonb
);
create table if not exists public.ks_compliance_tasks (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.ks_companies(id) on delete cascade,
 requirement_code text not null, title text not null, owner_user_id uuid references auth.users(id),
 due_date date, status text not null default 'pending', evidence_path text, notes text,
 completed_at timestamptz, created_at timestamptz not null default now()
);
alter table public.ks_legal_register enable row level security;
alter table public.ks_policy_acceptances enable row level security;
alter table public.ks_compliance_tasks enable row level security;
create policy ks_legal_register_read on public.ks_legal_register for select to authenticated using (
 company_id is null or private.ks_has_company_role(company_id,array['owner','admin','manager','cashier','operator','gerente','caixa','operador']::text[])
);
create policy ks_legal_register_manage on public.ks_legal_register for all to authenticated using (
 company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
) with check (
 company_id is not null and private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
);
create policy ks_policy_acceptances_read on public.ks_policy_acceptances for select to authenticated using (
 private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[]) or user_id=(select auth.uid())
);
create policy ks_policy_acceptances_insert on public.ks_policy_acceptances for insert to authenticated with check (
 user_id=(select auth.uid()) and private.ks_has_company_role(company_id,array['owner','admin','manager','cashier','operator','gerente','caixa','operador']::text[])
);
create policy ks_compliance_tasks_all on public.ks_compliance_tasks for all to authenticated using (
 private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
) with check (
 private.ks_has_company_role(company_id,array['owner','admin','manager','gerente']::text[])
);
insert into public.ks_legal_register(company_id,jurisdiction,instrument_code,title,subject_area,source_url,status,notes)
values
(null,'AO','Lei 22/11','Lei da Protecção de Dados Pessoais','Privacidade e dados pessoais','https://apd.ao/ao/legislacao/','to_review','Validar obrigações aplicáveis, base legal, informação aos titulares, segurança, conservação e direitos.'),
(null,'AO','Lei 23/11','Lei das Comunicações Electrónicas e dos Serviços da Sociedade da Informação','Comércio e serviços digitais','https://apd.ao/ao/legislacao/','to_review','Avaliar aplicabilidade ao serviço digital e comunicações electrónicas.'),
(null,'AO','Lei 7/17','Lei de Protecção das Redes e Sistemas Informáticos','Cibersegurança','https://apd.ao/ao/legislacao/','to_review','Rever controlos de segurança, incidentes e responsabilidades.'),
(null,'AO','Lei 2/20','Lei da Videovigilância','CCTV e dados pessoais','https://apd.ao/ao/legislacao/','to_review','Relevante para clientes que gerem videovigilância; não presumir autorização ou conformidade automática.'),
(null,'AO','Lei 15/03','Lei de Defesa do Consumidor','Comércio e e-commerce','https://www.diariodarepublica.gov.ao/','to_review','Rever informação pré-contratual, reclamações, garantias e práticas comerciais.'),
(null,'AO','Lei 12/23','Lei Geral do Trabalho','Recursos humanos','https://www.lgt.gov.ao/wp-content/uploads/2025/05/Livro-da-Lei-Geral-do-Trabalho.pdf','to_review','Revê contratos, horários, férias, remunerações e processos disciplinares com apoio jurídico.'),
(null,'AO','Lei 7/19','Código do Imposto sobre o Valor Acrescentado','Fiscalidade e faturação','https://portaldocontribuinte.minfin.gov.ao/legislacao','to_review','Consultar texto consolidado e alterações vigentes na AGT antes de configurar taxas ou declarações.'),
(null,'AO','Lei 21/14','Código Geral Tributário','Fiscalidade','https://portaldocontribuinte.minfin.gov.ao/legislacao','to_review','Consultar alterações, regulamentos e circulares vigentes no Portal do Contribuinte.')
on conflict(company_id,instrument_code) do nothing;
