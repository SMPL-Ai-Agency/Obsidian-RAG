## TASK LIST

- [x] **Fix ESLint configuration and scripts**
  - `yarn lint` currently fails because the repo still relies on the deprecated `.eslintrc` format and no `eslint.config.*` file exists. Update the tooling to ESLint v9 (or pin v8) and add a valid config so `npm run lint` works again. 【F:package.json†L1-L40】【e8b7f0†L1-L15】

- [x] **Populate `constants/ErrorMessages.ts` with exported values**
  - The file is empty, so `tsc --noEmit` aborts with TS1208 because it is treated as a script instead of a module. Define and export the shared error strings that other modules expect. 【F:constants/ErrorMessages.ts†L1-L1】【4ea4cb†L1-L8】

- [x] **Replace untyped access to `app.commands` in `main.ts`**
  - `App`’s type definition does not expose `commands`, so `tsc` fails at `openRecentSyncGraphOverlay`. Wrap the command invocation in the proper Obsidian API (e.g., `this.app.workspace.getPlugin('graph')` or cast via `this.app as App & { commands: CommandManager }`) so it compiles cleanly. 【F:main.ts†L875-L914】【4ea4cb†L8-L14】

- [x] **Install missing CodeMirror peer dependencies**
  - The bundled `obsidian.d.ts` imports `@codemirror/state` and `@codemirror/view`, but those packages are absent, producing TS2307 errors. Add them to `devDependencies` (matching the Obsidian release) so `tsc` can resolve the modules. 【4ea4cb†L24-L36】

- [x] **Upgrade TypeScript (or downgrade `neo4j-driver`) to support `Symbol.asyncDispose`**
  - `neo4j-driver` 6.x’s types use `Symbol.asyncDispose`, which TypeScript 4.7.4 does not understand. Either bump `typescript` to ≥5.2 and include the `esnext.disposable` lib, or pin the driver to a version whose types avoid the symbol. 【F:package.json†L28-L40】【4ea4cb†L14-L32】

- [x] **Extend script settings in `scripts/query_tables.ts`**
  - The helper script builds an `ObsidianRAGSettings` object without `sync.mode` or `sync.hybridStrategy`, so `tsc` errors. Add both properties using the defaults from `settings/Settings.ts`. 【F:scripts/query_tables.ts†L47-L72】【4ea4cb†L36-L44】

- [x] **Align `TaskProgress.details` usage in `InitialSyncManager`**
  - `flushProgressUpdate` passes `{ processedFiles, totalFiles }` into `TaskProgress.details`, but the interface only allows chunk/token counts, triggering a type error. Update the type definition (models/ProcessingTask.ts) or change the payload to the supported keys. 【F:services/InitialSyncManager.ts†L524-L539】【4ea4cb†L44-L52】

- [x] **Add `fileStatuses` to the sync-file schema and import `ConnectionEvent`**
  - `SyncFileManager` reads/writes `header.fileStatuses` and appends custom `ConnectionEvent` entries, but the `SyncFileHeader` interface lacks that property and the manager never imports `ConnectionEvent`. Define `fileStatuses` in `models/SyncModels.ts`, ensure its type matches what the manager stores, and import the `ConnectionEvent` type so `tsc` can compile. 【F:services/SyncFileManager.ts†L265-L320】【F:models/SyncModels.ts†L74-L89】【4ea4cb†L52-L68】

- [x] **Rework database reset confirmations in `SettingsTab`**
  - The UI currently tries to call `Notice.setMessage` and `this.app.modal`, neither of which exist in the Obsidian API, causing compile errors. Replace this with a proper `Modal` subclass or `confirm` dialog that works at runtime and satisfies TypeScript. 【F:settings/SettingsTab.ts†L616-L690】【4ea4cb†L68-L85】

- [x] **Import the correct event type when updating exclusion settings**
  - `SyncFileManager.updateSyncFileForExclusions` constructs a `ConnectionEvent` but never imports it, yielding `TS2304`. Bring the type into the module (and expand the union to include `exclusion_update` if needed). 【F:services/SyncFileManager.ts†L780-L812】【4ea4cb†L52-L68】

- [x] **Restore Jest by upgrading the TypeScript toolchain**
  - `yarn test` dies before executing any suites because the vendored `node_modules/typescript` is still 4.7.4, which does not understand the `DOM`/`ES2022`/`ESNext.AsyncIterable`/`esnext.disposable` lib combination declared in `tsconfig.json`. Update the installed TypeScript version (and lockfile) to ≥5.5, or adjust the config so ts-jest can compile and the suites run again. 【F:node_modules/typescript/package.json†L1-L6】【F:tsconfig.json†L1-L24】【00891d†L1-L66】

- [x] **Install missing `@eslint/js` so `yarn lint` works**
  - `eslint.config.mjs` imports `@eslint/js`, but the package is absent from `node_modules`, so `yarn lint` fails with `ERR_MODULE_NOT_FOUND`. Ensure the dependency is actually installed (and committed in the vendored `node_modules` if that pattern is kept) so the lint script defined in `package.json` can run. 【F:package.json†L6-L42】【34f268†L1-L13】

- [x] **Debounce settings notices to avoid UI spam**
  - Every text field in `SettingsTab` fires `new Notice(...)` on each `onChange` keystroke (Supabase URL/API key, sync mode dropdown, etc.), which results in rapid toast spam while typing. Persist values silently (or debounce until blur/submit) so users can edit fields without dozens of notifications. 【F:settings/SettingsTab.ts†L84-L130】

- [ ] **Keep the ingest-mode regression harness green**
  - `tests/IngestModes.integration.test.ts` now verifies that Supabase-only, Neo4j-only, and Hybrid queue writes run in the correct order via the mocked vault utilities. Treat this suite as a release gate whenever touching `QueueService`, chunking, or the HybridRAG strategy so ingest regressions are caught before shipping.

## Important Note
All implementation tasks must strictly follow the architecture design described in AGENTS.md

## Community Issue Cross-References

| Task | GitHub Issue | Notes |
| ---- | ------------ | ----- |
| Neo4j batch limits & hybrid sync hardening | (link when created) | Use this row when opening a public issue so contributors can coordinate fixes. |
| Release automation polish | (link when created) | Tie GitHub issue IDs back to this table whenever CHANGELOG/manifest work is planned. |

> Keep this table updated as community GitHub issues are opened. Mirroring IDs here lets vault owners discover active discussions without leaving Obsidian.
