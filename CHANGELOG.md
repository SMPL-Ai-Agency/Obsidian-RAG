# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Entity preview overlay inside the NotificationManager so advanced entity syncs can be validated without leaving Obsidian.
- Local embedding cache in `EmbeddingService` that stores Ollama/OpenAI responses in browser storage to avoid redundant API calls.
- Batched entity helpers in `Neo4jService` with shared `runWrite` error-wrapping to simplify future GraphRAG upserts.

### Changed
- Updated README.md and INSTALL.md to clarify the ingestion-only workflow, document the available command palette controls, and replace broken documentation links.
- Filtered GraphBuilder relationship parsing to drop low-confidence edges and improved Jest coverage around malformed LLM responses.
- Pinned `ts-jest` to `29.2.5` to prevent future regressions from tooling churn.

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