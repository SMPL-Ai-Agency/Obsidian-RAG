# Obsidian RAG - Vector Database Sync for Obsidian

⚠️ **WARNING: This plugin is in early alpha stage. Please only use it with test vaults, not your primary vault.** ⚠️

Obsidian RAG is an Obsidian plugin that seamlessly synchronizes your notes with a Supabase vector database. By leveraging AI-powered embeddings and semantic search capabilities, it enables powerful knowledge retrieval and automation. Use it to build custom integrations, automate workflows with tools like n8n, and transform your personal knowledge base into a searchable, dynamic resource.

I've built this to make my Obsidian vault searchable through AI tools. For example, I have a Telegram Bot set up that I can ask questions on-the-go, and it searches my vectorized vault data to provide answers. The n8n workflow integrates with Perplexity to augment my personal knowledge with external information when needed, creating a powerful knowledge assistant that travels with me.

> Maintained by **George Freeney Jr.** and the **SMPL: Ai Automations** team ([https://smpl.ai](https://smpl.ai)).

---

## Overview

Obsidian RAG creates and maintains vector representations of your notes in a Supabase (PostgreSQL) database, allowing you to:

- Build powerful automation workflows using platforms like n8n.
- Create semantic search applications using your personal knowledge.
- Develop custom integrations through standard PostgreSQL connections.

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

For detailed installation and setup instructions, please refer to the [INSTALL.md](./INSTALL.md) file.

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
  - OpenAIService with embeddings
  - QueueService with task processing
  - SyncManager with file management
  - EventEmitter system
  - StatusManager with progress tracking
  - SyncDetectionManager
  - InitialSyncManager with batch processing
- Utility Implementation
  - TextSplitter with configurable chunking
  - ErrorHandler with centralized management
  - NotificationManager with progress feedback
  - FileTracker with sync state management
  - OfflineQueueManager with reconciliation

### In Progress 🚧
- Documentation updates
- Performance optimizations
- Additional testing and validation

### Upcoming 📅
- Advanced search features
- Additional file type support
- Developer tools and debugging features
- Community features and collaboration tools

For detailed task tracking and progress, see [TASKS.md](TASKS.md).

---

## For Developers

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/smpl-ai-automations/obsidian-rag.git
   cd obsidian-rag
   ```
2. Install dependencies using yarn:
   ```bash
   yarn install
   ```
3. Start the development build:
   ```bash
   yarn dev
   ```

### Development Prerequisites

- Node.js v16 or higher
- Yarn
- A Supabase (PostgreSQL) database with the vector extension enabled
- Familiarity with the Obsidian Plugin API

### Project Structure

```
obsidian-rag/
├── main.ts                       # Plugin entry point and lifecycle management
├── constants/
│   ├── ErrorMessages.ts          # Centralized error messages
│   └── index.ts                  # Exports for shared constants
├── services/
│   ├── EventEmitter.ts           # Inter-service event communication
│   ├── InitialSyncManager.ts     # Initial vault synchronization
│   ├── MetadataExtractor.ts      # Extracts note metadata for sync
│   ├── OfflineQueueManager.ts    # Handles operations during offline periods
│   ├── OpenAIService.ts          # OpenAI API and embedding generation
│   ├── QueueService.ts           # Async task queue with event emissions
│   ├── StatusManager.ts          # Progress and status tracking
│   ├── SupabaseService.ts        # Supabase database operations
│   ├── SyncDetectionManager.ts   # Detects quiet sync periods
│   ├── SyncFileManager.ts        # Cross-device sync file management
│   └── __tests__/                # Service-level unit tests
├── settings/
│   ├── Settings.ts               # Settings interface and defaults
│   └── SettingsTab.ts            # Settings UI component
├── models/
│   ├── DocumentChunk.ts          # Document chunk and metadata structures
│   ├── ObsidianRAGSettings.ts    # Settings data model
│   ├── ProcessingTask.ts         # Task queue interfaces and error types
│   ├── QueueEvents.ts            # Event type definitions
│   └── SyncModels.ts             # Sync-related data shapes
├── utils/
│   ├── ErrorHandler.ts           # Centralized error logging and recovery
│   ├── FileTracker.ts            # Tracks file events and sync state
│   ├── NotificationManager.ts    # User notifications and progress bar
│   └── TextSplitter.ts           # Document chunking and text processing
├── scripts/
│   ├── query_tables.ts           # Development helper queries
│   └── release-utils.sh          # Release automation helpers
├── sql/                          # Database schema and helper SQL scripts
├── tests/                        # Unit and integration test files
├── styles.css                    # Plugin styling
├── manifest.json                 # Plugin manifest file
└── README.md                     # This documentation file
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

```bash
# Run tests
yarn test

# Build for production
yarn build
```

---

## API Documentation

For further details on the plugin's API and development guidelines, please see the [Obsidian Plugin API documentation](https://github.com/obsidianmd/obsidian-api).

---

## Support

If you encounter any issues or have questions:

- Open an issue on GitHub.
- Search existing issues for solutions.
- Consult the [INSTALL.md](./INSTALL.md) guide for troubleshooting.

---

## License

This project is licensed under the MIT License.

---

## Contact

- **Organization**: [SMPL: Ai Automations](https://smpl.ai)
- **Maintainer**: George Freeney Jr.
- **GitHub**: [https://github.com/smpl-ai-automations](https://github.com/smpl-ai-automations)

## Development

### Documentation
The project includes comprehensive documentation to help developers understand and contribute to the codebase:

- [Project Overview](README.md)
- [Installation Guide](INSTALL.md)
- [Changelog](CHANGELOG.md)
- [Task Tracker](TASKS.md)
- [Claude Integration Notes](CLAUDE.md)

### Prerequisites
- Node.js (v16 or later)
- Yarn package manager
- PostgreSQL (v14 or later)
- Supabase account
- OpenAI API key (for embeddings)

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```