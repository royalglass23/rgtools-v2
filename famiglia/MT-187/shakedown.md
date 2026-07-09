# MT-187 Shakedown

## Slice

Quote Tracker Conversation Snapshots now include ServiceM8 interpreted file context from the shared MT-186 foundation. Snapshot generation keeps existing notes/email history behavior, adds file/photo/PDF context to the structured summary input/output, records file counts in source metadata, and treats unsupported or failed file interpretation as partial context without blocking saved snapshots or downstream AI Suggestions.

## Covered

- File-aware snapshot generation through `generateConversationSnapshotForQuote`.
- No-file jobs remain compatible and save complete snapshots with zero file counts.
- Interpreted image/PDF summaries and unsupported file metadata are passed into summary generation and persisted through structured snapshot output.
- Failed file interpretation marks the snapshot partial, records partial context details, and does not create a failed snapshot attempt.
- AI Suggestion generation receives the file-aware `structuredSummary` from the latest Conversation Snapshot.
- Action-level AI Guidance generation still creates a suggestion when the refreshed snapshot has partial ServiceM8 context.

## Verification

- `npm.cmd test -- --run modules/quote-tracker/__tests__/conversation-snapshot.test.ts modules/quote-tracker/__tests__/ai-suggestion.test.ts --reporter=verbose`
- `npm.cmd test -- --run modules/quote-tracker/__tests__/ai-guidance-actions.test.ts --reporter=verbose`
- `npm.cmd test -- --run modules/quote-tracker/__tests__/AiGuidancePanel.test.tsx modules/quote-tracker/__tests__/AiGuidanceSubmitButton.test.tsx --reporter=verbose`
- `npx.cmd tsc --noEmit -p apps\web\tsconfig.json`
- `npm.cmd run lint -- modules/quote-tracker/conversation-snapshot.ts modules/quote-tracker/__tests__/conversation-snapshot.test.ts modules/quote-tracker/__tests__/ai-suggestion.test.ts`

## Notes

- Full root lint was not used as the final lint signal because the root script forwards file arguments into `@rgtools/catalog`; the web lint pass itself reported only pre-existing warnings outside this slice before the catalog argument failure.
- The panel/button test run passed but still emits the existing React `act(...)` stderr warning from the copy-button interaction test.
- No live ServiceM8/OpenAI calls were run; this slice is covered at the public module/action seams with boundary dependencies mocked.
