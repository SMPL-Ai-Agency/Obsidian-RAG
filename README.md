## Obsidian RAG
### A Customizable Obsidian Hybrid RAG Plugin for Obsidian Notes  
**Created by [George Freeney Jr.](https://github.com/GeorgeFreeneyJr)**  
**Maintained by [SMPL: Ai Automations](https://github.com/SMPL-Ai-Agency)**  

Obsidian RAG is a fork of the [MindMatrix](https://github.com/khwerhahn/MindMatrix) Obsidian plugin.  
It synchronizes your notes with a **Supabase vector store** and **Neo4j graph database** to create a Hybrid RAG system for AI automation platforms and large language models (LLMs) such as AI assistants.

It prioritizes **Ollama-powered embeddings** (local or cloud-hosted) for privacy and cost efficiency, with optional support for **OpenAI API** and compatible models.

This enables efficient knowledge retrieval and automation across multiple vaults. Build custom integrations, automate workflows with **n8n**, and turn your Second Brain into a dynamic, searchable resource accessible through AI tools — without mixing content between projects.

> **Ingestion-only design:** Obsidian RAG focuses on safely ingesting and synchronizing notes into Supabase and Neo4j. You bring your own n8n workflows, chat bots, or API clients to query those stores.

For example, create a **Telegram bot** that searches your vectorized notes and GraphRAG entities in Neo4j for answers.  
An **n8n workflow** can integrate Perplexity or other search APIs to blend your personal knowledge with external data, delivering a portable, intelligent assistant.  

---

## Summary
Obsidian RAG connects your Obsidian vaults to both a Supabase vector store and a Neo4j graph database to create a **Hybrid RAG (Retrieval-Augmented Generation)** system.  

It pairs **semantic embeddings** (for context-aware retrieval) with **graph relationships** (for linked knowledge and entity mapping), allowing your notes to power intelligent assistants, automations, and advanced search tools — all while preserving project separation and privacy.

---

## Plugin Features
These are the built-in mechanisms and core behaviors the plugin implements.

- **Automatic note synchronization:** Detects new, edited, or deleted notes and syncs them in near-real-time to **Supabase (vector)** and **Neo4j (graph)**.  
- **Embedding generation service:** Uses **Ollama by default** for embeddings, with optional **OpenAI-compatible** models.
- **Embedding response cache:** Stores normalized embeddings in local storage so unchanged chunks skip redundant Ollama/OpenAI requests and speed up queue runs.
- **Embedding cache controls:** Tune the TTL (1–168 hours) directly in the plugin settings so large vaults can prioritize fewer recomputes while smaller ones keep the cache fresher.
- **Graph construction engine:** Builds Neo4j nodes and relationships for notes, tags, and entities — enabling GraphRAG-style semantic-graph queries.
- **LLM-powered entity extraction:** Optional entity/relationship mining driven by Ollama/OpenAI prompts, complete with Supabase entity vectors and Neo4j relationship weights.
- **Queue and task management:** Handles sync jobs, retries, and parallel processing via an internal queue.  
- **Offline queue and reconciliation:** Stores unsent tasks locally and runs them once reconnected.  
- **Configurable exclusions:** Lets you exclude folders/files (e.g., templates, private journals, daily logs).  
- **Database setup automation:** Initializes Supabase tables, vector indexes, and Neo4j schemas automatically on first run.  
- **Connection status and error handling:** Displays status indicators, recovers gracefully, and retries failures.  
- **Progress tracking and notifications:** Shows in-app progress and sync alerts.
- **Cross-device sync management:** Uses a unified sync-state file to keep multiple devices consistent.
- **Mode-aware synchronization:** Toggle Supabase-only (vector), Neo4j-only (graph), or Hybrid writes with automatic offline detection and recovery logic.
- **Extensible architecture:** Built with modular TypeScript services (`EmbeddingService`, `QueueService`, `SupabaseService`, etc.).
- **n8n-ready metadata:** Chunk metadata (see `models/DocumentChunk.ts`) includes `file_id`, source paths, and line numbers so n8n and other automations can correlate results back to the originating note without extra lookups.
- **Developer utilities:** Helper scripts for queries, resets, and release automation.

---

## Use Cases
Once configured, Obsidian RAG lets you automate and extend your knowledge base:

- **Sync multiple vaults safely:** Keep “Research,” “Business,” and “Personal” vaults independent while syncing to Supabase and Neo4j — no cross-project mixing.  
- **Semantic search and retrieval:** Ask natural-language questions using meaning-based search powered by **Ollama** (local or cloud) with optional **OpenAI-compatible APIs**.  
- **Graph-based knowledge exploration:** Visualize and navigate relationships between notes, tags, people, and topics in **Neo4j** for connected thinking and research.  
- **Automated workflows with n8n:** Run semantic and graph queries —or hybrid RAG + GraphRAG searches — and send results to **Telegram**, **Discord**, or dashboards.  
- **Build custom AI assistants:** Combine your private notes with external sources (e.g., **Perplexity**, web APIs) to create knowledge-driven agents.  
- **Local-first privacy mode:** Run embeddings and databases entirely offline for full data control.  
- **Cross-device synchronization:** Keep notes and metadata consistent via a shared **sync state file**.  
- **Offline operation:** Continue editing offline — updates queue locally and sync on reconnect.

---

## Advanced Entity Extraction (optional)
The **LLM & Entity Extraction** section in the plugin settings enables a semantic pipeline that:

- Prompts Ollama (preferred) or OpenAI with a dedicated LLM model (`Settings → LLM model`) to extract entities with descriptions.
- Queues multiple “gleaning” passes so difficult entities can be re-requested with iterative hints.
- Applies user-defined regex hints before LLM calls so critical patterns are always captured.
- Embeds each entity and stores it in a new `entities` table inside Supabase for similarity search and deduplication.
- Mirrors those entities and their inferred relationships (weights, keywords, descriptions) into Neo4j via the new `GraphBuilder` service.
- Streams a compact **entity preview overlay** inside the Obsidian status bar (NotificationManager) so you can validate the latest extracted nodes and relationships without opening external dashboards.
- Adds an inline **“Open note”** action to jump directly from the overlay to the source note when you want to audit the highlighted entities.

> **Tip:** Install a generative Ollama model (e.g., `ollama pull llama3`) before enabling this feature so prompts and embeddings can stay local. The plugin falls back to OpenAI-compatible chat models when Ollama is unavailable.

Entity extraction runs automatically after each note sync and respects your existing `project_name` isolation, meaning each vault keeps its own scoped entity vectors and graph nodes.

---

## Command Palette Controls
Each vault can be managed directly from the Obsidian command palette. These commands map 1:1 with the plugin logic in `main.ts`:

- **Force sync current file** — Immediately queues the active note for processing (uses `queueFileProcessing`).
- **Force sync all files** — Iterates through every markdown file and enqueues allowed ones for updates.
- **Clear sync queue** — Flushes pending tasks from `QueueService`.
- **Reset file tracker cache** — Rebuilds the cached metadata used for change detection.
- **Start / Stop initial vault sync** — Manually start or cancel the bulk `InitialSyncManager` flow.
- **Show recent sync graph overlay** — Opens the overlay fed by `recordSyncOutcome` so you can confirm recent successes/failures.

Use these actions after changing settings, performing maintenance, or when you want to verify that ingestion is healthy before triggering downstream automations (n8n, Telegram bots, etc.).

---

## Sync Modes & Hybrid Workflows
Obsidian RAG can be pointed at one or both backends depending on what you are building:

- **Supabase mode (Vector):** Generates embeddings and writes to the shared `documents` table (scoped by `project_name`). Ideal when you just need semantic search or when Neo4j is temporarily offline.
- **Neo4j mode (Graph):** Skips embedding generation and only upserts entities/relationships into Neo4j using your configured `project_name` to keep vaults isolated.
- **Hybrid mode:** Runs both stages sequentially (vector-first by default) or according to the execution order defined in **Settings → Sync → Hybrid strategy**. Writes are considered successful only when both services acknowledge them, preventing split-brain states.

The queue detects offline states per mode: Supabase mode pauses when either Supabase or the embedding provider is missing, Neo4j mode only cares about the graph connection, and Hybrid requires both. Once the missing service comes back online, tasks resume automatically so every vault stays isolated and up to date.

Pair Hybrid mode with n8n workflows to run **vector + graph** lookups in a single automation: query Supabase for candidate chunks, then enrich answers with graph context from Neo4j for richer assistants.

---

## Installation
See [INSTALL.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md) for details:
- Setting up Supabase with SQL
- Configuring Ollama or OpenAI credentials
- Plugin installation and configuration
- n8n workflow examples (e.g., Telegram bot)
- Advanced troubleshooting

### Neo4j Setup Overview
1. Start a Neo4j 5.x database locally (Desktop, Docker, etc.) or provision an Aura instance.
2. Copy the **Bolt URL**, **username**, **password**, and optional database name.
3. Pick a unique `project_name` for each vault (`Settings → Neo4j`) so graph nodes remain isolated.
4. Paste those values into the plugin settings (or your `.env` for CLI scripts). The plugin will create the required constraints automatically during the first sync.

---

## Project Status
### Completed ✅
- Core database setup and configuration
- Development environment setup
- Basic plugin functionality
- File synchronization system
- Initial UI

**Database Connection & Setup**
- Connection testing and status indicators
- Table and index automation
- Database reset and error handling

**Core Services**
- SupabaseService (operations)
- EmbeddingService (embeddings)
- QueueService (tasks)
- SyncManager (file management)
- EventEmitter system
- StatusManager (progress)
- SyncDetectionManager
- InitialSyncManager (batch processing)

**Quality & Reliability Improvements**
- Documentation (README/INSTALL) refreshed to reflect current setup, sync, and workflow guidance.
- Supabase delete pipeline now resolves `file_status_id` records before removing chunks to prevent ID mismatches.
- Vault event handlers are registered once per session via an `eventsRegistered` guard to avoid duplicate listeners.
- `TextSplitter` rebuild handles YAML metadata extraction, overlap, and abort support for consistent chunking.
- `removeExcludedFiles` purges both file status rows and chunk records that match the configured exclusions.
- Expanded Jest coverage exercises queue deletion retries and Supabase helpers to validate performance-related regressions.
- MindMatrix bug review completed to ensure the upstream issues list reflects the current fixes and regressions.

### In Progress 🚧
- None — follow [TASKS.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/TASKS.md) for upcoming work.

For task tracking and progress, see [TASKS.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/TASKS.md).

---

## For Developers
### Getting Started
```bash
git clone https://github.com/SMPL-Ai-Agency/Obsidian-RAG.git
cd Obsidian-RAG
yarn install
yarn dev
```

> **Note:** Use **Node.js 18+** (the Makefile will stop if an older runtime is detected) and copy `.env.template` to `.env` before running `make init` or any Supabase tooling so your credentials are available.

### Requirements
- Node.js v18+
- Yarn  
- Supabase (PostgreSQL + vector extension)  
- Neo4j 5.x  
- Obsidian Plugin API knowledge  

### Directory Structure
```text
Obsidian-RAG/
├── main.ts                       # Plugin entry point and lifecycle
├── settings/
│   ├── SettingsTab.ts             # Settings UI
│   └── Settings.ts                # Settings interface and defaults
├── services/
│   ├── EventEmitter.ts            # Inter-service communication
│   ├── InitialSyncManager.ts      # Initial vault sync
│   ├── MetadataExtractor.ts       # Metadata for sync
│   ├── OfflineQueueManager.ts     # Offline tasks
│   ├── EmbeddingService.ts        # Ollama/OpenAI embeddings
│   ├── QueueService.ts            # Async queue
│   ├── StatusManager.ts           # Progress tracking
│   ├── SupabaseService.ts         # Supabase operations
│   ├── SyncDetectionManager.ts    # Quiet sync detection
│   ├── SyncFileManager.ts         # Cross-device sync
│   └── __tests__/                 # Unit tests
├── utils/
│   ├── ErrorHandler.ts            # Centralized logging
│   ├── FileTracker.ts             # File event tracking
│   ├── NotificationManager.ts     # Notifications + progress bar
│   └── TextSplitter.ts            # Chunking and preprocessing
├── models/
│   ├── DocumentChunk.ts
│   ├── ObsidianRAGSettings.ts
│   ├── ProcessingTask.ts
│   ├── QueueEvents.ts
│   └── SyncModels.ts
├── scripts/
│   ├── query_tables.ts
│   └── release-utils.sh
├── sql/                           # Database schemas
├── tests/
├── styles.css
├── manifest.json
└── README.md
```

---

## Contributing
Contributions are welcome!  
Fork → Branch → Commit → Pull Request.  
Bug fixes, optimizations, and docs improvements are encouraged.

---

## Support
If you encounter issues:
- Open an issue on GitHub  
- Check existing issues  
- Consult [INSTALL.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md)

---

## License
Licensed under the **MIT License**.  

© 2025 George Freeney Jr.  |  SMPL: Ai Automations

---

## Documentation Index
- [Installation Guide](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md)
- [Changelog](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/CHANGELOG.md)
- [Task Tracking](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/TASKS.md)
- [Release Artifact Checklist](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/release/RELEASE_ARTIFACTS.md)
- [Alpha Feedback Follow-ups](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/feedback/ALPHA_FEEDBACK_ISSUES.md)
