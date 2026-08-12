DELETE FROM public.lead_appointments WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name IN ('Empresa Teste Homologação','Mercado Teste Vendedor QA'));
DELETE FROM public.lead_custom_values WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name IN ('Empresa Teste Homologação','Mercado Teste Vendedor QA'));
DELETE FROM public.lead_products WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name IN ('Empresa Teste Homologação','Mercado Teste Vendedor QA'));
DELETE FROM public.lead_history WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name IN ('Empresa Teste Homologação','Mercado Teste Vendedor QA'));
DELETE FROM public.lead_status_history WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name IN ('Empresa Teste Homologação','Mercado Teste Vendedor QA'));
DELETE FROM public.leads WHERE company_name IN ('Empresa Teste Homologação','Mercado Teste Vendedor QA');

DELETE FROM public.streets s
WHERE NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.street_id = s.id)
  AND EXISTS (
    SELECT 1 FROM public.streets s2
    WHERE s2.id <> s.id AND upper(s2.name) = upper(s.name)
      AND EXISTS (SELECT 1 FROM public.leads l2 WHERE l2.street_id = s2.id)
  );