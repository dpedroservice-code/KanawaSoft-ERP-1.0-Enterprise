-- Paid subscriptions provide the full ERP without usage caps.
-- The 14-day evaluation remains intentionally limited; paid tiers are unlimited.
update public.ks_saas_plans
set max_users = 0,
    max_installations = 0,
    max_invoices_period = 0,
    features = coalesce(features,'{}'::jsonb) || jsonb_build_object('all_modules',true,'unlimited_usage',true)
where plan_code in ('mini','standard','premium','enterprise');
