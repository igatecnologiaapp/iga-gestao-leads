REVOKE ALL ON FUNCTION public.can_access_route(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_route(uuid) TO authenticated, service_role;