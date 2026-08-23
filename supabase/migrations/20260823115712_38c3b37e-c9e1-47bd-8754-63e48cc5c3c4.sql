CREATE TABLE public.job_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX job_roles_name_unique ON public.job_roles (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles TO authenticated;
GRANT ALL ON public.job_roles TO service_role;

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_roles_select_authenticated" ON public.job_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_roles_admin_manage" ON public.job_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER job_roles_updated
  BEFORE UPDATE ON public.job_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN job_role_id uuid REFERENCES public.job_roles(id);

CREATE OR REPLACE FUNCTION public.tg_block_job_role_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE job_role_id = OLD.id) THEN
    RAISE EXCEPTION 'Função/cargo vinculada a usuários: inative em vez de excluir.';
  END IF;
  RETURN OLD;
END; $$;

CREATE TRIGGER trg_block_job_role_delete
  BEFORE DELETE ON public.job_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_job_role_delete();

CREATE OR REPLACE FUNCTION public.tg_guard_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
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
END; $$;

INSERT INTO public.job_roles (name, description, sort_order) VALUES
  ('Captador', 'Responsável pela captação de leads em campo.', 1),
  ('Colaborador', 'Colaborador geral da operação.', 2),
  ('Vendedor', 'Responsável por vendas e negociações.', 3),
  ('Consultor Comercial', 'Consultoria comercial e propostas.', 4),
  ('Supervisor', 'Supervisão da equipe comercial.', 5);