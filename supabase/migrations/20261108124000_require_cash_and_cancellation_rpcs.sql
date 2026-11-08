-- Cash sessions and cancellation requests are created only by validated server RPCs.
DROP POLICY IF EXISTS ks_cash_sessions_insert ON public.ks_cash_sessions;
DROP POLICY IF EXISTS ks_sale_cancel_insert ON public.ks_sale_cancellation_requests;
