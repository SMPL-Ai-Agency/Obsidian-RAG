## Obsidian RAG
### Hybrid RAG Sync for Obsidian Notes
Obsidian RAG is a fork of the MindMatrix Obsidian plugin. It seamlessly synchronizes your notes with a Supabase vector store and Neo4j graph database to build a Hybrid RAG system for AI automation platforms and large language models (LLMs) like AI assistants.

It prioritizes Ollama-powered embeddings (local or cloud-hosted) for privacy and cost efficiency, while also providing support for OpenAI API and compatible models. This democratizes AI access, reduces reliance on centralized cloud services, and inspires innovative workflows that boost productivity and creativity for developers, researchers, and knowledge workers everywhere.

The Osidian RAG Plugin enables efficient knowledge retrieval and automation across multiple vaults. Build custom integrations, automate workflows with n8n, and turn your Second Brain into a dynamic, searchable resource accessible via AI tools—without mixing content between projects.

For example, create a Telegram bot for on-the-go queries that searches your vectorized notes and GraphRAG entities in Neo4j for answers. An n8n workflow can integrate Perplexity or other search APIs to blend personal knowledge with external data, delivering a portable, intelligent assistant.

---

## Overview
Obsidian RAG syncs your notes to a Supabase vector store and Neo4j graph database, enabling a Hybrid RAG system for AI assistants and automation:
- Create privacy-first, AI-ready knowledge bases from Obsidian Vaults
- Build workflows with n8n to upsert multi-vault data without mixing projects.
- Create semantic and graph-based searches for your Second Brain knowledge, prioritizing Ollama embeddings (local or cloud) over OpenAI API, with support for OpenAI and compatibles.
- Develop integrations via PostgreSQL/Neo4j connections, like Telegram bots or Perplexity-augmented queries.

---

## Features
- Automatic synchronization of new and modified notes.
- Real-time updates as notes are added or edited.
- Configurable exclusion rules for files and directories.
- Generation of vector embeddings for semantic similarity search.
- Robust offline support with an operation queue and reconciliation.
- Cross-device coordination via a dedicated sync file.

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

---

## For Developers
### Getting Started
1. Clone the repository:
    ```shell
    git clone https://github.com/SMPL-Ai-Agency/Obsidian-RAG.git
    cd Obsidian-RAG
    ```
2. Install dependencies using yarn:
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
- A Supabase (PostgreSQL) database with the vector extension enabled
- Familiarity with the Obsidian Plugin API

### Project Structure
```
Obsidian-RAG/
├── main.ts # Plugin entry point and lifecycle management
├── settings/
│   ├── SettingsTab.ts # Settings UI component
│   └── Settings.ts # Settings interface and defaults
├── services/
│   ├── EventEmitter.ts # Inter-service event communication
│   ├── InitialSyncManager.ts # Initial vault synchronization
│   ├── MetadataExtractor.ts # Extracts note metadata for sync
│   ├── OfflineQueueManager.ts # Handles operations during offline periods
│   ├── EmbeddingService.ts # Ollama/OpenAI embedding generation
│   ├── QueueService.ts # Async task queue with event emissions
│   ├── StatusManager.ts # Progress and status tracking
│   ├── SupabaseService.ts # Supabase database operations
│   ├── SyncDetectionManager.ts # Detects quiet sync periods
│   ├── SyncFileManager.ts # Cross-device sync file management
│   └── __tests__/ # Service-level unit tests
├── utils/
│   ├── ErrorHandler.ts # Centralized error logging and recovery
│   ├── FileTracker.ts # Tracks file events and sync state
│   ├── NotificationManager.ts # User notifications and fixed progress bar
│   └── TextSplitter.ts # Document chunking and text processing
├── models/
│   ├── DocumentChunk.ts # Document chunk and metadata structures
│   ├── ObsidianRAGSettings.ts # Settings data model
│   ├── ProcessingTask.ts # Task queue interfaces and error types
│   ├── QueueEvents.ts # Event type definitions
│   └── SyncModels.ts # Sync-related data shapes
├── scripts/
│   ├── query_tables.ts # Development helper queries
│   └── release-utils.sh # Release automation helpers
├── sql/ # Database schema and helper SQL scripts
├── tests/ # Unit and integration test files
├── styles.css # Plugin styling
├── manifest.json # Plugin manifest file
└── README.md # This documentation file
```

### Contributing
We welcome contributions to improve Obsidian RAG. To contribute:
1. Fork the repository.
2. Create a feature branch.
3. Implement your changes along with tests.
4. Submit a pull request with a clear description of your changes.

Contributions of all kinds are welcome, including bug fixes, feature improvements, documentation updates, and test coverage enhancements.

### Building and Testing
To run tests and build the plugin:
```shell
# Run tests
yarn test
# Build for production
yarn build
```

---

## Support
If you encounter any issues or have questions:
- Open an issue on GitHub.
- Search existing issues for solutions.
- Consult the [INSTALL.md](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md) guide for troubleshooting.

---

## License
This project is licensed under the MIT License.

---

## Development
### Documentation
The project includes comprehensive documentation to help developers understand and contribute to the codebase:
- [Installation Guide](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/INSTALL.md)
- [Development Guide](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/DEVELOPMENT.md)
- [Architecture Overview](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/ARCHITECTURE.md)
- [Changelog](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/CHANGELOG.md)
- [Task Tracking](https://github.com/SMPL-Ai-Agency/Obsidian-RAG/blob/main/TASKS.md)

### Prerequisites
- Node.js (v16 or later)
- Yarn package manager
- PostgreSQL (v14 or later)
- Supabase account
- OpenAI API key (for embeddings)

### Setup
1. Clone the repository
    ```shell
    git clone https://github.com/SMPL-Ai-Agency/Obsidian-RAG.git
    cd Obsidian-RAG
    ```
2. Install dependencies:
    ```shell
    yarn install
    ```
