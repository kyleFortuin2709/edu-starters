-- EduStarter backend inventory: Storage.
-- One bucket exists: "prospectuses" (private, no file size limit, no MIME restriction).
-- Create the bucket via the Supabase dashboard/CLI, then apply the policies below.

INSERT INTO storage.buckets (id, name, public)
VALUES ('prospectuses', 'prospectuses', false)
ON CONFLICT (id) DO NOTHING;

-- Admin-only access to objects in that bucket (4 policies, as on the live project).
CREATE POLICY "Admins read prospectus files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'prospectuses' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload prospectus files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prospectuses' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update prospectus files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'prospectuses' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'prospectuses' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete prospectus files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'prospectuses' AND public.has_role(auth.uid(), 'admin'));

-- The application reaches these files with the service-role key from the server,
-- which bypasses RLS; the policies above cover direct client access.
