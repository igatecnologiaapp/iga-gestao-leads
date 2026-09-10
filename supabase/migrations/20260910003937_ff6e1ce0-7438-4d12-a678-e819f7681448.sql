CREATE TABLE public.lead_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment_id uuid REFERENCES public.segments(id),
  segment_name text,
  region text,
  city text,
  state text,
  radius_km numeric,
  requested_count integer NOT NULL DEFAULT 0,
  found_count integer NOT NULL DEFAULT 0,
  selected_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  provider text,
  status text NOT NULL DEFAULT 'arquivada',
  notes text,
  owner_id uuid NOT NULL,
  created_by uuid NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_searches TO authenticated;
GRANT ALL ON public.lead_searches TO service_role;

ALTER TABLE public.lead_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY ls_select ON public.lead_searches FOR SELECT TO authenticated
USING (created_by = auth.uid() OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR can_view_all_leads(auth.uid()));

CREATE POLICY ls_insert ON public.lead_searches FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY ls_update ON public.lead_searches FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid() OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY ls_delete ON public.lead_searches FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_lead_searches_touch BEFORE UPDATE ON public.lead_searches
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX idx_lead_searches_searched_at ON public.lead_searches (searched_at DESC);

ALTER TABLE public.leads ADD COLUMN search_id uuid REFERENCES public.lead_searches(id) ON DELETE SET NULL;
CREATE INDEX idx_leads_search_id ON public.leads (search_id);