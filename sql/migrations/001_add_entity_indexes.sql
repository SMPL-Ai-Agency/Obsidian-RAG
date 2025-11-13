-- Adds helper indexes for the entity tables referenced by GraphRAG workflows.
-- Safe to re-run; every statement uses IF NOT EXISTS guards.

CREATE INDEX IF NOT EXISTS idx_documents_last_modified
    ON public.documents (project_name, metadata->>'path');

CREATE INDEX IF NOT EXISTS idx_file_status_last_vectorized
    ON public.obsidian_file_status (vault_id, last_vectorized);

CREATE TABLE IF NOT EXISTS public.entity_sync_audit (
    id BIGSERIAL PRIMARY KEY,
    project_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    last_entity_sync TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    provider TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_entity_sync_audit_project_path
    ON public.entity_sync_audit (project_name, file_path);
