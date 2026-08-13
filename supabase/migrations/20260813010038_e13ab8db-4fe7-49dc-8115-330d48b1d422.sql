
-- ===== Empresa emissora =====
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Empresa',
  legal_name text,
  cnpj text,
  email text,
  phone text,
  postal_code text,
  address text,
  city text,
  state text,
  logo_url text,
  footer_note text,
  default_validity_days integer NOT NULL DEFAULT 15,
  default_payment_terms text,
  whatsapp_template text NOT NULL DEFAULT 'Olá, [CONTATO]!

Conforme nosso contato, estamos enviando o [TIPO] nº [NUMERO] referente à [CLIENTE].

O documento segue em PDF para sua análise.

Ficamos à disposição para qualquer dúvida.

Atenciosamente,
[EMPRESA]
[TELEFONE_EMPRESA]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_read" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs_admin" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.company_settings (name, legal_name, cnpj, email, phone, postal_code, default_payment_terms, footer_note)
VALUES ('IGA TECNOLOGIA','31.683.996 ISRAEL DE FREITAS CORREA','31.683.996/0001-00','igasistemaseconsultoria@gmail.com','+55 (11) 2493-0031','03803-000','Transferência bancária, dinheiro, cartão de crédito, cartão de débito ou pix.','Iga Consultoria');

-- ===== Meios de pagamento =====
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_read" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "pm_admin" ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.payment_methods (name, sort_order) VALUES
  ('Pix',1),('Transferência bancária',2),('Dinheiro',3),('Cartão de crédito',4),('Cartão de débito',5),('Boleto',6);

-- ===== Categorias de itens =====
CREATE TABLE public.item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'servico' CHECK (kind IN ('servico','peca')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_categories TO authenticated;
GRANT ALL ON public.item_categories TO service_role;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_read" ON public.item_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ic_admin" ON public.item_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.item_categories (name, kind, sort_order) VALUES ('Serviços','servico',1),('Peças','peca',2);

-- ===== Produtos/Serviços: preço padrão, unidade, categoria =====
ALTER TABLE public.products_services
  ADD COLUMN IF NOT EXISTS default_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.item_categories(id) ON DELETE SET NULL;

-- ===== Documentos comerciais =====
CREATE TYPE public.commercial_doc_type AS ENUM ('orcamento','proposta','pedido');

CREATE TABLE public.commercial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type public.commercial_doc_type NOT NULL,
  doc_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  doc_number integer NOT NULL,
  number_label text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'rascunho',
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  -- snapshot do cliente
  client_company text NOT NULL DEFAULT '',
  client_contact text,
  client_phone text,
  client_email text,
  client_postal_code text,
  client_street text,
  client_number text,
  client_neighborhood text,
  client_city text,
  client_state text,
  client_segment text,
  -- comercial
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  payment_terms text,
  payment_deadline text,
  payment_notes text,
  notes text,
  discount_type text NOT NULL DEFAULT 'valor' CHECK (discount_type IN ('valor','percentual')),
  discount_value numeric(14,2) NOT NULL DEFAULT 0,
  total_services numeric(14,2) NOT NULL DEFAULT 0,
  total_parts numeric(14,2) NOT NULL DEFAULT 0,
  total_discount numeric(14,2) NOT NULL DEFAULT 0,
  total_general numeric(14,2) NOT NULL DEFAULT 0,
  converted_from_id uuid REFERENCES public.commercial_documents(id) ON DELETE SET NULL,
  issued_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, doc_year, doc_number)
);
CREATE INDEX idx_cd_lead ON public.commercial_documents(lead_id);
CREATE INDEX idx_cd_type_status ON public.commercial_documents(doc_type, status);
CREATE INDEX idx_cd_owner ON public.commercial_documents(owner_id);
CREATE INDEX idx_cd_deleted ON public.commercial_documents(deleted_at);

CREATE TABLE public.commercial_document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.commercial_documents(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.item_categories(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products_services(id) ON DELETE SET NULL,
  description text NOT NULL,
  extra_notes text,
  unit text,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  discount_value numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cdi_doc ON public.commercial_document_items(document_id);

CREATE TABLE public.commercial_document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.commercial_documents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  metadata jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cdh_doc ON public.commercial_document_history(document_id);

CREATE TABLE public.document_sequences (
  doc_type public.commercial_doc_type NOT NULL,
  doc_year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, doc_year)
);
GRANT SELECT ON public.document_sequences TO authenticated;
GRANT ALL ON public.document_sequences TO service_role;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds_read" ON public.document_sequences FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_documents TO authenticated;
GRANT ALL ON public.commercial_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_document_items TO authenticated;
GRANT ALL ON public.commercial_document_items TO service_role;
GRANT SELECT, INSERT ON public.commercial_document_history TO authenticated;
GRANT ALL ON public.commercial_document_history TO service_role;

ALTER TABLE public.commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_document_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cd_select" ON public.commercial_documents FOR SELECT TO authenticated
  USING (public.can_access_lead(lead_id));
CREATE POLICY "cd_insert" ON public.commercial_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_access_lead(lead_id) AND created_by = auth.uid());
CREATE POLICY "cd_update" ON public.commercial_documents FOR UPDATE TO authenticated
  USING (public.can_access_lead(lead_id) AND (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.can_access_lead(lead_id));
CREATE POLICY "cd_delete_admin" ON public.commercial_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.can_access_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.commercial_documents d
    WHERE d.id = _document_id AND public.can_access_lead(d.lead_id)
  )
$$;

CREATE POLICY "cdi_all" ON public.commercial_document_items FOR ALL TO authenticated
  USING (public.can_access_document(document_id)) WITH CHECK (public.can_access_document(document_id));
CREATE POLICY "cdh_read" ON public.commercial_document_history FOR SELECT TO authenticated
  USING (public.can_access_document(document_id));
CREATE POLICY "cdh_insert" ON public.commercial_document_history FOR INSERT TO authenticated
  WITH CHECK (public.can_access_document(document_id));

-- ===== Numeração segura =====
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type public.commercial_doc_type, _doc_year integer DEFAULT NULL)
RETURNS TABLE (doc_year integer, doc_number integer, number_label text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  y integer := COALESCE(_doc_year, EXTRACT(YEAR FROM now())::int);
  n integer;
BEGIN
  INSERT INTO public.document_sequences (doc_type, doc_year, last_number)
  VALUES (_doc_type, y, 1)
  ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_number = public.document_sequences.last_number + 1
  RETURNING public.document_sequences.last_number INTO n;
  RETURN QUERY SELECT y, n, lpad(n::text, 3, '0') || '-' || y::text;
END;
$$;

-- ===== Totais automáticos =====
CREATE OR REPLACE FUNCTION public.recalc_document_totals(_document_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  serv numeric(14,2) := 0;
  parts numeric(14,2) := 0;
  item_disc numeric(14,2) := 0;
  doc RECORD;
  general_disc numeric(14,2) := 0;
BEGIN
  SELECT * INTO doc FROM public.commercial_documents WHERE id = _document_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(c.kind,'servico') = 'peca' THEN 0 ELSE i.total END),0),
    COALESCE(SUM(CASE WHEN COALESCE(c.kind,'servico') = 'peca' THEN i.total ELSE 0 END),0),
    COALESCE(SUM(i.discount_value),0)
  INTO serv, parts, item_disc
  FROM public.commercial_document_items i
  LEFT JOIN public.item_categories c ON c.id = i.category_id
  WHERE i.document_id = _document_id;

  IF doc.discount_type = 'percentual' THEN
    general_disc := ROUND((serv + parts) * COALESCE(doc.discount_value,0) / 100, 2);
  ELSE
    general_disc := COALESCE(doc.discount_value,0);
  END IF;

  UPDATE public.commercial_documents
  SET total_services = serv,
      total_parts = parts,
      total_discount = item_disc + general_disc,
      total_general = GREATEST(serv + parts - general_disc, 0),
      updated_at = now()
  WHERE id = _document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_item_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.total := GREATEST(ROUND(COALESCE(NEW.unit_price,0) * COALESCE(NEW.quantity,0) - COALESCE(NEW.discount_value,0), 2), 0);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_item_total BEFORE INSERT OR UPDATE ON public.commercial_document_items
FOR EACH ROW EXECUTE FUNCTION public.tg_item_total();

CREATE OR REPLACE FUNCTION public.tg_item_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_document_totals(COALESCE(NEW.document_id, OLD.document_id));
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_item_recalc AFTER INSERT OR UPDATE OR DELETE ON public.commercial_document_items
FOR EACH ROW EXECUTE FUNCTION public.tg_item_recalc();

CREATE OR REPLACE FUNCTION public.tg_doc_discount_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.discount_value IS DISTINCT FROM OLD.discount_value OR NEW.discount_type IS DISTINCT FROM OLD.discount_type THEN
    PERFORM public.recalc_document_totals(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_doc_discount_recalc AFTER UPDATE ON public.commercial_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_doc_discount_recalc();

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_cd_touch BEFORE UPDATE ON public.commercial_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_company_touch BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
