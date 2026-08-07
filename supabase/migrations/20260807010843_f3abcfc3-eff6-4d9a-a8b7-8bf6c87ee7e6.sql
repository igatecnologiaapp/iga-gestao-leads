-- Remover apenas os leads criados durante a homologação
DELETE FROM public.lead_custom_values WHERE lead_id IN ('e6153eb1-1ffc-4646-82a0-fd7baf65fb2f','14afec5d-f42c-4a1d-b63a-496e13ba5562');
DELETE FROM public.lead_products WHERE lead_id IN ('e6153eb1-1ffc-4646-82a0-fd7baf65fb2f','14afec5d-f42c-4a1d-b63a-496e13ba5562');
DELETE FROM public.lead_status_history WHERE lead_id IN ('e6153eb1-1ffc-4646-82a0-fd7baf65fb2f','14afec5d-f42c-4a1d-b63a-496e13ba5562');
DELETE FROM public.lead_history WHERE lead_id IN ('e6153eb1-1ffc-4646-82a0-fd7baf65fb2f','14afec5d-f42c-4a1d-b63a-496e13ba5562');
DELETE FROM public.leads WHERE id IN ('e6153eb1-1ffc-4646-82a0-fd7baf65fb2f','14afec5d-f42c-4a1d-b63a-496e13ba5562');

-- Remover as contas usadas somente para os testes
DELETE FROM auth.users WHERE email IN ('qa.homolog+1@example.com','qa.homolog2@example.com','qa.homolog3@example.com');