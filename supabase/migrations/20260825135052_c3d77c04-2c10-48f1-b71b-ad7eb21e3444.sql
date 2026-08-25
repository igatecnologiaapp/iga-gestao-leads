-- Agendamentos: autoria obrigatoriamente do próprio usuário
DROP POLICY IF EXISTS la_insert ON public.lead_appointments;
CREATE POLICY la_insert ON public.lead_appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_lead(lead_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- Documentos comerciais: responsável só pode ser outro usuário se quem cria for admin
DROP POLICY IF EXISTS cd_insert ON public.commercial_documents;
CREATE POLICY cd_insert ON public.commercial_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_lead(lead_id)
    AND created_by = auth.uid()
    AND (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

-- Ruas: cadastro liberado (fluxo de captação), alteração/exclusão apenas admin
DROP POLICY IF EXISTS st_write ON public.streets;
CREATE POLICY st_insert ON public.streets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY st_update_admin ON public.streets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY st_delete_admin ON public.streets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bairros: escrita exclusiva de administradores
DROP POLICY IF EXISTS nb_write ON public.neighborhoods;
CREATE POLICY nb_write_admin ON public.neighborhoods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));