# AGENTS.md: Guidance for AI Coding Agents (e.g., OpenAI Codex, GitHub Copilot, Cursor)

This file provides unified instructions for AI agents assisting with Obsidian-RAG, an Obsidian plugin forked from MindMatrix. It syncs notes from multi-vaults to Supabase (pgvector embeddings) and Neo4j (graphs) for privacy-focused Hybrid RAG workflows. Ingestion-only—no in-app querying. Prioritize Ollama for local embeddings, offline resilience, and extensibility.

## Scope
This file applies to the entire repository unless a nested `AGENTS.md` overrides it.

## Project Overview
- **Purpose**: Prepare Obsidian vaults as AI-ready knowledge bases for external tools (e.g., n8n, Telegram bots).
- **Tech Stack**: TypeScript, Obsidian API, Supabase, Neo4j, Ollama/OpenAI.
- **Key Modes**: RAG (vectors), GraphRAG (entities/relations), Hybrid.
- **AI Directive**: When suggesting code, reference services/ (e.g., SupabaseService), utils/ (e.g., EmbeddingUtils), and types/ for strict typing. Ensure multi-vault isolation via `project_name`.

## Design Principles (Adhere Strictly)
- Worker Actor Model: Separate file watching, scanning, and processing.
- Atomic Processing: Sequential events for consistency.
- Offline Resilience: Queue changes during outages; use QueueService.
- Performance: Minimize impact; use SHA-256 hashes for detection.
- Reliability: Add retries and logging.
- Testability: Support unit/integration tests; mock dependencies.
- **AI Directive**: Prefer Ollama for embeddings to prioritize privacy; fallback to OpenAI only if needed, with warnings.

## Core Components and Directives
- **Actor System**: File Watcher (Obsidian events), Startup Scanner (hash comparisons), Worker Actor (queue polling in Web Worker), Coordinator (lifecycle).
- **Event Queue**: In-memory FIFO with timestamps; types like FILE_CREATED; states like QUEUED.
- **File Tracking**: Hashing, metadata extraction (YAML, tags, links), exclusions.
- **Processing Pipeline**: Chunking, entity extraction, embedding generation, atomic DB syncs.
- **Database**: Supabase tables (`documents`, `obsidian_file_status`); Neo4j nodes/relations.
- **Settings/UI**: API configs, mode toggles, rescans, status indicators.
- **AI Directive**: Generate code with atomic transactions; defer heavy ops; include exclusion rules.

## Conventions
- Follow the existing coding style of surrounding files instead of introducing new patterns.
- Keep changes focused and add explanatory comments when introducing non-obvious logic.
- Prefer `yarn` for installing dependencies and running scripts.
- **AI Directive**: Use modular services; avoid external deps; output TypeScript with interfaces.

## Dev Environment Tips
- Setup: Supabase (pgvector), Neo4j 5.x, Ollama; use INSTALL.md.
- Build: `yarn dev` for dev, reference sql/setup.sql for DB init.
- **AI Directive**: Suggest local testing with Obsidian sandbox; check connections before syncs.

## Testing
- Run the most relevant `yarn` scripts (e.g., `yarn test`, `yarn lint`, `yarn build`) for the area you touched before opening a PR.
- Include the commands you ran in your final summary, noting whether they passed.
- **AI Directive**: Follow test-first; generate Jest tests covering edges (e.g., offline); use mocks for DB/APIs.

## Pull Request Notes
- Summaries should list the most important code or documentation changes.
- Mention any limitations or follow-up work if tests cannot be run locally.
- **AI Directive**: Include "why" rationale; reference TASKS.md; ensure PRs align with Git workflow (feature branches, atomic commits).

## Safety and Permissions
- **AI Directive**: Avoid code that sends data externally without Ollama; flag privacy risks; ensure secure API key handling.

## Example Usage
- Prompt: "Implement a new rescan option in settings."
- Expected: Code adhering to actor model, with tests and offline support.

This draws from deprecated CLAUD.md for architecture while optimizing for AI. For more: https://developers.openai.com/codex/cloud (or current Copilot docs).
