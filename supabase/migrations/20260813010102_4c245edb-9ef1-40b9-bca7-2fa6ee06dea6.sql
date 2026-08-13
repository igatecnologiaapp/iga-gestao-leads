
REVOKE ALL ON FUNCTION public.can_access_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_document_number(public.commercial_doc_type, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalc_document_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_item_total() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_item_recalc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_doc_discount_recalc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(public.commercial_doc_type, integer) TO authenticated;
