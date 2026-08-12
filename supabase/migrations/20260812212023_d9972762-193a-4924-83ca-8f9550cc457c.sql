ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS requirement_type text NOT NULL DEFAULT 'elective';

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_requirement_type_check;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_requirement_type_check CHECK (requirement_type IN ('required','elective'));

UPDATE public.subjects SET category = 'Languages' WHERE code IN ('ENGHL','ENGFAL','AFRHL','AFRFAL','ISIZULU','ISIXHOSA','SESOTHO','SETSWANA');
UPDATE public.subjects SET category = 'Mathematics' WHERE code IN ('MATH','MATHLIT');
UPDATE public.subjects SET category = 'Sciences' WHERE code IN ('PHYSSCI','LIFESCI','AGRISCI');
UPDATE public.subjects SET category = 'Commerce' WHERE code IN ('ACCOUNT','BUSSTUD','ECON');
UPDATE public.subjects SET category = 'Humanities' WHERE code IN ('GEOG','HIST','RELSTUD','TOURISM','CONSSTUD');
UPDATE public.subjects SET category = 'Technology' WHERE code IN ('CAT','ITECH','ENGGRAPH');
UPDATE public.subjects SET category = 'Arts' WHERE code IN ('VISARTS','DRAMARTS','MUSIC');
UPDATE public.subjects SET category = 'Life Orientation' WHERE code = 'LIFEORI';

UPDATE public.subjects SET requirement_type = 'required'
  WHERE code IN ('ENGHL','ENGFAL','MATH','MATHLIT','LIFEORI');

DELETE FROM public.student_subjects a
USING public.student_subjects b
WHERE a.profile_id = b.profile_id
  AND a.subject_id IS NOT NULL
  AND a.subject_id = b.subject_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS student_subjects_profile_subject_key
  ON public.student_subjects (profile_id, subject_id)
  WHERE subject_id IS NOT NULL;

ALTER TABLE public.student_subjects
  DROP CONSTRAINT IF EXISTS student_subjects_mark_range_check;
ALTER TABLE public.student_subjects
  ADD CONSTRAINT student_subjects_mark_range_check CHECK (mark IS NULL OR (mark >= 0 AND mark <= 100));