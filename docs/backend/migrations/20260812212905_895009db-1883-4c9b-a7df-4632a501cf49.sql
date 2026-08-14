
-- ============ Qualification types ============
CREATE TABLE public.qualification_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  nqf_level smallint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qualification_types TO anon, authenticated;
GRANT ALL ON public.qualification_types TO service_role;
ALTER TABLE public.qualification_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qualification types are viewable by everyone" ON public.qualification_types FOR SELECT TO anon, authenticated USING (true);

-- ============ Universities ============
CREATE TABLE public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  description text,
  website_url text,
  application_url text,
  logo_url text,
  city text,
  is_demo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX universities_province_id_idx ON public.universities(province_id);
GRANT SELECT ON public.universities TO anon, authenticated;
GRANT ALL ON public.universities TO service_role;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active universities are viewable by everyone" ON public.universities FOR SELECT TO anon, authenticated USING (is_active);

-- ============ Faculties ============
CREATE TABLE public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);
CREATE INDEX faculties_university_id_idx ON public.faculties(university_id);
GRANT SELECT ON public.faculties TO anon, authenticated;
GRANT ALL ON public.faculties TO service_role;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active faculties are viewable by everyone" ON public.faculties FOR SELECT TO anon, authenticated USING (is_active);

-- ============ Courses ============
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  faculty_id uuid REFERENCES public.faculties(id) ON DELETE SET NULL,
  qualification_type_id uuid REFERENCES public.qualification_types(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  description text,
  duration_years numeric(3,1),
  aps_requirement smallint,
  application_url text,
  is_demo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);
CREATE INDEX courses_university_id_idx ON public.courses(university_id);
CREATE INDEX courses_faculty_id_idx ON public.courses(faculty_id);
CREATE INDEX courses_qualification_type_id_idx ON public.courses(qualification_type_id);
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active courses are viewable by everyone" ON public.courses FOR SELECT TO anon, authenticated USING (is_active);

-- ============ Requirement sets (alternative ways to qualify) ============
CREATE TABLE public.course_requirement_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Standard requirements',
  description text,
  min_aps smallint,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_requirement_sets_course_id_idx ON public.course_requirement_sets(course_id);
GRANT SELECT ON public.course_requirement_sets TO anon, authenticated;
GRANT ALL ON public.course_requirement_sets TO service_role;
ALTER TABLE public.course_requirement_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active requirement sets are viewable by everyone" ON public.course_requirement_sets FOR SELECT TO anon, authenticated USING (is_active);

-- ============ Requirement rules ============
CREATE TYPE public.requirement_rule_type AS ENUM (
  'min_aps',
  'subject_min_percentage',
  'subject_min_level',
  'one_of_subjects_min_percentage',
  'one_of_subjects_min_level',
  'min_subject_count'
);

CREATE TABLE public.course_requirement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_set_id uuid NOT NULL REFERENCES public.course_requirement_sets(id) ON DELETE CASCADE,
  rule_type public.requirement_rule_type NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE RESTRICT,
  subject_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  min_percentage numeric(5,2) CHECK (min_percentage IS NULL OR (min_percentage >= 0 AND min_percentage <= 100)),
  min_achievement_level smallint CHECK (min_achievement_level IS NULL OR (min_achievement_level BETWEEN 1 AND 7)),
  min_aps smallint,
  min_count smallint,
  is_required boolean NOT NULL DEFAULT true,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_requirement_rules_set_id_idx ON public.course_requirement_rules(requirement_set_id);
GRANT SELECT ON public.course_requirement_rules TO anon, authenticated;
GRANT ALL ON public.course_requirement_rules TO service_role;
ALTER TABLE public.course_requirement_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requirement rules are viewable by everyone" ON public.course_requirement_rules FOR SELECT TO anon, authenticated USING (true);

-- ============ updated_at triggers ============
CREATE TRIGGER qualification_types_set_updated_at BEFORE UPDATE ON public.qualification_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER universities_set_updated_at BEFORE UPDATE ON public.universities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER faculties_set_updated_at BEFORE UPDATE ON public.faculties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER course_requirement_sets_set_updated_at BEFORE UPDATE ON public.course_requirement_sets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER course_requirement_rules_set_updated_at BEFORE UPDATE ON public.course_requirement_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DEMO DATA ============
INSERT INTO public.qualification_types (code, name, nqf_level, sort_order) VALUES
  ('HCERT', 'Higher Certificate', 5, 10),
  ('DIP', 'Diploma', 6, 20),
  ('ADVDIP', 'Advanced Diploma', 7, 30),
  ('BDEG', 'Bachelor''s Degree', 7, 40),
  ('BDEG4', 'Professional Bachelor''s Degree', 8, 50);

INSERT INTO public.universities (province_id, code, name, short_name, description, city, website_url, application_url, is_demo, sort_order)
SELECT p.id, v.code, v.name, v.short_name, v.description, v.city, v.website_url, v.application_url, true, v.sort_order
FROM public.provinces p
JOIN (VALUES
  ('DEMO-CTU', 'Demo — Cape Table University', 'Demo CTU', 'DEMO DATA: a fictional university used to test EduStarter. Not a real institution.', 'Cape Town', 'https://example.com/demo-ctu', 'https://example.com/demo-ctu/apply', 10),
  ('DEMO-BVU', 'Demo — Boland Valley University', 'Demo BVU', 'DEMO DATA: a fictional university used to test EduStarter. Not a real institution.', 'Stellenbosch', 'https://example.com/demo-bvu', 'https://example.com/demo-bvu/apply', 20)
) AS v(code, name, short_name, description, city, website_url, application_url, sort_order) ON true
WHERE p.code = 'WC';

INSERT INTO public.faculties (university_id, code, name, description, sort_order)
SELECT u.id, f.code, f.name, 'DEMO DATA', f.sort_order
FROM public.universities u
JOIN (VALUES
  ('DEMO-CTU', 'SCI', 'Faculty of Science', 10),
  ('DEMO-CTU', 'COM', 'Faculty of Commerce', 20),
  ('DEMO-CTU', 'HUM', 'Faculty of Humanities', 30),
  ('DEMO-BVU', 'ENG', 'Faculty of Engineering', 10),
  ('DEMO-BVU', 'HLT', 'Faculty of Health Sciences', 20)
) AS f(uni_code, code, name, sort_order) ON f.uni_code = u.code;

INSERT INTO public.courses (university_id, faculty_id, qualification_type_id, code, name, description, duration_years, aps_requirement, application_url, is_demo, sort_order)
SELECT u.id, f.id, q.id, c.code, c.name, c.description, c.duration_years, c.aps, u.application_url, true, c.sort_order
FROM (VALUES
  ('DEMO-CTU', 'SCI', 'BDEG', 'DEMO-BSC-CS', 'Demo BSc Computer Science', 'DEMO DATA: example programme used to test EduStarter. Requirements shown are illustrative only.', 3.0, 34, 10),
  ('DEMO-CTU', 'COM', 'BDEG', 'DEMO-BCOM', 'Demo BCom Accounting', 'DEMO DATA: example programme used to test EduStarter. Requirements shown are illustrative only.', 3.0, 32, 20),
  ('DEMO-CTU', 'HUM', 'BDEG', 'DEMO-BA', 'Demo BA Social Sciences', 'DEMO DATA: example programme used to test EduStarter. Requirements shown are illustrative only.', 3.0, 28, 30),
  ('DEMO-CTU', 'COM', 'DIP', 'DEMO-DIP-BM', 'Demo Diploma in Business Management', 'DEMO DATA: example programme used to test EduStarter. Requirements shown are illustrative only.', 3.0, 24, 40),
  ('DEMO-BVU', 'ENG', 'BDEG4', 'DEMO-BENG-CIV', 'Demo BEng Civil Engineering', 'DEMO DATA: example programme used to test EduStarter. Requirements shown are illustrative only.', 4.0, 36, 10),
  ('DEMO-BVU', 'HLT', 'BDEG4', 'DEMO-BNURS', 'Demo Bachelor of Nursing', 'DEMO DATA: example programme used to test EduStarter. Requirements shown are illustrative only.', 4.0, 30, 20)
) AS c(uni_code, fac_code, qual_code, code, name, description, duration_years, aps, sort_order)
JOIN public.universities u ON u.code = c.uni_code
JOIN public.faculties f ON f.university_id = u.id AND f.code = c.fac_code
JOIN public.qualification_types q ON q.code = c.qual_code;

INSERT INTO public.course_requirement_sets (course_id, name, description, min_aps, sort_order)
SELECT c.id, 'Standard requirements', 'DEMO DATA: illustrative entry requirements. Meeting them does not guarantee admission.', c.aps_requirement, 10
FROM public.courses c WHERE c.is_demo;

-- Alternative rule set example (multiple ways to qualify)
INSERT INTO public.course_requirement_sets (course_id, name, description, min_aps, sort_order)
SELECT c.id, 'Alternative route (Mathematical Literacy)', 'DEMO DATA: illustrative alternative admission route.', c.aps_requirement + 2, 20
FROM public.courses c WHERE c.code = 'DEMO-DIP-BM';

-- Rules
INSERT INTO public.course_requirement_rules (requirement_set_id, rule_type, subject_id, min_percentage, description, sort_order)
SELECT rs.id, 'subject_min_percentage', s.id, r.pct, 'DEMO DATA', r.sort_order
FROM (VALUES
  ('DEMO-BSC-CS', 'Standard requirements', 'MATH', 70, 10),
  ('DEMO-BSC-CS', 'Standard requirements', 'ENGHL', 60, 20),
  ('DEMO-BCOM', 'Standard requirements', 'MATH', 60, 10),
  ('DEMO-BENG-CIV', 'Standard requirements', 'MATH', 70, 10),
  ('DEMO-BENG-CIV', 'Standard requirements', 'PHYSSCI', 65, 20),
  ('DEMO-BNURS', 'Standard requirements', 'LIFESCI', 55, 10),
  ('DEMO-DIP-BM', 'Standard requirements', 'MATH', 40, 10),
  ('DEMO-DIP-BM', 'Alternative route (Mathematical Literacy)', 'MATHLIT', 60, 10)
) AS r(course_code, set_name, subject_code, pct, sort_order)
JOIN public.courses c ON c.code = r.course_code
JOIN public.course_requirement_sets rs ON rs.course_id = c.id AND rs.name = r.set_name
JOIN public.subjects s ON s.code = r.subject_code;

-- "one of" rule example: any English at 50%+
INSERT INTO public.course_requirement_rules (requirement_set_id, rule_type, subject_ids, min_percentage, description, sort_order)
SELECT rs.id, 'one_of_subjects_min_percentage',
       ARRAY(SELECT id FROM public.subjects WHERE code IN ('ENGHL','ENGFAL')),
       50, 'DEMO DATA: English Home Language or First Additional Language at 50%', 30
FROM public.course_requirement_sets rs
JOIN public.courses c ON c.id = rs.course_id
WHERE c.code IN ('DEMO-BA', 'DEMO-BCOM', 'DEMO-BNURS', 'DEMO-DIP-BM');

-- min APS rule mirrored as an explicit rule row for the engine
INSERT INTO public.course_requirement_rules (requirement_set_id, rule_type, min_aps, description, sort_order)
SELECT rs.id, 'min_aps', rs.min_aps, 'DEMO DATA: minimum APS', 1
FROM public.course_requirement_sets rs WHERE rs.min_aps IS NOT NULL;
