-- EduStarter backend inventory: database functions and triggers.
-- Definitions copied verbatim from the live database. Run after 01-schema.sql.

-- Creates a public.profiles row whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Non-recursive role check used by every admin RLS policy.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

-- Generic updated_at maintenance.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

-- ------------------------------------------------------------------ triggers
-- Auth trigger (created on the auth schema; in a self-owned Supabase project you
-- can create this from the SQL editor as the postgres role).
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers (14 tables)
CREATE TRIGGER aps_calculation_rules_set_updated_at BEFORE UPDATE ON public.aps_calculation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER aps_point_bands_set_updated_at BEFORE UPDATE ON public.aps_point_bands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER aps_rule_subjects_set_updated_at BEFORE UPDATE ON public.aps_rule_subjects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER course_requirement_rules_set_updated_at BEFORE UPDATE ON public.course_requirement_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER course_requirement_sets_set_updated_at BEFORE UPDATE ON public.course_requirement_sets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER faculties_set_updated_at BEFORE UPDATE ON public.faculties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER prospectus_documents_set_updated_at BEFORE UPDATE ON public.prospectus_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER qualification_types_set_updated_at BEFORE UPDATE ON public.qualification_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER saved_courses_set_updated_at BEFORE UPDATE ON public.saved_courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER staged_courses_set_updated_at BEFORE UPDATE ON public.staged_courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_subjects_set_updated_at BEFORE UPDATE ON public.student_subjects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER universities_set_updated_at BEFORE UPDATE ON public.universities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTE: public.provinces has no updated_at column and therefore no trigger.
