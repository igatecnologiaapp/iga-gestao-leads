CREATE OR REPLACE FUNCTION public.tg_guard_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Operações administrativas do próprio sistema (service_role) são confiáveis:
  -- as regras de autorização são aplicadas nas server functions.
  IF current_user = 'service_role' OR session_user = 'service_role' THEN
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