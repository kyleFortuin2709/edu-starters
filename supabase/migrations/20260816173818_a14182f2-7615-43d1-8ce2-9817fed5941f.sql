CREATE TABLE public.course_ai_overviews (
  course_id UUID PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  careers JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.course_ai_overviews TO authenticated;
GRANT ALL ON public.course_ai_overviews TO service_role;

ALTER TABLE public.course_ai_overviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read course overviews"
  ON public.course_ai_overviews FOR SELECT TO authenticated USING (true);

CREATE TRIGGER course_ai_overviews_set_updated_at
  BEFORE UPDATE ON public.course_ai_overviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();