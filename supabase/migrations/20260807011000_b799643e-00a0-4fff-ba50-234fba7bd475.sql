INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles WHERE email = 'audit.tmp@example.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles SET can_view_all_leads = true WHERE email = 'audit.tmp@example.com';