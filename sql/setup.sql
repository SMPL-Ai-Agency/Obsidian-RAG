-- 1. Enable pgvector extension (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create documents table if it does not exist
CREATE TABLE IF NOT EXISTS public.documents (
  id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content      TEXT NOT NULL,
  metadata     JSONB,
  embedding    vector(768) NOT NULL,
  project_name TEXT NOT NULL
);

-- 3. Optional: mapping table linking user IDs to projects
CREATE TABLE IF NOT EXISTS public.user_projects (
  user_id UUID NOT NULL,
  project TEXT NOT NULL
);

-- 4. Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS policies
CREATE POLICY IF NOT EXISTS "Allow read for authenticated users by project"
  ON public.documents
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND project_name = (
      SELECT project FROM public.user_projects
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY IF NOT EXISTS "Allow insert/update for service role"
  ON public.documents
  FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS documents_project_name_idx
  ON public.documents (project_name);

CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
  ON public.documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 7. Create or replace similarity-search function
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding      vector(768),
    match_threshold      FLOAT,
    match_count          INT DEFAULT 10,
    filter_project_name  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id         BIGINT,
  content    TEXT,
  metadata   JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      d.id,
      d.content,
      d.metadata,
      1 - (d.embedding <=> query_embedding) AS similarity
    FROM public.documents AS d
    WHERE (d.embedding <=> query_embedding) < 1 - match_threshold
      AND (filter_project_name IS NULL OR d.project_name = filter_project_name)
    ORDER BY d.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

-- 8. Plugin-specific tracking table for file synchronization metadata
CREATE TABLE IF NOT EXISTS public.obsidian_file_status (
    id BIGSERIAL PRIMARY KEY,
    vault_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    last_modified BIGINT NOT NULL,
    last_vectorized TIMESTAMPTZ,
    content_hash TEXT,
    status TEXT,
    tags TEXT[],
    aliases TEXT[],
    links TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vault_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_file_status_vault_path
    ON public.obsidian_file_status(vault_id, file_path);

ALTER TABLE public.obsidian_file_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own vault file status"
    ON public.obsidian_file_status
    FOR SELECT
    USING (vault_id = current_setting('app.current_vault_id', true));

CREATE POLICY IF NOT EXISTS "Service role can do everything"
    ON public.obsidian_file_status
    USING (auth.role() = 'service_role');
