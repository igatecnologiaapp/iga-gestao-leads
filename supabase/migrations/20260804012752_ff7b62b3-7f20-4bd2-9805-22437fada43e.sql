
CREATE TYPE public.app_role AS ENUM ('admin','captador');
CREATE TYPE public.lead_status AS ENUM ('novo','em_contato','contatado','interessado','proposta_enviada','negociacao','convertido','perdido');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  can_view_all_leads BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_view_all_leads(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT can_view_all_leads FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'captador'::public.app_role END);
  IF first_user THEN UPDATE public.profiles SET can_view_all_leads = true WHERE id = NEW.id; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CADASTROS
CREATE TABLE public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, city, state)
);
CREATE TABLE public.streets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  zip_code TEXT,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX streets_name_idx ON public.streets (lower(name));
CREATE TABLE public.products_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.segment_products (
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products_services(id) ON DELETE CASCADE,
  PRIMARY KEY (segment_id, product_id)
);
CREATE TABLE public.segment_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment_id, field_key)
);

-- LEADS
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  street_id UUID REFERENCES public.streets(id) ON DELETE SET NULL,
  street_name TEXT,
  number TEXT,
  neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  neighborhood_name TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  status public.lead_status NOT NULL DEFAULT 'novo',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_created_by_idx ON public.leads (created_by);
CREATE INDEX leads_status_idx ON public.leads (status);
CREATE INDEX leads_segment_idx ON public.leads (segment_id);
CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);

CREATE TABLE public.lead_products (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products_services(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, product_id)
);
CREATE TABLE public.lead_custom_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.segment_fields(id) ON DELETE CASCADE,
  value JSONB,
  UNIQUE (lead_id, field_id)
);
CREATE TABLE public.lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status public.lead_status,
  new_status public.lead_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments, public.neighborhoods, public.streets, public.products_services, public.segment_products, public.segment_fields, public.leads, public.lead_products, public.lead_custom_values, public.lead_history, public.lead_status_history TO authenticated;
GRANT ALL ON public.segments, public.neighborhoods, public.streets, public.products_services, public.segment_products, public.segment_fields, public.leads, public.lead_products, public.lead_custom_values, public.lead_history, public.lead_status_history TO service_role;

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_custom_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments_read" ON public.segments FOR SELECT TO authenticated USING (true);
CREATE POLICY "segments_admin" ON public.segments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "nb_read" ON public.neighborhoods FOR SELECT TO authenticated USING (true);
CREATE POLICY "nb_write" ON public.neighborhoods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "st_read" ON public.streets FOR SELECT TO authenticated USING (true);
CREATE POLICY "st_write" ON public.streets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ps_read" ON public.products_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "ps_admin" ON public.products_services FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sp_read" ON public.segment_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "sp_admin" ON public.segment_products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sf_read" ON public.segment_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "sf_admin" ON public.segment_fields FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.can_view_all_leads(auth.uid()));
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "leads_delete_admin" ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.can_access_lead(_lead_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = _lead_id
      AND (l.created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.can_view_all_leads(auth.uid()))
  )
$$;

CREATE POLICY "lp_all" ON public.lead_products FOR ALL TO authenticated USING (public.can_access_lead(lead_id)) WITH CHECK (public.can_access_lead(lead_id));
CREATE POLICY "lcv_all" ON public.lead_custom_values FOR ALL TO authenticated USING (public.can_access_lead(lead_id)) WITH CHECK (public.can_access_lead(lead_id));
CREATE POLICY "lh_read" ON public.lead_history FOR SELECT TO authenticated USING (public.can_access_lead(lead_id));
CREATE POLICY "lh_insert" ON public.lead_history FOR INSERT TO authenticated WITH CHECK (public.can_access_lead(lead_id));
CREATE POLICY "lsh_read" ON public.lead_status_history FOR SELECT TO authenticated USING (public.can_access_lead(lead_id));
CREATE POLICY "lsh_insert" ON public.lead_status_history FOR INSERT TO authenticated WITH CHECK (public.can_access_lead(lead_id));

CREATE TRIGGER segments_updated BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER nb_updated BEFORE UPDATE ON public.neighborhoods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER st_updated BEFORE UPDATE ON public.streets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_updated BEFORE UPDATE ON public.products_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_lead_events() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_history (lead_id, user_id, event_type, description)
    VALUES (NEW.id, NEW.created_by, 'captacao', 'Lead captado');
    INSERT INTO public.lead_status_history (lead_id, user_id, old_status, new_status)
    VALUES (NEW.id, NEW.created_by, NULL, NEW.status);
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.lead_status_history (lead_id, user_id, old_status, new_status)
      VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
      INSERT INTO public.lead_history (lead_id, user_id, event_type, description)
      VALUES (NEW.id, auth.uid(), 'status', 'Status alterado de ' || OLD.status || ' para ' || NEW.status);
    END IF;
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      INSERT INTO public.lead_history (lead_id, user_id, event_type, description)
      VALUES (NEW.id, auth.uid(), 'exclusao', 'Lead excluído (exclusão lógica)');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER leads_events AFTER INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_events();

-- SEED
INSERT INTO public.segments (name) VALUES
 ('Açougue'),('Restaurante'),('Supermercado'),('Loja de Roupas'),('Loja de Móveis'),
 ('Loja de Iluminação'),('Construção Civil'),('Indústria'),('Distribuidora'),('Tecnologia'),
 ('Software'),('Serviços'),('Automotivo'),('Padaria'),('Frigorífico'),('Casa de Carnes'),
 ('Lanchonete'),('Pizzaria'),('Outros');

INSERT INTO public.neighborhoods (name, city, state) VALUES
 ('Centro','São Paulo','SP'),('Jardim Paulista','São Paulo','SP'),('Vila Mariana','São Paulo','SP'),
 ('Santana','São Paulo','SP'),('Moema','São Paulo','SP');

INSERT INTO public.streets (name, neighborhood_id, zip_code, city, state)
SELECT s.name, n.id, s.cep, 'São Paulo', 'SP' FROM (VALUES
 ('Rua das Palmeiras','Centro','01000-000'),
 ('Rua das Flores','Centro','01001-000'),
 ('Rua das Acácias','Jardim Paulista','01402-000'),
 ('Avenida Paulista','Jardim Paulista','01310-000'),
 ('Rua Vergueiro','Vila Mariana','04101-000'),
 ('Rua Voluntários da Pátria','Santana','02010-000'),
 ('Alameda dos Ipês','Moema','04077-000')
) AS s(name, nb, cep) JOIN public.neighborhoods n ON n.name = s.nb;

INSERT INTO public.products_services (name, description) VALUES
 ('Sistema para Açougue','Gestão completa para açougues'),
 ('Sistema de Desossa','Controle de rendimento e desossa'),
 ('Sistema para Restaurante','Comandas, mesas e delivery'),
 ('Sistema para Supermercado','Frente de caixa e retaguarda'),
 ('Sistema de Gestão Empresarial','ERP completo'),
 ('Sistema Financeiro','Contas a pagar e receber'),
 ('Sistema de Controle de Estoque','Gestão de estoque'),
 ('Sistema de Vendas','Força de vendas e PDV'),
 ('Sistema de Produção','Controle de produção'),
 ('Sistema de CRM','Relacionamento com clientes'),
 ('Sistema Personalizado','Desenvolvimento sob medida');

INSERT INTO public.segment_products (segment_id, product_id)
SELECT sg.id, p.id FROM (VALUES
 ('Sistema para Açougue','Açougue'),('Sistema para Açougue','Casa de Carnes'),('Sistema para Açougue','Frigorífico'),
 ('Sistema de Desossa','Açougue'),('Sistema de Desossa','Frigorífico'),('Sistema de Desossa','Casa de Carnes'),
 ('Sistema para Restaurante','Restaurante'),('Sistema para Restaurante','Lanchonete'),('Sistema para Restaurante','Pizzaria'),
 ('Sistema para Supermercado','Supermercado'),
 ('Sistema de Gestão Empresarial','Indústria'),('Sistema de Gestão Empresarial','Distribuidora'),('Sistema de Gestão Empresarial','Supermercado'),('Sistema de Gestão Empresarial','Software'),
 ('Sistema Financeiro','Serviços'),('Sistema Financeiro','Indústria'),('Sistema Financeiro','Software'),
 ('Sistema de Controle de Estoque','Açougue'),('Sistema de Controle de Estoque','Supermercado'),('Sistema de Controle de Estoque','Distribuidora'),('Sistema de Controle de Estoque','Loja de Móveis'),
 ('Sistema de Vendas','Açougue'),('Sistema de Vendas','Loja de Roupas'),('Sistema de Vendas','Loja de Iluminação'),('Sistema de Vendas','Distribuidora'),
 ('Sistema de Produção','Indústria'),('Sistema de Produção','Frigorífico'),
 ('Sistema de CRM','Software'),('Sistema de CRM','Tecnologia'),('Sistema de CRM','Serviços'),
 ('Sistema Personalizado','Software'),('Sistema Personalizado','Tecnologia')
) AS v(prod, seg)
JOIN public.products_services p ON p.name = v.prod
JOIN public.segments sg ON sg.name = v.seg;

INSERT INTO public.segment_fields (segment_id, label, field_key, field_type, required, options, sort_order)
SELECT s.id, v.label, v.fkey, v.ftype, v.req, v.opts::jsonb, v.ord FROM (VALUES
 ('Software','Quantidade aproximada de usuários','qtd_usuarios','number',false,'[]',1),
 ('Software','Sistema atualmente utilizado','sistema_atual','text',false,'[]',2),
 ('Tecnologia','Sistema atualmente utilizado','sistema_atual','text',false,'[]',1),
 ('Restaurante','Quantidade de mesas','qtd_mesas','number',false,'[]',1),
 ('Restaurante','Faz delivery?','delivery','boolean',false,'[]',2),
 ('Restaurante','Sistema atual','sistema_atual','text',false,'[]',3),
 ('Açougue','Possui balança integrada?','balanca','boolean',false,'[]',1),
 ('Supermercado','Número de checkouts','qtd_checkouts','number',false,'[]',1)
) AS v(seg,label,fkey,ftype,req,opts,ord)
JOIN public.segments s ON s.name = v.seg;
