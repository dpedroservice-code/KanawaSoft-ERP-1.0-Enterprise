CREATE TABLE IF NOT EXISTS public.ks_commercial_policies (
  company_id uuid PRIMARY KEY REFERENCES public.ks_companies(id) ON DELETE CASCADE,
  max_discount_percent numeric(5,2) NOT NULL DEFAULT 5 CHECK(max_discount_percent BETWEEN 0 AND 100),
  max_sale_amount numeric(18,2) CHECK(max_sale_amount IS NULL OR max_sale_amount>=0),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ks_commercial_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ks_commercial_policies_read ON public.ks_commercial_policies;
CREATE POLICY ks_commercial_policies_read ON public.ks_commercial_policies
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.ks_company_memberships m
      WHERE m.company_id=ks_commercial_policies.company_id AND m.user_id=auth.uid() AND m.status='active')
  );

CREATE OR REPLACE FUNCTION private.ks_apply_commercial_approval_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status='pending' AND NEW.status='approved' THEN
    IF NEW.request_type='discount' THEN
      IF NEW.approved_amount IS NULL OR NEW.approved_amount<0 OR NEW.approved_amount>100 THEN
        RAISE EXCEPTION 'O limite de desconto deve estar entre 0 e 100 por cento.' USING errcode='22023';
      END IF;
      INSERT INTO public.ks_commercial_policies(company_id,max_discount_percent,updated_by,updated_at)
      VALUES(NEW.company_id,NEW.approved_amount,NEW.decided_by,now())
      ON CONFLICT(company_id) DO UPDATE SET max_discount_percent=excluded.max_discount_percent,updated_by=excluded.updated_by,updated_at=now();
    ELSIF NEW.request_type='sales_limit' THEN
      IF NEW.approved_amount IS NULL OR NEW.approved_amount<0 THEN
        RAISE EXCEPTION 'O limite máximo de venda deve ser válido.' USING errcode='22023';
      END IF;
      INSERT INTO public.ks_commercial_policies(company_id,max_discount_percent,max_sale_amount,updated_by,updated_at)
      VALUES(NEW.company_id,5,NEW.approved_amount,NEW.decided_by,now())
      ON CONFLICT(company_id) DO UPDATE SET max_sale_amount=excluded.max_sale_amount,updated_by=excluded.updated_by,updated_at=now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS ks_apply_commercial_approval_policy ON public.ks_commercial_approvals;
CREATE TRIGGER ks_apply_commercial_approval_policy
  AFTER UPDATE OF status ON public.ks_commercial_approvals
  FOR EACH ROW EXECUTE FUNCTION private.ks_apply_commercial_approval_policy();
REVOKE ALL ON FUNCTION private.ks_apply_commercial_approval_policy() FROM PUBLIC,anon,authenticated;
