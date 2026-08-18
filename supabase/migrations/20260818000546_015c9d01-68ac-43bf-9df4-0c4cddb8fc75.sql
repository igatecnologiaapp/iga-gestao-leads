CREATE OR REPLACE FUNCTION public.tg_guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.can_view_all_leads IS DISTINCT FROM OLD.can_view_all_leads
     OR NEW.can_delete_documents IS DISTINCT FROM OLD.can_delete_documents
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar permissões ou o status do usuário.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_profile_privileges();