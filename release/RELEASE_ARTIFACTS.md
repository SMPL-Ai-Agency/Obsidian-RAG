# 1.1.0-beta Release Artifacts

The Git repository cannot include binary archives, so upload the following file manually when preparing the pull request or GitHub Release:

- `release/obsidian-rag-1.1.0-beta.zip`

The PR already contains every other file that needs to accompany the release. Double-check that the following tracked files are included when reviewing or cherry-picking the change set:

1. `CHANGELOG.md`
2. `feedback/BETA_FEEDBACK_ISSUES.md`
3. `manifest.json`
4. `package.json`
5. `settings/SettingsTab.ts`
6. `utils/FileTracker.ts`
7. `versions.json`

If new release notes or metadata updates are required, edit the files above and regenerate the distributable before uploading the ZIP.

## Packaging Filters

When creating the archive, include **only** the runtime plugin assets (`main.js`, `manifest.json`, and `styles.css`). Explicitly exclude documentation/supporting files such as `AGENTS.md`, `ARCHITECTURE.md`, prompt libraries, or any other AI-helper notes so end users receive a clean Obsidian bundle.

## Release Checklist

Follow this quick checklist before tagging a release:

1. **Bump plugin metadata**
   - Update `manifest.json` and `versions.json` with the new semantic version.
   - Run `yarn version` or `node version-bump.mjs` if you prefer the scripted helper.
2. **Verify build output**
   - Run `yarn build` and confirm `main.js`, `manifest.json`, and `styles.css` are regenerated.
   - Execute `yarn docs` if you plan to publish the generated API reference alongside the release.
3. **Prepare the archive**
   - Zip the production bundle into `release/obsidian-rag-<version>.zip` (only `main.js`, `manifest.json`, and `styles.css`).
   - Confirm no docs, AGENTS files, or build caches make it into the artifact.
4. **Tag and push**
   - Create an annotated tag (e.g., `git tag -a v1.0.0 -m "Release v1.0.0"`).
   - Push the tag and the release branch to GitHub so downstream automations (n8n, CLI scripts) can pick up the new version.
