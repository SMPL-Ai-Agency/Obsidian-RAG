# AGENTS.md: Guidance for AI Coding for Ai templates, OpenAI Codex, GitHub Copilot, Cursor, and others that support AEGENTS.md file empplemtations

This file provides unified instructions for AI agents assisting with Obsidian-RAG, an Obsidian plugin forked from the GitHub MindMatrix Obsidian project, but now a distinct codebase and standalone repo project.

Obsidian-RAG syncs notes from multi-vaults to Supabase (pgvector embeddings) and Neo4j (graphs) for privacy-focused Hybrid RAG workflows. Ingestion-only—no in-app querying. Prioritize Ollama for local embeddings, offline resilience, and extensibility.

## Scope
This file applies to the entire repository unless nested `AGENTS.md` files in sub-folders or Codex /init generated AGENTS.md files override anything contained within it.

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
- **AI Directive**: Prefer Ollama locally for embeddings to prioritize privacy; fallback to OpenAI embeddings only if needed, or if the user chooses to use their OpenAI API credentials instead.

## Core Components and Directives

### Sync Infrastructure
- **Actor System**: File Watcher (Obsidian events via vault hooks like onCreate, onModify, onDelete), Startup Scanner (hash comparisons via InitialSyncManager.ts for initial bulk sync), Worker Actor (queue polling in Web Worker to offload processing), Coordinator (lifecycle management in main.ts). Integrates with Web Workers for background operations, deferring CPU-intensive tasks like embedding generation.
- **Event Queue**: FIFO queue with timestamps, backed by persistence for offline resilience (via OfflineQueueManager.ts using local storage or JSON); types like FILE_CREATED, FILE_MODIFIED, FILE_DELETED from QueueEvents.ts; states like QUEUED, PROCESSING, COMPLETED, FAILED. Supports ordering, retries, and reconciliation on app restarts or network recovery.
- 
- **File Tracking**: Hashing (SHA-256 via SyncDetectionManager.ts for change detection), metadata extraction (YAML frontmatter, tags, links via MetadataExtractor.ts for entity building), exclusions (configurable patterns like .git ignores via settings). Incorporates multi-vault isolation with `project_name` tagging from SyncModels.ts to prevent DB cross-contamination.
- **Offline Queuing and Reconciliation**: Persistent queue management (OfflineQueueManager.ts) with sync files (SyncFileManager.ts) for cross-device coordination; handles network outages and reconciles on reconnect with timestamp-based conflict resolution.

### Data Processing
- **Processing Pipeline**: Chunking (via TextSplitter.ts for note splitting with overlap and YAML handling), entity extraction (building Neo4j nodes/relations from content via GraphBuilder.ts), embedding generation (Ollama default or OpenAI fallback), atomic DB syncs. Mode-specific: RAG focuses on vectors, GraphRAG on entities/relations, Hybrid combines both, guided by ObsidianRAGSettings.ts.

- **Database**: Supabase tables (`documents` for pgvector embeddings with chunks/vectors/metadata, `obsidian_file_status` for tracking hashes/timestamps, `entities` for extracted entities) via SupabaseService.ts; Neo4j nodes/relations (e.g., Note nodes, RELATES_TO edges) with CRUD operations and retries via GraphBuilder.ts integration. Schema setup in sql/setup.sql; emphasizes atomic transactions via RPC/Cypher queries to avoid partial syncs.
- **Embedding and Mode Management**: Ollama/OpenAI integration for vector generation via EmbeddingService.ts (with local caching and TTL); mode-specific processing (RAG/GraphRAG/Hybrid) with secure fallbacks, prioritizing privacy with Ollama as default.
- 
- **Utilities and Helpers**: Shared modules for chunking (TextSplitter.ts), hashing (SyncDetectionManager.ts), entity extraction (MetadataExtractor.ts), and common interfaces (models/ like DocumentChunk.ts, ProcessingTask.ts). Includes EventEmitter.ts for pub-sub communication between services.

### User Interaction
- **Settings/UI**: API configs (Ollama/OpenAI keys, Supabase/Neo4j URLs), mode toggles, rescans (via buttons), status indicators (queue size, sync progress via StatusManager.ts). Includes UI previews (e.g., entity graphs), error indicators, connection testing, DB resets, graph overlays, and donation QR in SettingsTab.ts (with interfaces in Settings.ts). Ensures secure key handling.
- 
- **Error Handling and Logging**: Retry mechanisms (exponential backoff, e.g., 3-5 attempts), error classification (transient vs. permanent via ErrorHandler.ts), logging to Obsidian notices/console (NotificationManager.ts), and user-facing notifications for persistent issues.

### Obsidian Plugin Compliance
To ensure eligibility for Obsidian community plugin review and approval (via PR to obsidian-releases repo), all components adhere to Obsidian's guidelines for safety, performance, and usability:
- **Performance and Non-Blocking Ops**: Actor System and Worker Actor use Web Workers and async patterns to defer heavy tasks (e.g., embeddings, syncs), preventing UI freezes.
- **Security and Privacy**: Embedding/Mode Management prioritizes local Ollama; Settings/UI handles API keys via Obsidian's secure storage API; no unauthorized network calls or data leaks.
- **API Compliance**: File Watcher and Coordinator use official Obsidian vault events and lifecycle hooks without modifications or deprecated methods.
- **Code Quality**: Modular structure with typed interfaces (models/), services, and utils; atomic transactions and retries in Processing Pipeline/Database for reliability.
- **Documentation and Testing**: Reference INSTALL.md/README.md for setup; suggest Jest tests in __tests__/ for edges like offline queuing.
- **Submission Prep**: Ensure manifest.json is valid (correct id, version, minAppVersion); keep descriptions <250 chars; test in sandbox vault with no errors.
- **AI Directive**: Generate code that follows these (e.g., avoid external deps, use Promises for async, include privacy flags); verify against latest Obsidian API doc[](https://docs.obsidian.md/).

### Supabase/Postgres Compliance (Including pgvector)
To align with Supabase's production best practices and pgvector guidelines for secure, performant vector storage:
- **Security**: Enable Row Level Security (RLS) on tables like `documents`, `obsidian_file_status`, and `entities` for data protection; use Supabase SDK for authenticated connections; follow shared responsibility model (e.g., secure API keys in Settings/UI).
- 
- **Performance**: Use indexes on pgvector columns (e.g., HNSW or IVFFlat for embeddings in Database component) with appropriate ops (vector_l2_ops); tune probes/ef_search for queries; leverage Supabase's Index Advisor and automatic optimizations.
- 
- **Data Management**: Use COPY for bulk inserts in sync ops; apply migrations (via sql/setup.sql) for schema changes; set primary keys appropriately (e.g., UUIDs for distributed syncs).
- 
- **pgvector Specifics**: Ensure finite vectors (no NaN/Infinity); build indexes post-data load with maintenance_work_mem tuning; use approximate nearest neighbors for efficiency in RAG modes.
- 
- **AI Directive**: Generate code with RLS policies, indexed pgvector ops in SupabaseService.ts, and bulk methods like COPY; monitor with EXPLAIN ANALYZE; reference Supabase docs for update[](https://supabase.com/docs).

### Neo4j Compliance
To follow Neo4j's best practices for graph modeling, queries, and transactions in entity/relation syncing:
- **Graph Modeling**: Design nodes/relations based on queries (e.g., Note nodes with RELATES_TO edges in Processing Pipeline); use schema-optional flexibility but add indexes/constraints for performance.
- 
- **Query Optimization**: Start Cypher queries with indexed nodes; use parameters to prevent injection; limit results and avoid unnecessary traversals in CRUD ops.
- **Transactions and Reliability**: Wrap ops in transactions for atomicity (e.g., in Database syncs); use retries for transient errors.
- 
- **Performance**: Create indexes on frequently queried properties; monitor with Query Log Analyzer; optimize for large graphs by vertical/horizontal scaling.
- **Security**: Use role-based access; secure connections with bolt protocol; avoid storing sensitive data without encryption.
- 
- **AI Directive**: Generate efficient Cypher (e.g., MATCH with indexes, MERGE for upserts); include transaction wrappers and parameters; test for query plans; reference Neo4j docs for modeling tip[](https://neo4j.com/docs/).

### Ollama Compliance (Local and/or Cloud)
To align with Ollama's best practices for embedding generation in privacy-focused AI applications, supporting both local execution and cloud integration (emphasizing 2025 updates like cloud models in preview for larger-scale hardware and advanced quantization/sub-second inference):
- **Privacy and Local Execution**: Ensure all processing runs locally with no data transmission by default; use quantized models (e.g., Q4 or Q8) for efficiency on consumer hardware without performance loss; prioritize local mode for data control in Obsidian-RAG.
- 
- **Cloud Integration (Optional)**: For scaling to larger models, support Ollama Cloud or hosted integrations (e.g., via APIs for datacenter-grade hardware); enable seamless switching between local and cloud via user-configurable settings; maintain privacy with encrypted connections and no unauthorized data sharing.
- **Model Management**: Default to efficient embedding models (e.g., nomic-embed-text or similar); support user-configurable models and updates via Ollama's pull/run commands for local, or cloud APIs for remote; handle hybrid setups where local falls back to cloud for resource-intensive tasks.
- 
- **Performance Optimization**: Enable GPU acceleration if available in local mode; batch embedding requests in EmbeddingService.ts for reduced latency; aim for sub-second inference in production; in cloud mode, leverage datacenter resources for massive models while monitoring costs and latency.
- 
- **Integration and Reliability**: Use Ollama's REST API securely for both local and cloud; implement health checks, graceful fallbacks (e.g., local to cloud to OpenAI), and GDPR-ready workflows for data control; ensure compatibility with Obsidian's offline resilience by preferring local when possible.
- 
- **AI Directive**: Generate code that prioritizes local Ollama availability checks with optional cloud fallback; include quantization options, batching, and hybrid local/cloud logic; reference Ollama docs (including cloud previews) for model selection, updates, and scalin[](https://ollama.com/docs).

### OpenAI Compliance (Fallback)
To follow OpenAI API best practices for secure embedding usage (including rate limits, key rotation, and data policies in 2025):
- **Security**: Store API keys as environment variables or via Obsidian's secure settings (never hardcoded); rotate keys regularly; use unique keys per integration and monitor for compromise.
- 
- **Rate Limits and Efficiency**: Implement exponential backoff retries; batch embedding requests to minimize calls; adhere to tiered limits based on usage.
- **Embeddings Specifics**: Use latest models (e.g., text-embedding-3-large); ensure finite, normalized vectors; comply with data retention (no training use by default unless opted in).
- 
- **Cost and Scalability**: Monitor token usage; optimize prompts for embeddings; follow production guidelines for scaling without overages.
- **AI Directive**: Generate fallback logic only when Ollama (local or cloud) is unavailable; include rate limit handling and secure key access in EmbeddingService.ts; reference OpenAI platform docs for update[](https://platform.openai.com/docs/api-reference).

## GitHub Workflow and Compliance
To align with GitHub's best practices for open-source repositories (including branching, release cycles, and general compliance as of 2025):
- **Branching Strategy**: Use GitHub Flow or Trunk-Based Development: Main branch as stable/production-ready; create feature branches (e.g., feature/new-rescan) for changes; protect main with branch rules (require PR reviews, passing tests).
- 
- **Release Cycles**: Follow Semantic Versioning (SemVer: MAJOR.MINOR.PATCH); tag releases (e.g., v1.0.0) with changelogs in RELEASE.md or GitHub Releases; merge release branches back to main; automate with GitHub Actions for builds/tests.
- 
- **Compliance and Security**: Enable 2FA; use dependency scanning (Dependabot); set up issue/PR templates and labels (e.g., bug, enhancement); ensure README.md is comprehensive; avoid forking for internal work—use branches; monitor for vulnerabilities.
- 
- **AI Directive**: When generating PRs, use feature branches; include SemVer updates and changelog entries; ensure code passes lint/tests; reference GitHub docs for workflow[](https://docs.github.com/).

## Internet Access and Research Directives
- **AI Directive**: Use internet search only for up-to-date info (e.g., API changes); reference these URLs first: Ollama doc[](https://ollama.com/docs), Supabase doc[](https://supabase.com/docs), Neo4j doc[](https://neo4j.com/docs/), Obsidian AP[](https://docs.obsidian.md/), OpenAI AP[](https://platform.openai.com/docs/api-reference), GitHub doc[](https://docs.github.com/). Avoid hallucinations by verifying against these sources; include relevant search URLs in suggestions when appropriate.

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
- ALWAYS run the most relevant `yarn` scripts (e.g., `yarn test`, `yarn lint`, `yarn build`) for the area you touched AND before opening a PR.
- Include the commands you ran in your final summary, noting whether they passed.
- **AI Directive**: Follow test-first; generate Jest tests covering edges (e.g., offline); use mocks for DB/APIs.

## Pull Request Notes
- Summaries should list the most important code or documentation changes.
- Mention any limitations or follow-up work if tests cannot be run locally.
- **AI Directive**: Include "why" rationale; reference TASKS.md; ensure PRs align with Git workflow (feature branches, atomic commits).

## Safety and Permissions
- **AI Directive**: Prioritize local Ollama for embeddings to minimize external data sends; enable user-configured fallbacks to Ollama Cloud or OpenAI-compatible services only via explicit settings. Flag privacy risks in comments; secure API keys (Obsidian storage, never hardcoded); add health checks before external calls.

## Example Usage
- Prompt: "Implement a new rescan option in settings."
- Expected: Code adhering to actor model, with tests and offline support.

For more: https://agents.md/ (or current Copilot docs).
