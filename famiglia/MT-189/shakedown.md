# MT-189 Shakedown

## Covered

- Added durable Lead AI Guidance tables for Conversation Snapshots, AI Suggestions, and generation failures linked to the Lead and triggering user.
- Added a Lead-specific generator that requires `servicem8_job_uuid` and returns a blocked result for unlinked Leads.
- Snapshot generation records Lead details, scoring context, ServiceM8 notes/emails, interpreted file summaries, reviewer notes, source cursors, partial-context metadata, model, prompt version, and input snapshot version.
- Suggestion generation records recommended move, suggested timing, confidence, email draft, phone talking points, handoff notes, partial-context notes, model, prompt version, and input snapshot version.
- Routed the existing Lead suggestion action through the durable generator while preserving the current one-text display until MT-190 builds the full Lead AI Guidance panel.
- Added retrieval coverage for latest Lead snapshot, suggestion, retryable failure, stale failure hiding, and invalid Lead IDs.
- Added failure/cooldown coverage for output validation, retry metadata, regeneration cooldown, and partial ServiceM8/file context.

## Deliberately skipped

- Full Lead AI Guidance panel rendering: MT-190 owns the Quote Tracker wording/panel UI for Leads.
- End-to-end browser coverage: this slice is server-side persistence/generation and the existing button action remains covered by server-action tests.
- Live OpenAI or ServiceM8 calls: tests mock those system boundaries and assert saved record shape, blocked behavior, partial context, and failure metadata.
