-- 1) Tipo produto/serviço
ALTER TABLE public.products_services
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'servico';
ALTER TABLE public.products_services
  DROP CONSTRAINT IF EXISTS products_services_kind_check;
ALTER TABLE public.products_services
  ADD CONSTRAINT products_services_kind_check CHECK (kind IN ('produto','servico'));
CREATE INDEX IF NOT EXISTS idx_products_services_kind ON public.products_services(kind);
CREATE INDEX IF NOT EXISTS idx_products_services_category ON public.products_services(category_id);

-- 2) Unidades de medida padronizadas
CREATE TABLE IF NOT EXISTS public.measurement_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_units TO authenticated;
GRANT ALL ON public.measurement_units TO service_role;
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mu_read ON public.measurement_units;
CREATE POLICY mu_read ON public.measurement_units FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS mu_admin ON public.measurement_units;
CREATE POLICY mu_admin ON public.measurement_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.measurement_units (code, name, sort_order) VALUES
  ('UN','Unidade',1),('KG','Quilograma',2),('G','Grama',3),('L','Litro',4),('ML','Mililitro',5),
  ('M','Metro',6),('M²','Metro quadrado',7),('M³','Metro cúbico',8),('H','Hora',9),
  ('DIA','Dia',10),('MÊS','Mês',11),('SERVIÇO','Serviço',12)
ON CONFLICT (code) DO NOTHING;

-- 3) Bloqueia exclusão física de produtos/serviços já utilizados
CREATE OR REPLACE FUNCTION public.tg_block_product_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lead_products WHERE product_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.commercial_document_items WHERE product_id = OLD.id) THEN
    RAISE EXCEPTION 'Produto/serviço já utilizado no histórico: inative em vez de excluir.';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_block_product_delete ON public.products_services;
CREATE TRIGGER trg_block_product_delete BEFORE DELETE ON public.products_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_product_delete();

-- 4) Permissão explícita de exclusão de documentos comerciais
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_delete_documents boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_delete_documents(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin')
      OR COALESCE((SELECT can_delete_documents FROM public.profiles WHERE id = _user_id), false)
$$;

-- 5) Exclusão lógica autorizada no banco
CREATE OR REPLACE FUNCTION public.tg_guard_document_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF NOT public.can_delete_documents(auth.uid()) THEN
      RAISE EXCEPTION 'Sem permissão para excluir documentos comerciais.';
    END IF;
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_document_delete ON public.commercial_documents;
CREATE TRIGGER trg_guard_document_delete BEFORE UPDATE ON public.commercial_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_document_delete();

-- 6) Nenhum documento comercial pode ser apagado fisicamente (preserva numeração e histórico)
DROP POLICY IF EXISTS cd_delete_admin ON public.commercial_documents;
CREATE OR REPLACE FUNCTION public.tg_block_document_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Documentos comerciais só podem ser excluídos logicamente.';
END; $$;
DROP TRIGGER IF EXISTS trg_block_document_delete ON public.commercial_documents;
CREATE TRIGGER trg_block_document_delete BEFORE DELETE ON public.commercial_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_document_delete();