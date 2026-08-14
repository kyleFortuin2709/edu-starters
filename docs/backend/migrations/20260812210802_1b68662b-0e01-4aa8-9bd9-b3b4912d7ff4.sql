CREATE TABLE public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provinces TO anon, authenticated;
GRANT ALL ON public.provinces TO service_role;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provinces are viewable by everyone" ON public.provinces FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_designated boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects are viewable by everyone" ON public.subjects FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  province_id uuid REFERENCES public.provinces(id) ON DELETE SET NULL,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  custom_subject_name text,
  mark numeric(5,2) CHECK (mark >= 0 AND mark <= 100),
  achievement_level smallint CHECK (achievement_level >= 1 AND achievement_level <= 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_subject_named CHECK (subject_id IS NOT NULL OR custom_subject_name IS NOT NULL)
);
CREATE UNIQUE INDEX student_subjects_unique_subject ON public.student_subjects (profile_id, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX student_subjects_profile_idx ON public.student_subjects (profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_subjects TO authenticated;
GRANT ALL ON public.student_subjects TO service_role;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subjects" ON public.student_subjects FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert their own subjects" ON public.student_subjects FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update their own subjects" ON public.student_subjects FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can delete their own subjects" ON public.student_subjects FOR DELETE TO authenticated USING (auth.uid() = profile_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_subjects_set_updated_at BEFORE UPDATE ON public.student_subjects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.provinces (code, name, sort_order) VALUES
  ('EC', 'Eastern Cape', 1),
  ('FS', 'Free State', 2),
  ('GP', 'Gauteng', 3),
  ('KZN', 'KwaZulu-Natal', 4),
  ('LP', 'Limpopo', 5),
  ('MP', 'Mpumalanga', 6),
  ('NC', 'Northern Cape', 7),
  ('NW', 'North West', 8),
  ('WC', 'Western Cape', 9);

INSERT INTO public.subjects (code, name, is_designated, sort_order) VALUES
  ('ENGHL', 'English Home Language', true, 1),
  ('ENGFAL', 'English First Additional Language', true, 2),
  ('AFRHL', 'Afrikaans Home Language', true, 3),
  ('AFRFAL', 'Afrikaans First Additional Language', true, 4),
  ('ISIZULU', 'isiZulu', true, 5),
  ('ISIXHOSA', 'isiXhosa', true, 6),
  ('SESOTHO', 'Sesotho', true, 7),
  ('SETSWANA', 'Setswana', true, 8),
  ('MATH', 'Mathematics', true, 9),
  ('MATHLIT', 'Mathematical Literacy', false, 10),
  ('PHYSSCI', 'Physical Sciences', true, 11),
  ('LIFESCI', 'Life Sciences', true, 12),
  ('ACCOUNT', 'Accounting', true, 13),
  ('BUSSTUD', 'Business Studies', true, 14),
  ('ECON', 'Economics', true, 15),
  ('GEOG', 'Geography', true, 16),
  ('HIST', 'History', true, 17),
  ('LIFEORI', 'Life Orientation', false, 18),
  ('CAT', 'Computer Applications Technology', true, 19),
  ('ITECH', 'Information Technology', true, 20),
  ('ENGGRAPH', 'Engineering Graphics and Design', true, 21),
  ('CONSSTUD', 'Consumer Studies', true, 22),
  ('TOURISM', 'Tourism', true, 23),
  ('VISARTS', 'Visual Arts', true, 24),
  ('DRAMARTS', 'Dramatic Arts', true, 25),
  ('MUSIC', 'Music', true, 26),
  ('AGRISCI', 'Agricultural Sciences', true, 27),
  ('RELSTUD', 'Religion Studies', true, 28);