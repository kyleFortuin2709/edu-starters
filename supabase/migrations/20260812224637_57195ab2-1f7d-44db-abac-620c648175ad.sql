ALTER TABLE public.prospectus_documents
  ADD COLUMN IF NOT EXISTS extraction_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_model text,
  ADD COLUMN IF NOT EXISTS aps_methodology_text text;