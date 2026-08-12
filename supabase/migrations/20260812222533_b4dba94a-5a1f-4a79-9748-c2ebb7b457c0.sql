CREATE TABLE public.saved_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_courses TO authenticated;
GRANT ALL ON public.saved_courses TO service_role;

ALTER TABLE public.saved_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved courses" ON public.saved_courses
  FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Users can save courses for themselves" ON public.saved_courses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update their own saved courses" ON public.saved_courses
  FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can remove their own saved courses" ON public.saved_courses
  FOR DELETE TO authenticated USING (auth.uid() = profile_id);

CREATE TRIGGER saved_courses_set_updated_at BEFORE UPDATE ON public.saved_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX saved_courses_profile_id_idx ON public.saved_courses (profile_id);