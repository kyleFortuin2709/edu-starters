ALTER TABLE public.prospectus_documents
  ADD COLUMN IF NOT EXISTS aps_rule_id uuid REFERENCES public.aps_calculation_rules(id) ON DELETE SET NULL;