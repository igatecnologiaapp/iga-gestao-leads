ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS next_contact_date date;

CREATE INDEX IF NOT EXISTS leads_next_contact_date_idx
  ON public.leads (next_contact_date)
  WHERE deleted_at IS NULL;