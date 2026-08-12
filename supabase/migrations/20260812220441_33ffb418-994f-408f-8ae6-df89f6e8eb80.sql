-- APS calculation rules ------------------------------------------------
CREATE TYPE public.aps_rule_status AS ENUM ('demo', 'unverified', 'verified');

CREATE TABLE public.aps_calculation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  description text,
  status public.aps_rule_status NOT NULL DEFAULT 'unverified',
  is_active boolean NOT NULL DEFAULT true,
  source_url text,
  -- generic, data-driven knobs (no institution-specific logic in code)
  counting_subject_count smallint,
  max_total_aps smallint,
  special_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aps_calculation_rules TO anon, authenticated;
GRANT ALL ON public.aps_calculation_rules TO service_role;
ALTER TABLE public.aps_calculation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active APS rules are viewable by everyone"
  ON public.aps_calculation_rules FOR SELECT TO anon, authenticated USING (is_active);
CREATE TRIGGER aps_calculation_rules_set_updated_at BEFORE UPDATE ON public.aps_calculation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Percentage -> points mapping -----------------------------------------
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
CREATE INDEX aps_point_bands_rule_idx ON public.aps_point_bands(rule_id);
GRANT SELECT ON public.aps_point_bands TO anon, authenticated;
GRANT ALL ON public.aps_point_bands TO service_role;
ALTER TABLE public.aps_point_bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "APS point bands are viewable by everyone"
  ON public.aps_point_bands FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER aps_point_bands_set_updated_at BEFORE UPDATE ON public.aps_point_bands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-subject special handling ------------------------------------------
CREATE TYPE public.aps_subject_rule_type AS ENUM ('exclude', 'always_include', 'cap_points', 'bonus_points');

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
CREATE INDEX aps_rule_subjects_rule_idx ON public.aps_rule_subjects(rule_id);
GRANT SELECT ON public.aps_rule_subjects TO anon, authenticated;
GRANT ALL ON public.aps_rule_subjects TO service_role;
ALTER TABLE public.aps_rule_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "APS subject rules are viewable by everyone"
  ON public.aps_rule_subjects FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER aps_rule_subjects_set_updated_at BEFORE UPDATE ON public.aps_rule_subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Universities reference a rule -----------------------------------------
ALTER TABLE public.universities
  ADD COLUMN aps_rule_id uuid REFERENCES public.aps_calculation_rules(id) ON DELETE SET NULL;

-- Student "almost qualify" tolerances -----------------------------------
ALTER TABLE public.profiles
  ADD COLUMN aps_tolerance smallint NOT NULL DEFAULT 5,
  ADD COLUMN subject_percentage_tolerance smallint NOT NULL DEFAULT 5;

-- Demo rule --------------------------------------------------------------
INSERT INTO public.aps_calculation_rules (code, name, version, description, status, counting_subject_count, special_rules, sort_order)
VALUES (
  'DEMO_STANDARD',
  'DEMO / UNVERIFIED — Example APS scale',
  'v1',
  'Demonstration APS calculation rule used to test the architecture. Not based on any real institution''s published rules and must not be used for real admission decisions.',
  'demo',
  6,
  '{"demo": true, "notes": "Best 6 counting subjects, Life Orientation excluded."}'::jsonb,
  0
);

INSERT INTO public.aps_point_bands (rule_id, min_percentage, max_percentage, points, label, sort_order)
SELECT r.id, b.minp, b.maxp, b.pts, b.lbl, b.ord
FROM public.aps_calculation_rules r,
(VALUES
  (80, 100, 7, 'Level 7 (80-100%)', 1),
  (70, 79.999, 6, 'Level 6 (70-79%)', 2),
  (60, 69.999, 5, 'Level 5 (60-69%)', 3),
  (50, 59.999, 4, 'Level 4 (50-59%)', 4),
  (40, 49.999, 3, 'Level 3 (40-49%)', 5),
  (30, 39.999, 2, 'Level 2 (30-39%)', 6),
  (0, 29.999, 1, 'Level 1 (0-29%)', 7)
) AS b(minp, maxp, pts, lbl, ord)
WHERE r.code = 'DEMO_STANDARD';

INSERT INTO public.aps_rule_subjects (rule_id, subject_id, rule_type, notes)
SELECT r.id, s.id, 'exclude', 'Demo rule excludes Life Orientation from the APS total.'
FROM public.aps_calculation_rules r
JOIN public.subjects s ON s.name ILIKE 'Life Orientation'
WHERE r.code = 'DEMO_STANDARD';

-- Point existing demo universities at the demo rule
UPDATE public.universities u
SET aps_rule_id = (SELECT id FROM public.aps_calculation_rules WHERE code = 'DEMO_STANDARD')
WHERE u.aps_rule_id IS NULL;