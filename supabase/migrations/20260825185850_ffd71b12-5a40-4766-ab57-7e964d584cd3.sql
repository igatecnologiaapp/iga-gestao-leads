ALTER TABLE public.lead_appointments ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.lead_appointments ALTER COLUMN created_by SET NOT NULL;

DROP POLICY IF EXISTS la_insert ON public.lead_appointments;
CREATE POLICY la_insert ON public.lead_appointments
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_lead(lead_id) AND created_by = auth.uid());