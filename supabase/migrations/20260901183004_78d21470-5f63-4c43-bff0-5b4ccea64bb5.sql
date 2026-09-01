-- ============ Origem do Lead ============
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_external_id text,
  ADD COLUMN IF NOT EXISTS source_searched_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_region text;

CREATE INDEX IF NOT EXISTS leads_source_external_id_idx ON public.leads (source_external_id);

-- ============ Enums ============
DO $$ BEGIN
  CREATE TYPE public.route_status AS ENUM ('planejado','em_andamento','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.route_stop_status AS ENUM ('pendente','em_deslocamento','em_visita','visitado','nao_visitado','reagendado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.visit_result AS ENUM ('responsavel_ausente','contato_realizado','sem_interesse','interessado','demonstracao','proposta','follow_up','venda','nao_informado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Veículos ============
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  plate text,
  fuel_type text NOT NULL DEFAULT 'gasolina',
  avg_consumption numeric NOT NULL DEFAULT 10,
  fuel_price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY veh_select ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY veh_insert ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY veh_update ON public.vehicles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY veh_delete ON public.vehicles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_vehicles_touch BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Roteiros ============
CREATE TABLE public.visit_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  route_date date NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  departure_time time,
  available_minutes integer,
  start_label text,
  start_address text,
  start_latitude double precision,
  start_longitude double precision,
  end_label text,
  end_address text,
  end_latitude double precision,
  end_longitude double precision,
  vehicle_id uuid REFERENCES public.vehicles(id),
  segment_id uuid REFERENCES public.segments(id),
  region text,
  city text,
  state text,
  notes text,
  status public.route_status NOT NULL DEFAULT 'planejado',
  started_at timestamptz,
  finished_at timestamptz,
  planned_distance_km numeric,
  actual_distance_km numeric,
  planned_duration_minutes integer,
  actual_duration_minutes integer,
  estimated_cost numeric,
  actual_cost numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_routes TO authenticated;
GRANT ALL ON public.visit_routes TO service_role;
ALTER TABLE public.visit_routes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_route(_route_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.visit_routes r
    WHERE r.id = _route_id
      AND (public.has_role(auth.uid(), 'admin') OR r.owner_id = auth.uid() OR r.created_by = auth.uid())
  )
$$;

CREATE POLICY vr_select ON public.visit_routes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY vr_insert ON public.visit_routes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid()));
CREATE POLICY vr_update ON public.visit_routes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY vr_delete ON public.visit_routes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

CREATE TRIGGER trg_visit_routes_touch BEFORE UPDATE ON public.visit_routes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Paradas do roteiro ============
CREATE TABLE public.visit_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.visit_routes(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 2,
  address text,
  latitude double precision,
  longitude double precision,
  planned_time time,
  planned_travel_minutes integer,
  planned_visit_minutes integer NOT NULL DEFAULT 20,
  actual_travel_minutes integer,
  actual_visit_minutes integer,
  status public.route_stop_status NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, lead_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_route_stops TO authenticated;
GRANT ALL ON public.visit_route_stops TO service_role;
ALTER TABLE public.visit_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY vrs_select ON public.visit_route_stops FOR SELECT TO authenticated
  USING (public.can_access_route(route_id));
CREATE POLICY vrs_insert ON public.visit_route_stops FOR INSERT TO authenticated
  WITH CHECK (public.can_access_route(route_id) AND public.can_access_lead(lead_id));
CREATE POLICY vrs_update ON public.visit_route_stops FOR UPDATE TO authenticated
  USING (public.can_access_route(route_id)) WITH CHECK (public.can_access_route(route_id));
CREATE POLICY vrs_delete ON public.visit_route_stops FOR DELETE TO authenticated
  USING (public.can_access_route(route_id));

CREATE TRIGGER trg_visit_route_stops_touch BEFORE UPDATE ON public.visit_route_stops
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX visit_route_stops_route_idx ON public.visit_route_stops (route_id, sort_order);
CREATE INDEX visit_route_stops_lead_idx ON public.visit_route_stops (lead_id);

-- ============ Visitas ============
CREATE TABLE public.lead_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.visit_routes(id) ON DELETE SET NULL,
  stop_id uuid REFERENCES public.visit_route_stops(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  arrived_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  duration_minutes integer,
  travel_minutes integer,
  distance_km numeric,
  result public.visit_result NOT NULL DEFAULT 'nao_informado',
  contact_person text,
  notes text,
  next_contact_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_visits TO authenticated;
GRANT ALL ON public.lead_visits TO service_role;
ALTER TABLE public.lead_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY lv_select ON public.lead_visits FOR SELECT TO authenticated
  USING (public.can_access_lead(lead_id));
CREATE POLICY lv_insert ON public.lead_visits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_lead(lead_id));
CREATE POLICY lv_update ON public.lead_visits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
CREATE POLICY lv_delete ON public.lead_visits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE TRIGGER trg_lead_visits_touch BEFORE UPDATE ON public.lead_visits
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX lead_visits_lead_idx ON public.lead_visits (lead_id);
CREATE INDEX lead_visits_route_idx ON public.lead_visits (route_id);