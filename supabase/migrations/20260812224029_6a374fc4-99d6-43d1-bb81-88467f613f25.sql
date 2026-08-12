CREATE POLICY "Admins read prospectus files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'prospectuses' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins upload prospectus files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prospectuses' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update prospectus files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'prospectuses' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'prospectuses' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete prospectus files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'prospectuses' AND public.has_role(auth.uid(),'admin'));