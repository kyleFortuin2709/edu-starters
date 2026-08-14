-- EduStarter backend inventory: grants + RLS policies (41 policies on public schema).
-- Policy expressions copied from pg_policies on the live database. Run after 02.

-- ------------------------------------------------------------------- GRANTs
-- The live project relies on the default public-schema privileges that older
-- Supabase projects grant automatically. A newly created project may not grant
-- them, so apply these explicitly. Tables readable without login get anon SELECT;
-- user-owned and admin-only tables do not.
GRANT SELECT ON public.provinces, public.subjects, public.qualification_types,
  public.aps_calculation_rules, public.aps_point_bands, public.aps_rule_subjects,
  public.universities, public.faculties, public.courses,
  public.course_requirement_sets, public.course_requirement_rules TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.provinces, public.subjects, public.qualification_types,
  public.aps_calculation_rules, public.aps_point_bands, public.aps_rule_subjects,
  public.universities, public.faculties, public.courses,
  public.course_requirement_sets, public.course_requirement_rules,
  public.profiles, public.student_subjects, public.saved_courses,
  public.user_roles, public.prospectus_documents, public.staged_courses
  TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- --------------------------------------------------------------- enable RLS
ALTER TABLE public.provinces                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aps_calculation_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aps_point_bands          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aps_rule_subjects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_requirement_sets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_requirement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospectus_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staged_courses           ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------- public reference / lookups
CREATE POLICY "Provinces are viewable by everyone" ON public.provinces
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Subjects are viewable by everyone" ON public.subjects
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Qualification types are viewable by everyone" ON public.qualification_types
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage qualification types" ON public.qualification_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------------- APS rules
CREATE POLICY "Active APS rules are viewable by everyone" ON public.aps_calculation_rules
  FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Admins can manage aps rules" ON public.aps_calculation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "APS point bands are viewable by everyone" ON public.aps_point_bands
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage aps point bands" ON public.aps_point_bands
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "APS subject rules are viewable by everyone" ON public.aps_rule_subjects
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage aps rule subjects" ON public.aps_rule_subjects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------- catalogue
CREATE POLICY "Published universities are viewable by everyone" ON public.universities
  FOR SELECT TO anon, authenticated
  USING (is_active AND publication_status = 'published');
CREATE POLICY "Admins can manage universities" ON public.universities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Published faculties are viewable by everyone" ON public.faculties
  FOR SELECT TO anon, authenticated
  USING (is_active AND publication_status = 'published');
CREATE POLICY "Admins can manage faculties" ON public.faculties
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Published courses are viewable by everyone" ON public.courses
  FOR SELECT TO anon, authenticated
  USING (is_active AND publication_status = 'published');
CREATE POLICY "Admins can manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Active requirement sets are viewable by everyone" ON public.course_requirement_sets
  FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Admins can manage requirement sets" ON public.course_requirement_sets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Requirement rules are viewable by everyone" ON public.course_requirement_rules
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage requirement rules" ON public.course_requirement_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------- student data
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can view their own subjects" ON public.student_subjects
  FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert their own subjects" ON public.student_subjects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update their own subjects" ON public.student_subjects
  FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can delete their own subjects" ON public.student_subjects
  FOR DELETE TO authenticated USING (auth.uid() = profile_id);

CREATE POLICY "Users can view their own saved courses" ON public.saved_courses
  FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Users can save courses for themselves" ON public.saved_courses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update their own saved courses" ON public.saved_courses
  FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can remove their own saved courses" ON public.saved_courses
  FOR DELETE TO authenticated USING (auth.uid() = profile_id);

-- ------------------------------------------------------------------- roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------- ingestion (admin only)
CREATE POLICY "Admins manage prospectus documents" ON public.prospectus_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage staged courses" ON public.staged_courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
