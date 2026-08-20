-- Restrict profile visibility
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.can_view_all_leads(auth.uid())
);

-- Restrict role visibility
DROP POLICY IF EXISTS roles_select ON public.user_roles;
CREATE POLICY roles_select_scoped ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Lock down SECURITY DEFINER functions: no anonymous / public execution
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_all_leads(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_delete_documents(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_lead(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_lead(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_document_number(public.commercial_doc_type, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalc_document_totals(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger-only functions must never be callable through the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_lead_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_block_document_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_block_product_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_doc_discount_recalc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_guard_document_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_guard_profile_privileges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_item_recalc() FROM PUBLIC, anon, authenticated;

-- Keep only the access the app actually needs
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_all_leads(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_documents(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_lead(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_lead(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_document(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_document_number(public.commercial_doc_type, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalc_document_totals(uuid) TO service_role;