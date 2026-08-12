
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Draft / published status
CREATE TYPE public.publication_status AS ENUM ('draft', 'published');

ALTER TABLE public.universities ADD COLUMN publication_status public.publication_status NOT NULL DEFAULT 'published';
ALTER TABLE public.faculties ADD COLUMN publication_status public.publication_status NOT NULL DEFAULT 'published';
ALTER TABLE public.courses ADD COLUMN publication_status public.publication_status NOT NULL DEFAULT 'published';

-- 3. Public read policies now require published
DROP POLICY IF EXISTS "Active universities are viewable by everyone" ON public.universities;
CREATE POLICY "Published universities are viewable by everyone"
  ON public.universities FOR SELECT TO anon, authenticated
  USING (is_active AND publication_status = 'published');

DROP POLICY IF EXISTS "Active faculties are viewable by everyone" ON public.faculties;
CREATE POLICY "Published faculties are viewable by everyone"
  ON public.faculties FOR SELECT TO anon, authenticated
  USING (is_active AND publication_status = 'published');

DROP POLICY IF EXISTS "Active courses are viewable by everyone" ON public.courses;
CREATE POLICY "Published courses are viewable by everyone"
  ON public.courses FOR SELECT TO anon, authenticated
  USING (is_active AND publication_status = 'published');

-- 4. Admin full access to catalogue tables
CREATE POLICY "Admins can manage universities" ON public.universities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage faculties" ON public.faculties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage requirement sets" ON public.course_requirement_sets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage requirement rules" ON public.course_requirement_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage qualification types" ON public.qualification_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage aps rules" ON public.aps_calculation_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage aps point bands" ON public.aps_point_bands FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage aps rule subjects" ON public.aps_rule_subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Write grants for the tables admins now manage
GRANT INSERT, UPDATE, DELETE ON public.universities, public.faculties, public.courses,
  public.course_requirement_sets, public.course_requirement_rules, public.qualification_types,
  public.aps_calculation_rules, public.aps_point_bands, public.aps_rule_subjects, public.subjects
  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
