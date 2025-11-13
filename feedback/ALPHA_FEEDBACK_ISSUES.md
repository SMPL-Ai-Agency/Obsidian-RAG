# Alpha Feedback Follow-up Issues

The following GitHub issues should be opened immediately after the alpha release PR is merged to capture user feedback and quality signals:

1. **Collect structured vault feedback events**
   - Title: "Telemetry hooks for alpha sync feedback"
   - Description: Instrument FileTracker and QueueService to emit anonymized success/failure events that can be shared by early testers. Include toggle in settings for opting in.
   - Rationale: Gives us real-world data on hybrid mode reliability without exposing sensitive note data.

2. **Surface release health in Settings tab**
   - Title: "Add alpha release health widget"
   - Description: Extend the "Recent Sync Activity" panel with aggregated stats (success rate, last failure) and link to troubleshooting docs so testers can quickly report findings.
   - Rationale: Encourages qualitative feedback directly from the UI and reduces friction when reporting bugs.

3. **Document hybrid best practices for testers**
   - Title: "Alpha feedback guide for hybrid sync"
   - Description: Create a short guide (docs/alpha-feedback.md) outlining how to capture logs, share sanitized sync files, and report issues via GitHub.
   - Rationale: Ensures consistent feedback quality from the alpha cohort.
