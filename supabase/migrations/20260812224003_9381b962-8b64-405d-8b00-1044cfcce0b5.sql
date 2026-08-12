CREATE TYPE public.ingestion_status AS ENUM ('uploaded','processing','review_required','approved','published');

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
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospectus_documents TO authenticated;
GRANT ALL ON public.prospectus_documents TO service_role;
ALTER TABLE public.prospectus_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prospectus documents" ON public.prospectus_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER prospectus_documents_set_updated_at BEFORE UPDATE ON public.prospectus_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staged_courses TO authenticated;
GRANT ALL ON public.staged_courses TO service_role;
ALTER TABLE public.staged_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage staged courses" ON public.staged_courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER staged_courses_set_updated_at BEFORE UPDATE ON public.staged_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX staged_courses_prospectus_idx ON public.staged_courses(prospectus_id);