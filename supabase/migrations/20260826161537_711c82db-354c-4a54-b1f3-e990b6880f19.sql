ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE TABLE IF NOT EXISTS public.user_admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_email text,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_admin_events TO authenticated;
GRANT ALL ON public.user_admin_events TO service_role;

ALTER TABLE public.user_admin_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver eventos administrativos"
  ON public.user_admin_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));