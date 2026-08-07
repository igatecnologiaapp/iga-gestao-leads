DELETE FROM public.lead_custom_values WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name LIKE 'AUDIT Lead%');
DELETE FROM public.lead_products WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name LIKE 'AUDIT Lead%');
DELETE FROM public.lead_status_history WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name LIKE 'AUDIT Lead%');
DELETE FROM public.lead_history WHERE lead_id IN (SELECT id FROM public.leads WHERE company_name LIKE 'AUDIT Lead%');
DELETE FROM public.leads WHERE company_name LIKE 'AUDIT Lead%';

DELETE FROM auth.users WHERE email = 'audit.tmp@example.com';