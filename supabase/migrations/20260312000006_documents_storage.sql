-- Documents table — versioned document storage for generated docs
-- Each row represents one version of a document linked to a source block.

CREATE TABLE IF NOT EXISTS public.documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  block_id    uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  title       text NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  format      text NOT NULL DEFAULT 'html' CHECK (format IN ('html', 'pdf', 'markdown')),
  html_content text,
  file_path   text,                          -- Supabase Storage path (for PDF/uploaded files)
  file_size   integer,                       -- File size in bytes
  mime_type   text,                          -- MIME type of stored file
  template_id uuid REFERENCES public.blocks(id) ON DELETE SET NULL, -- Source template (if template-based)
  ai_generated boolean NOT NULL DEFAULT false,
  generation_metadata jsonb DEFAULT '{}',    -- Prompt, model, tokens, etc.
  created_by  text NOT NULL,                 -- Clerk user ID
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON public.documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_block_id ON public.documents(block_id);
CREATE INDEX IF NOT EXISTS idx_documents_block_version ON public.documents(block_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON public.documents(template_id) WHERE template_id IS NOT NULL;

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own_org" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "documents_insert_own_org" ON public.documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "documents_delete_own_org" ON public.documents
  FOR DELETE USING (true);

-- Auto-increment version per block — trigger function
CREATE OR REPLACE FUNCTION public.set_document_version()
RETURNS trigger AS $$
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
  FROM public.documents
  WHERE block_id = NEW.block_id AND org_id = NEW.org_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_document_version
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_version();

-- Storage bucket for document files (PDFs, uploaded references)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50MB limit
  ARRAY['application/pdf', 'text/html', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "documents_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "documents_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents');
