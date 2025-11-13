# 1.1.0-alpha Release Artifacts

The Git repository cannot include binary archives, so upload the following file manually when preparing the pull request or GitHub Release:

- `release/obsidian-rag-1.1.0-alpha.zip`

The PR already contains every other file that needs to accompany the release. Double-check that the following tracked files are included when reviewing or cherry-picking the change set:

1. `CHANGELOG.md`
2. `feedback/ALPHA_FEEDBACK_ISSUES.md`
3. `manifest.json`
4. `package.json`
5. `settings/SettingsTab.ts`
6. `utils/FileTracker.ts`
7. `versions.json`

If new release notes or metadata updates are required, edit the files above and regenerate the distributable before uploading the ZIP.
