INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'kylef@bbd.co.za'
ON CONFLICT (user_id, role) DO NOTHING;