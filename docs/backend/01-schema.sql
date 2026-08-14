-- EduStarter backend inventory: schema (types, tables, constraints, indexes)
-- Generated read-only from the live database catalog. Contains NO data and NO secrets.
-- Run this against a fresh Supabase project BEFORE 02/03/04.

-- ---------------------------------------------------------------- enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.aps_rule_status AS ENUM ('demo', 'unverified', 'verified');
CREATE TYPE public.aps_subject_rule_type AS ENUM ('exclude', 'always_include', 'cap_points', 'bonus_points');
CREATE TYPE public.ingestion_status AS ENUM ('uploaded', 'processing', 'review_required', 'approved', 'published');
CREATE TYPE public.publication_status AS ENUM ('draft', 'published');
CREATE TYPE public.requirement_rule_type AS ENUM (
  'min_aps', 'subject_min_percentage', 'subject_min_level',
  'one_of_subjects_min_percentage', 'one_of_subjects_min_level', 'min_subject_count'
);

-- --------------------------------------------------------------- lookup data
CREATE TABLE public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_designated boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL DEFAULT 'Other',
  requirement_type text NOT NULL DEFAULT 'elective'
    CHECK (requirement_type = ANY (ARRAY['required'::text, 'elective'::text]))
);

CREATE TABLE public.qualification_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  nqf_level smallint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------- APS calculation rules
CREATE TABLE public.aps_calculation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  description text,
  status public.aps_rule_status NOT NULL DEFAULT 'unverified',
  is_active boolean NOT NULL DEFAULT true,
  source_url text,
  counting_subject_count smallint,
  max_total_aps smallint,
  special_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.aps_point_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.aps_calculation_rules(id) ON DELETE CASCADE,
  min_percentage numeric NOT NULL,
  max_percentage numeric NOT NULL,
  points smallint NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aps_point_bands_range_check CHECK (min_percentage <= max_percentage)
);
CREATE INDEX aps_point_bands_rule_idx ON public.aps_point_bands USING btree (rule_id);

CREATE TABLE public.aps_rule_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.aps_calculation_rules(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  rule_type public.aps_subject_rule_type NOT NULL,
  max_points smallint,
  bonus_points smallint,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, subject_id, rule_type)
);
CREATE INDEX aps_rule_subjects_rule_idx ON public.aps_rule_subjects USING btree (rule_id);

-- ------------------------------------------------------------------ catalogue
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  aps_rule_id uuid REFERENCES public.aps_calculation_rules(id) ON DELETE SET NULL,
  publication_status public.publication_status NOT NULL DEFAULT 'published'
);
CREATE INDEX universities_province_id_idx ON public.universities USING btree (province_id);

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
  publication_status public.publication_status NOT NULL DEFAULT 'published',
  UNIQUE (university_id, name)
);
CREATE INDEX faculties_university_id_idx ON public.faculties USING btree (university_id);

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
  publication_status public.publication_status NOT NULL DEFAULT 'published',
  UNIQUE (university_id, name)
);
CREATE INDEX courses_university_id_idx ON public.courses USING btree (university_id);
CREATE INDEX courses_faculty_id_idx ON public.courses USING btree (faculty_id);
CREATE INDEX courses_qualification_type_id_idx ON public.courses USING btree (qualification_type_id);

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
CREATE INDEX course_requirement_sets_course_id_idx ON public.course_requirement_sets USING btree (course_id);

CREATE TABLE public.course_requirement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_set_id uuid NOT NULL REFERENCES public.course_requirement_sets(id) ON DELETE CASCADE,
  rule_type public.requirement_rule_type NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE RESTRICT,
  subject_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  min_percentage numeric(5,2) CHECK (min_percentage IS NULL OR (min_percentage >= 0 AND min_percentage <= 100)),
  min_achievement_level smallint CHECK (min_achievement_level IS NULL OR (min_achievement_level >= 1 AND min_achievement_level <= 7)),
  min_aps smallint,
  min_count smallint,
  is_required boolean NOT NULL DEFAULT true,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_requirement_rules_set_id_idx ON public.course_requirement_rules USING btree (requirement_set_id);

-- --------------------------------------------------------------- student data
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  province_id uuid REFERENCES public.provinces(id) ON DELETE SET NULL,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  aps_tolerance smallint NOT NULL DEFAULT 5,
  subject_percentage_tolerance smallint NOT NULL DEFAULT 5
);

CREATE TABLE public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  custom_subject_name text,
  mark numeric(5,2) CHECK (mark IS NULL OR (mark >= 0 AND mark <= 100)),
  achievement_level smallint CHECK (achievement_level >= 1 AND achievement_level <= 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_subject_named CHECK (subject_id IS NOT NULL OR custom_subject_name IS NOT NULL)
);
CREATE INDEX student_subjects_profile_idx ON public.student_subjects USING btree (profile_id);
CREATE UNIQUE INDEX student_subjects_unique_subject
  ON public.student_subjects USING btree (profile_id, subject_id) WHERE subject_id IS NOT NULL;
-- NOTE: the live DB also has a duplicate of the index above named
-- student_subjects_profile_subject_key. It is redundant; one index is enough.

CREATE TABLE public.saved_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, course_id)
);
CREATE INDEX saved_courses_profile_id_idx ON public.saved_courses USING btree (profile_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- --------------------------------------------------- prospectus ingestion
CREATE TABLE public.prospectus_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  academic_year text,
  status public.ingestion_status NOT NULL DEFAULT 'uploaded',
  page_count integer,
  notes text,
  error_message text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  extraction_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_at timestamptz,
  extraction_model text,
  aps_methodology_text text,
  aps_rule_id uuid REFERENCES public.aps_calculation_rules(id) ON DELETE SET NULL
);

CREATE TABLE public.staged_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospectus_id uuid NOT NULL REFERENCES public.prospectus_documents(id) ON DELETE CASCADE,
  university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  faculty_name text,
  qualification_name text,
  name text NOT NULL,
  code text,
  description text,
  duration_years numeric,
  aps_requirement smallint,
  application_url text,
  requirements_text text,
  source_page integer,
  status public.ingestion_status NOT NULL DEFAULT 'review_required',
  review_notes text,
  published_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  extracted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staged_courses_prospectus_idx ON public.staged_courses USING btree (prospectus_id);
