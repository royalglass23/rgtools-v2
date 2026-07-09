# MT-191 Shakedown

## Covered

- Added a reusable lifecycle handoff read model loader for a ServiceM8 job UUID.
- The loader returns Lead context when a linked Lead exists, including client identity and contact records.
- The loader returns Quote Tracker context when a tracked quote exists for the same ServiceM8 job, including engagement summary.
- Lead and Quote Tracker Conversation Snapshots and AI Suggestions are loaded separately so downstream Work Order guidance can preserve source boundaries.
- ServiceM8 history and interpreted file context are included with source metadata, timestamps, partial/failure state, and unsupported-file metadata.
- Reviewer notes are included for Lead-backed handoff context.
- No Work Order AI Guidance UI, Work Order prompt, or new schema was added.

## Tests

- `.\node_modules\.bin\vitest.CMD run modules/ai-guidance/__tests__/lifecycle-handoff.test.ts` from `apps/web`: 7 tests passed.
- `.\node_modules\.bin\tsc.CMD --noEmit -p apps/web/tsconfig.json`: passed.

## Deliberately skipped

- Live ServiceM8/OpenAI calls: this read model composes existing ServiceM8/file-context adapters and durable guidance rows; live external behavior is covered by the existing adapter tests.
- Work Order UI or prompt verification: explicitly out of scope for MT-191.
