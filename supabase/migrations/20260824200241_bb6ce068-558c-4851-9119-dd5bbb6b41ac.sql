CREATE OR REPLACE FUNCTION public.tg_guard_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Sem usuário autenticado no contexto = operação administrativa do servidor
  -- (service_role). Usuários anônimos não possuem política de UPDATE em profiles,
  -- portanto não alcançam este gatilho.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.can_view_all_leads IS DISTINCT FROM OLD.can_view_all_leads
     OR NEW.can_delete_documents IS DISTINCT FROM OLD.can_delete_documents
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.job_role_id IS DISTINCT FROM OLD.job_role_id THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar permissões, função/cargo ou o status do usuário.';
  END IF;
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION public.tg_guard_profile_privileges() FROM PUBLIC, anon, authenticated;