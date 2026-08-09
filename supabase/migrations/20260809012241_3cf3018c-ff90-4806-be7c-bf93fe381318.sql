-- Enum de status do agendamento
CREATE TYPE public.appointment_status AS ENUM ('agendado','realizado','nao_realizado','cancelado');

-- Tipos de contato administráveis
CREATE TABLE public.contact_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_types TO authenticated;
GRANT ALL ON public.contact_types TO service_role;
ALTER TABLE public.contact_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_read ON public.contact_types FOR SELECT TO authenticated USING (true);
CREATE POLICY ct_admin ON public.contact_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ct_updated BEFORE UPDATE ON public.contact_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.contact_types (name, icon, sort_order) VALUES
  ('Presencial','MapPin',1),
  ('Online','Video',2);

-- Permissão de edição alinhada à do lead
CREATE OR REPLACE FUNCTION public.can_edit_lead(_lead_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = _lead_id
      AND (l.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
$$;

-- Agendamentos
CREATE TABLE public.lead_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  contact_type_id uuid REFERENCES public.contact_types(id),
  status public.appointment_status NOT NULL DEFAULT 'agendado',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_appointments_lead_idx ON public.lead_appointments(lead_id);
CREATE INDEX lead_appointments_when_idx ON public.lead_appointments(scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_appointments TO authenticated;
GRANT ALL ON public.lead_appointments TO service_role;
ALTER TABLE public.lead_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY la_read ON public.lead_appointments FOR SELECT TO authenticated
  USING (public.can_access_lead(lead_id));
CREATE POLICY la_insert ON public.lead_appointments FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_lead(lead_id));
CREATE POLICY la_update ON public.lead_appointments FOR UPDATE TO authenticated
  USING (public.can_edit_lead(lead_id)) WITH CHECK (public.can_edit_lead(lead_id));
CREATE POLICY la_delete ON public.lead_appointments FOR DELETE TO authenticated
  USING (public.can_edit_lead(lead_id));

CREATE TRIGGER la_updated BEFORE UPDATE ON public.lead_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migra previsões de retorno existentes para agendamentos (09:00 horário de São Paulo)
INSERT INTO public.lead_appointments (lead_id, scheduled_at, contact_type_id, status, notes, created_by)
SELECT l.id,
       ((l.next_contact_date::text || ' 09:00')::timestamp AT TIME ZONE 'America/Sao_Paulo'),
       (SELECT id FROM public.contact_types WHERE name = 'Presencial'),
       'agendado', 'Migrado da previsão de retorno', l.created_by
FROM public.leads l
WHERE l.next_contact_date IS NOT NULL;