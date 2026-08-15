CREATE TABLE public.advisor_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (profile_id, course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_conversations TO authenticated;
GRANT ALL ON public.advisor_conversations TO service_role;

ALTER TABLE public.advisor_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own advisor conversations"
ON public.advisor_conversations FOR ALL TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER advisor_conversations_set_updated_at
BEFORE UPDATE ON public.advisor_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();