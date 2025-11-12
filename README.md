## Summary
Obsidian RAG connects your Obsidian vaults to both a Supabase vector store and a Neo4j graph database to create a **Hybrid RAG (Retrieval-Augmented Generation)** system.  
It combines **semantic embeddings** (for deep contextual understanding) with **graph-based relationships** (for linked knowledge and entity mapping), allowing your notes to power intelligent assistants, automations, and advanced search tools—all while preserving project separation and privacy.

---

## Capabilities (What You Can Do)
- **Sync multiple vaults safely:** Keep your “Research,” “Business,” and “Personal” vaults independent while syncing all to Supabase and Neo4j—no cross-project data mixing.
- **Semantic search and retrieval:** Ask natural questions or find related ideas using meaning-based searches powered by Ollama (local or cloud), with optional OpenAI or compatible APIs.
- **Graph-based knowledge exploration:** Visualize and navigate relationships between notes, tags, people, and topics through Neo4j for connected thinking and advanced research.
- **Automated workflows with n8n:** Trigger automated sync, search, or summary workflows that deliver results to Telegram, Discord, dashboards, or other AI platforms.
- **Build custom AI assistants:** Combine your personal notes with external data sources (e.g., Perplexity, search APIs) to create knowledge-driven agents and chatbots.
- **Local-first privacy mode:** Run everything locally—embeddings, vector search, and graph operations—for full privacy and zero cloud dependency.
- **Cross-device synchronization:** Keep your notes, deletions, and metadata consistent across devices using a shared sync file.
- **Offline operation:** Continue capturing and editing notes offline; queued updates automatically sync once you reconnect.

---

## Plugin Features (What the Plugin Implements)
- **Automatic note synchronization:** Detects new, edited, or deleted notes and syncs them to Supabase (vector) and Neo4j (graph) in real time.
- **Embedding generation service:** Uses Ollama by default to generate vector embeddings for your notes, with optional OpenAI or compatible models.
- **Graph construction engine:** Builds Neo4j nodes and relationships for notes, tags, and entities—supporting GraphRAG-style queries.
- **Queue and task management:** Handles sync jobs, retries, and parallel processing through an internal queue system.
- **Offline queue and reconciliation:** Automatically stores tasks locally when offline and executes them once a connection is available.
- **Configurable exclusions:** Lets you exclude folders, files, or templates (e.g., “Daily Notes,” “Private Journals”) from sync.
- **Database setup automation:** Initializes and validates Supabase tables, vector indexes, and Neo4j schema with one command.
- **Connection status and error handling:** Displays database connection states, handles errors gracefully, and retries failed sync operations.
- **Progress tracking and notifications:** Provides in-app progress indicators and notifications for sync status, updates, and errors.
- **Cross-device sync management:** Uses a shared sync file to ensure accurate multi-device coordination and state consistency.
- **Extensible architecture:** Built with modular TypeScript services (EmbeddingService, QueueService, SupabaseService, etc.) that developers can extend.
- **n8n workflow hooks:** Integrates with n8n to trigger sync, query, and update operations directly from workflows.
- **Developer utilities:** Includes helper scripts for table queries, database resets, and automated release processes.

---

## Installation
For detailed installation and setup instructions, please refer to the [INSTALL.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md) file.
This includes:
- Setting up Supabase with the required SQL
- Configuring OpenAI API credentials
- Plugin installation steps
- Detailed configuration operations
- n8n workflow setup for Telegram Chatbot (optional and customizable)

---

## Project Status
### Completed ✅
- Core database setup and configuration
- Development environment setup
- Basic plugin functionality
- File synchronization system
- Initial user interface
- Database Connection and Setup Automation
    - Automatic database connection testing
    - Connection status indicators
    - Table setup automation
    - Database reset functionality
    - Comprehensive error handling
- Core Services Implementation
    - SupabaseService with connection handling
    - EmbeddingService with embeddings
    - QueueService with task processing
    - SyncManager with file management
    - EventEmitter system
    - StatusManager with progress tracking
    - SyncDetectionManager
    - InitialSyncManager with batch processing

### In Progress 🚧
- Documentation updates
- MindMatrix codebase Bug review and fixes
- Fix the Supabase deletion ID mismatch so data integrity is restored for delete tasks.
- Prevent double registration of vault events to stop duplicate task processing and side effects.
- Repair `TextSplitter` construction so chunking respects user settings and metadata extraction has the right dependencies.
- Stabilize `removeExcludedFiles` filter assembly so database cleanup for exclusions succeeds reliably.
- MindMatrix Performance optimizations
- Additional testing and validation

### Upcoming 📅
- Advanced search features in both RAG and GraphRAG Databases
- Additional file type support
- Developer tools and debugging features
- Community features and collaboration tools

For detailed task tracking and progress, see [TASKS.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/TASKS.md).
