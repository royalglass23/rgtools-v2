# MT-188 Shakedown

## Covered

- Added shared AI Guidance runtime tests for timeout fetch signals, retry cooldown, regeneration cooldown, failure metadata, and a successful domain generator path.
- Kept Quote Tracker AI Suggestion generation on the existing public function while routing cooldown, failure metadata, and save orchestration through the shared runtime.
- Added failure metadata persistence for Quote Tracker AI Suggestion and Conversation Snapshot failures: stage, error type, safe message, attempted time, retry-after time, user, model, prompt version, and input snapshot version.
- Preserved the existing 5-minute timeout message and 5-minute regeneration cooldown / 1-minute retry cooldown behavior.
- Scoped AI Suggestion retry cooldown checks to `ai_suggestion` failures so a failed Conversation Snapshot refresh does not block generation from an existing snapshot.
- Ran focused regression coverage for shared runtime, ServiceM8 file context, Quote Tracker AI Suggestion, Conversation Snapshot, AI Guidance query, panel rendering, and server actions.
- Ran the app TypeScript check.

## Deliberately skipped

- End-to-end browser coverage: this slice is shared server/runtime plumbing with existing UI tests covering the observable panel behavior.
- Live OpenAI or ServiceM8 calls: tests use boundary mocks and assert the outbound OpenAI request shape and timeout signal.
- Work Orders wiring: MT-188 prepares the reusable runtime seam; no Work Orders AI Guidance generator exists in this slice.
- Lead AI Guidance wiring: this ticket is the prefactor before the Lead implementation, so Lead-specific prompts and persistence remain for the follow-up slice.
