## Obsidian RAG
### Hybrid RAG Sync for Obsidian Notes
Obsidian RAG is a fork of the MindMatrix Obsidian plugin. It seamlessly synchronizes your notes with a **Supabase vector store** and **Neo4j graph database** to build a Hybrid RAG system for AI automation platforms and large language models (LLMs) like AI assistants.  

It prioritizes **Ollama-powered embeddings** (local or cloud-hosted) for privacy and cost efficiency, while also providing optional support for **OpenAI API** and compatible models.  
This enables efficient knowledge retrieval and automation across multiple vaults. Build custom integrations, automate workflows with **n8n**, and turn your Second Brain into a dynamic, searchable resource accessible via AI tools—without mixing content between projects.  

For example, create a **Telegram bot** that searches your vectorized notes and GraphRAG entities in Neo4j for answers. An **n8n workflow** can integrate Perplexity or other search APIs to blend your personal knowledge with external data, delivering a portable, intelligent assistant.  

---

## Summary
Obsidian RAG connects your Obsidian vaults to both a Supabase vector store and a Neo4j graph database to create a **Hybrid RAG (Retrieval-Augmented Generation)** system.

It pairs **semantic embeddings** (for context-aware retrieval) with **graph relationships** (for linked knowledge and entity mapping), allowing your notes to power intelligent assistants, automations, and advanced search tools—all while preserving project separation and privacy.

---

## Plugin Features
These are the built-in mechanisms and core behaviors the plugin executes to make the system work.

- **Automatic note synchronization:** Detects new, edited, and deleted notes; syncs them in near-real-time to **Supabase (vector)** and **Neo4j (graph)**.  
- **Embedding generation service:** Uses **Ollama by default** for vector embeddings, with optional **OpenAI or compatible models**.  
- **Graph construction engine:** Builds and updates Neo4j nodes & relationships for notes, tags, and entities—enabling GraphRAG-style semantic-graph queries.  
- **Queue and task management:** Orchestrates sync and embedding jobs with parallelization, retry logic, and event-based updates.  
- **Offline queue and reconciliation:** Stores unsent sync jobs locally and executes them automatically once connectivity resumes.  
- **Configurable exclusions:** Supports ignore rules for folders or files (e.g., templates, private journals, daily logs).  
- **Database setup automation:** Initializes Supabase tables, vector indexes, and Neo4j schema automatically on first run.  
- **Connection status and error handling:** Provides database connection indicators, graceful error recovery, and automatic retry cycles.  
- **Progress tracking and notifications:** Displays in-app progress indicators and user notifications for ongoing syncs, updates, and errors.  
- **Cross-device sync management:** Uses a unified sync-state file to coordinate edits and deletions between multiple devices.  
- **Extensible architecture:** Written in modular TypeScript services (`EmbeddingService`, `QueueService`, `SupabaseService`, etc.) for developer extension.  
- **n8n workflow hooks:** Exposes triggers and endpoints so **n8n** can invoke sync, query, and embedding operations programmatically.  
- **Developer utilities:** Includes helper scripts for database queries, resets, and automated release management.

---

## Use Cases
Once the plugin is configured and running, users can perform these tasks and automations:

- **Sync multiple vaults safely:** Keep “Research,” “Business,” and “Personal” vaults independent while syncing each to Supabase and Neo4j—no cross-project data mixing.  
- **Semantic search and retrieval:** Ask natural-language questions or find related ideas using meaning-based search powered by **Ollama** (local or cloud), with optional **OpenAI-compatible** APIs.  
- **Graph-based knowledge exploration:** Visualize and navigate relationships between notes, tags, people, and topics in **Neo4j** for connected thinking, genealogy, and research analysis.  
- **Automated workflows with n8n:** Automate sync, semantic, and graph-based queries—or hybrid (RAG + GraphRAG) searches—and deliver results to **Telegram**, **Discord**, dashboards, or other AI automation platforms.  
- **Build custom AI assistants:** Combine your private knowledge base with external data (e.g., **Perplexity**, search APIs) to create intelligent chatbots and agent systems powered by your notes and graph entities.  
- **Local-first privacy mode:** Run embeddings and databases entirely on your local machine for full data control, offline operation, and zero external dependency.  
- **Cross-device synchronization:** Keep notes, deletions, and metadata consistent across devices via a shared **sync state file** that maintains vault integrity.  
- **Offline operation:** Continue capturing and editing notes offline—updates are queued locally and automatically reconciled once you reconnect.

---

## Installation
For detailed installation and setup instructions, refer to the [INSTALL.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md).  
This includes:
- Setting up Supabase with the required SQL  
- Configuring OpenAI or Ollama credentials  
- Plugin installation steps  
- Advanced configuration and troubleshooting  
- Optional n8n workflow for Telegram or custom integrations  

---

## Project Status
### Completed ✅
- Core database setup and configuration  
- Development environment setup  
- Basic plugin functionality  
- File synchronization system  
- Initial user interface  

**Database Connection & Setup Automation**
- Automatic connection testing  
- Connection status indicators  
- Table setup automation  
- Database reset functionality  
- Comprehensive error handling  

**Core Services Implementation**
- SupabaseService (connection + operations)  
- EmbeddingService (embeddings)  
- QueueService (task processing)  
- SyncManager (file management)  
- EventEmitter system  
- StatusManager (progress tracking)  
- SyncDetectionManager  
- InitialSyncManager (batch processing)  

### In Progress 🚧
- Documentation updates  
- MindMatrix codebase bug review and fixes  
- Fix Supabase deletion ID mismatch for delete-task integrity  
- Prevent double vault-event registration  
- Repair `TextSplitter` (user-defined chunking, metadata extraction)  
- Stabilize `removeExcludedFiles` (reliable exclusion cleanup)  
- MindMatrix performance optimizations  
- Additional validation and test coverage  

### Upcoming 📅
- Advanced RAG + GraphRAG search interfaces  
- Support for additional file types  
- Developer & debugging tools  
- Community collaboration features  

For task tracking and progress, see [TASKS.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/TASKS.md).

---

## For Developers
### Getting Started
1. Clone the repository:
    ```shell
    git clone https://github.com/SMPL-Ai-Agency/Obsidian-RAG.git
    cd Obsidian-RAG
    ```
2. Install dependencies:
    ```shell
    yarn install
    ```
3. Start the development build:
    ```shell
    yarn dev
    ```

### Development Prerequisites
- Node.js v16 or higher  
- Yarn  
- A Supabase (PostgreSQL) instance with the vector extension enabled  
- Familiarity with the Obsidian Plugin API  

### Project Structure
```
Obsidian-RAG/
├── main.ts                       # Plugin entry point and lifecycle
├── settings/
│   ├── SettingsTab.ts             # Settings UI component
│   └── Settings.ts                # Settings interface and defaults
├── services/
│   ├── EventEmitter.ts            # Inter-service event communication
│   ├── InitialSyncManager.ts      # Initial vault synchronization
│   ├── MetadataExtractor.ts       # Extracts note metadata for sync
│   ├── OfflineQueueManager.ts     # Handles offline operations
│   ├── EmbeddingService.ts        # Ollama/OpenAI embedding generation
│   ├── QueueService.ts            # Async task queue
│   ├── StatusManager.ts           # Progress tracking
│   ├── SupabaseService.ts         # Supabase operations
│   ├── SyncDetectionManager.ts    # Quiet sync detection
│   ├── SyncFileManager.ts         # Cross-device sync file management
│   └── __tests__/                 # Unit tests
├── utils/
│   ├── ErrorHandler.ts            # Centralized error logging
│   ├── FileTracker.ts             # Tracks file events
│   ├── NotificationManager.ts     # Notifications + progress display
│   └── TextSplitter.ts            # Text chunking and preprocessing
├── models/
│   ├── DocumentChunk.ts
│   ├── ObsidianRAGSettings.ts
│   ├── ProcessingTask.ts
│   ├── QueueEvents.ts
│   └── SyncModels.ts
├── scripts/
│   ├── query_tables.ts
│   └── release-utils.sh
├── sql/                           # Database schema and helper scripts
├── tests/
├── styles.css
├── manifest.json
└── README.md
```
### Contributing
We welcome contributions to improve Obsidian RAG.  
To contribute:
1. Fork the repository.  
2. Create a feature branch.  
3. Implement your changes with tests.  
4. Submit a pull request with a clear summary.  

Bug fixes, performance improvements, documentation updates, and feature proposals are all encouraged.

---

## Support
If you encounter any issues:
- Open an issue on GitHub  
- Review existing issues for solutions  
- See [INSTALL.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md) for troubleshooting  

---

## License
This project is licensed under the **MIT License**.

---

## Development Documentation
For further technical documentation:
- [Installation Guide](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md)  
- [Development Guide](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/DEVELOPMENT.md)  
- [Architecture Overview](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/ARCHITECTURE.md)  
- [Changelog](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/CHANGELOG.md)  
- [Task Tracking](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/TASKS.md)  

