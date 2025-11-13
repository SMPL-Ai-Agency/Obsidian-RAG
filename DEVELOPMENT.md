# DEVELOPMENT.md: Developer Guide for Obsidian-RAG

This document provides guidance for developers contributing to or extending Obsidian-RAG, an ingestion-only Obsidian plugin forked from MindMatrix. It focuses on setting up a development environment, understanding the codebase, writing tests, and following best practices for contributions. For architectural details, refer to [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites
- **Node.js**: Version 18+ (enforced by `make dev`).
- **Yarn**: For package management.
- **Obsidian**: Latest version for testing the plugin.
- **Databases**: Supabase (with pgvector extension) and Neo4j 5.x for full feature testing.
- **Embedding Providers**: Ollama (local or cloud) or OpenAI-compatible API keys.
- **Git**: For cloning and managing the repo.
- **Optional Tools**: Jest for testing, ESLint for linting, a TypeScript-aware IDE like VS Code, and `ts-node`/`tsx` if you plan to run the TypeScript scripts under `scripts/` without compiling them first.

## Getting Started
1. **Clone the Repository**:
   ```
   git clone https://github.com/SMPL-Ai-Agency/Obsidian-RAG.git
   cd Obsidian-RAG
   ```

2. **Install Dependencies**:
   ```
   yarn install
   ```

3. **Set Up Environment**:
   - Copy `.env.template` to `.env` and fill in your Supabase, Neo4j, Ollama, and OpenAI credentials.
   - `make check-env` verifies the `.env` file and exports variables for downstream targets.
   - For local testing, start Supabase and Neo4j instances (e.g., via Docker):
     ```
     # Example for Supabase (adjust as needed)
     docker-compose up -d
     ```
     ```
     # Example for Neo4j
     docker run --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:latest
     ```

4. **Development Mode**:
   - Run the dev watcher to build and hot-reload the plugin:
     ```
     yarn dev
     ```
   - Install the plugin in Obsidian: Go to `Settings > Community Plugins > Browse`, then load from folder (point to the repo's root).

5. **Build for Production**:
   ```
   yarn build
   ```
   This generates `main.js`, `manifest.json`, and `styles.css` in the root for manual installation or releases.

6. **Scripts and Utilities**:
   - **Query Tables**: `scripts/query_tables.ts` is a TypeScript helper that exercises `SupabaseService`. Run it via `npx ts-node scripts/query_tables.ts` (or your preferred TS runner) after exporting the same environment variables the plugin expects. The repository does not ship with `ts-node`, so `npx` will prompt to install it if you have not already.
   - **Release Utils**: `scripts/release-utils.sh` automates version bumps and GitHub releases (wraps `yarn build`, `yarn version`, and tagging logic). The `make release-*` targets source this helper and automatically run `yarn lint`, `yarn test`, and `yarn build` before any version files are touched, so a failing check aborts the release.
   - **Makefile Targets**: `make dev` runs the esbuild watcher, `make init` installs dependencies and provisions the Supabase schema, `make setup-db` replays `sql/setup.sql`, `make test-db` validates credentials, and `make reset` re-runs the SQL migrations after a wipe. There is no `make test`; use the Yarn scripts directly for linting or Jest.

## Code Style and Conventions
- **Language**: TypeScript with strict typing (see `tsconfig.json`). The config enables `esnext.disposable` so `Symbol.asyncDispose`
  is available for the `neo4j-driver` type definitions used throughout the services; do not remove it or the compiler will fail
  on `yarn tsc --noEmit`.
- **Linting**: ESLint (`yarn lint`) enforces formatting and best practices; there is no repository-wide Prettier config, so rely on ESLint autofix or your editor settings.
- **Type-Checking**: Run `tsc --noEmit` if you need a stricter compile-time pass beyond what esbuild surfaces.
- **Commits**: Follow conventional commits (e.g., `feat: add new mode toggle`, `fix: handle deletion edge case`). Keep changes atomic.
- **Comments**: Add JSDoc for public methods; inline comments for non-obvious logic.
- **Modularity**: Place DB logic in `services/`, helpers in `utils/`, types in `models/`.

## Testing
Obsidian-RAG uses Jest for unit and integration tests. Most suites live in `tests/` (e.g., `tests/QueueService.edgeCases.test.ts`, `tests/OfflineQueueManager.test.ts`) while targeted service tests such as `services/__tests__/SupabaseService.test.ts` exercise specific integrations.

- **Run Tests**:
  ```
  yarn test                # Executes the complete suite once.
  yarn test:watch          # Watch mode for quicker iteration.
  ```
  `yarn test:watch` was verified locally with `--runTestsByPath tests/QueueService.delete.test.ts` and automatically re-ran the test file after edits, so you can pin the suites relevant to your changes while keeping watch mode responsive.
  - **Do not remove `jest-environment-jsdom`**: `tests/NotificationManager.test.ts` declares `@jest-environment jsdom` so that DOM helpers like `HTMLElement` exist. Keep the `jest-environment-jsdom` dev dependency installed (run `yarn add -D jest-environment-jsdom` if it goes missing) or the suite will fail to start.

#### Ingest regression harness

Hybrid vault syncs are release-blocking, so run the dedicated ingest validation whenever you touch queue orchestration or the chunkers:

```bash
yarn test --runTestsByPath tests/IngestModes.integration.test.ts
```

This suite spins up the real `QueueService` with mocked Supabase/Neo4j backends plus the in-memory Obsidian vault helpers from `tests/__mocks__` to confirm Supabase-only, Neo4j-only, and Hybrid modes write in the correct order.

- **Writing Tests**:
  - Focus on edge cases: offline syncs, retries, exclusions, Mode Preview reporting, and hybrid-mode fallbacks.
  - Use mocks: Jest mocks for Obsidian APIs, HTTP requests (e.g., Ollama), and DB clients.
  - Example excerpt from `tests/QueueService.delete.test.ts`:
    ```typescript
    import { SupabaseService } from '../services/SupabaseService';

    it('removes chunks for delete tasks', async () => {
      const fileStatusId = 42;
      const supabaseService = {
        getFileStatusIdByPath: jest.fn().mockResolvedValue(fileStatusId),
        getDocumentChunks: jest.fn().mockResolvedValue([]),
        deleteDocumentChunks: jest.fn().mockResolvedValue(undefined),
        updateFileStatusOnDelete: jest.fn().mockResolvedValue(undefined),
      } as Partial<SupabaseService>;
      const { queueService } = createQueueService(supabaseService);
      const task = createTask();

      await (queueService as any).processDeleteTask(task);

      expect(supabaseService.deleteDocumentChunks).toHaveBeenCalledWith(fileStatusId, 'Test.md');
      expect(supabaseService.updateFileStatusOnDelete).toHaveBeenCalledWith('Test.md');
    });
    ```

- **Coverage**: Aim for 80%+; run `yarn test:coverage` to check.

## Contributing
We welcome contributions! Follow these steps:
1. **Fork and Branch**: Create a feature branch from `main` (e.g., `feat/entity-extraction-enhance`).
2. **Develop and Test**: Implement changes, add tests, update docs if needed.
3. **Commit and PR**: Push to your fork and open a Pull Request with a clear title, description, limitations, and references to TASKS.md or issues.
4. **Review Process**: Expect feedback on alignment with design principles (privacy-first, resilience, modularity).

- **Bug Reports**: Open issues with reproduction steps, logs, and environment details.
- **Feature Ideas**: Discuss in issues before coding; tie to use cases like n8n integrations.
- **Documentation Updates**: When the code introduces new services (e.g., ModePreviewManager or HybridRAGService), update `ARCHITECTURE.md` alongside README/CHANGELOG entries.

## Debugging Tips
- **Logs**: Enable verbose logging in settings; check Obsidian console (Ctrl+Shift+I).
- **Common Issues**:
  - Connection failures: Test with settings tab's "Test Connection" button.
  - Sync errors: Inspect queue via "Show recent sync graph overlay".
  - Offline reconciliation: Simulate disconnects and verify `OfflineQueueManager`.
- **Hot Reloading**: Changes to `main.ts` or services auto-reload in dev mode.

## Release Process
- Bump version in `manifest.json`.
- Run `yarn build`.
- Use `scripts/release-utils.sh` to tag and push releases.
- Update CHANGELOG.md with summaries.

For task tracking, see [TASKS.md](TASKS.md). If you're extending the plugin (e.g., custom extractors), ensure compatibility with hybrid modes.


This architecture ensures Obsidian-RAG remains lightweight, testable, and adaptable for privacy-focused RAG workflows. For specifics, dive into code comments or open an issue for clarifications.
