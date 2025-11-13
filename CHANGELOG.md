# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Automated release packaging in `scripts/release-utils.sh` that runs `yarn docs` and zips the runtime bundle into `release/obsidian-rag-<version>.zip` so the `make release-*` targets emit both the distributable and refreshed API docs.
- Documentation updates in `release/RELEASE_ARTIFACTS.md` describing how downstream consumers can mirror the generated TypeDoc HTML under `docs/api/`.

### Changed
- Promoted the plugin metadata to the GA version `1.1.0` across `manifest.json`, `package.json`, and `versions.json`, ensuring the release automation produces non-beta tags.
- Updated `version-bump.mjs` so the script mirrors the new GA versioning flow without prerelease suffixes.

## [1.1.0-beta] - 2025-11-13

### Added
- Entity preview overlay inside the NotificationManager so advanced entity syncs can be validated without leaving Obsidian.
- Local embedding cache in `EmbeddingService` that stores Ollama/OpenAI responses in browser storage to avoid redundant API calls.
- Batched entity helpers in `Neo4jService` with shared `runWrite` error-wrapping to simplify future GraphRAG upserts.
- Embedding cache TTL controls in the settings tab so each vault can tune how long vectors are reused before regeneration.
- Status-bar entity overlay actions that open the originating note directly from the preview.
- Configurable Neo4j batch size slider plus server-side chunking safeguards so giant entity or chunk payloads do not overwhelm Aura/Neo4j instances.
- Hybrid-mode integration test that validates entity extraction + embedding cache hits, ensuring end-to-end coverage for the ingestion pipeline.
- `sql/migrations/` directory with the first idempotent migration and documentation describing how to evolve Supabase schemas safely.
- TypeDoc configuration and `yarn docs` helper for generating API documentation straight from the TypeScript sources.
- Release checklist (see `release/RELEASE_ARTIFACTS.md`) outlining manifest bumps, build steps, and tagging requirements ahead of GitHub releases.
- Example n8n workflow scaffolding to jumpstart cache export automations.

### Changed
- Updated README.md and INSTALL.md to clarify the ingestion-only workflow, document the available command palette controls, and replace broken documentation links.
- Filtered GraphBuilder relationship parsing to drop low-confidence edges and improved Jest coverage around malformed LLM responses.
- Pinned `ts-jest` to `29.2.5` to prevent future regressions from tooling churn.
- NotificationManager now receives the Obsidian `App` reference so it can open notes safely without relying on global helpers.
- Neo4j upserts now respect server-friendly batch limits (default 500) and the new Jest suite enforces that limit going forward.

## [1.1.0-alpha] - 2025-11-13

### Added
- Neo4j graph sync integration with configurable `project_name` isolation plus a Hybrid mode that writes to Supabase and Neo4j in lockstep.
- Automated multi-vault tests that verify Supabase `vault_id` separation and Neo4j `project_name` scoping.
- Initial release of Obsidian RAG plugin
- Database management features
  - Automated database setup
  - Connection testing
  - Database reset functionality
- Core services implementation
  - SupabaseService for database operations
  - SettingsService for configuration management
- Development environment setup
  - Makefile for common operations
  - SQL scripts for database setup
  - Environment configuration

### Changed
- Queue service now enforces mode-aware offline/online transitions (Supabase-only, Neo4j-only, and Hybrid) for improved resilience.
- Improved error handling in database operations
- Enhanced logging throughout the application
- Updated documentation structure

### Fixed
- Database connection issues
- Environment variable handling
- Build process optimizations
- Front matter tag parsing now splits comma-separated values into individual tags

## [0.1.0] - 2024-04-13

### Added
- Initial project setup
- Basic plugin structure
- Development environment configuration 