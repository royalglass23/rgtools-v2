# Review - MT-188

- Date: 2026-07-09T12:52:08.8830518+12:00
- Reviewed commit: 9ae55f09 MT-188
- Verdict: APPROVED

## Findings

No must-fix findings.

## Axis 1 - Architecture: PASS

- Keep: `apps/web/modules/ai-guidance/runtime.ts:51` exposes a small cooldown decision interface, and `apps/web/modules/ai-guidance/runtime.ts:79` exposes the shared generator runtime. The module has useful depth: timeout constants, cooldown calculation, failure record construction, timeout fetch, and safe error classification stay behind one shared AI Guidance seam.
- Keep: Quote Tracker still owns the business-specific signal/context/record mapping in `apps/web/modules/quote-tracker/ai-suggestion.ts:229`, while the shared runtime only orchestrates generation, validation, saving, and failure recording. That keeps module locality intact.
- Keep: `apps/web/modules/quote-tracker/ai-suggestion.ts:400` scopes retry cooldown reads to `failureStage = 'ai_suggestion'`, while `apps/web/modules/quote-tracker/ai-guidance.ts:35` still reads the latest failure stream for the staff panel. This preserves existing UI behavior without letting snapshot failures block suggestion retry behavior.
- Keep: DB impact is narrow and additive: `packages/db/src/schema.ts:213` and `drizzle/migrations/0046_ai_guidance_failure_runtime_metadata.sql:1` add only failure metadata columns.

## Axis 2 - Standards: PASS

- Early returns: invalid IDs and missing quotes still exit early in `apps/web/modules/quote-tracker/ai-suggestion.ts:212` and `apps/web/modules/quote-tracker/conversation-snapshot.ts:150`.
- Business naming: runtime and Quote Tracker names are domain-specific: `promptVersion`, `inputSnapshotVersion`, `failureStage`, `conversationSnapshot`, and `signal`.
- External systems behind adapters: OpenAI timeout behavior is centralized in `apps/web/modules/ai-guidance/runtime.ts:147`, with Quote Tracker keeping OpenAI request shape in its generator adapter.
- Decisions/actions: cooldown decision is pure in `apps/web/modules/ai-guidance/runtime.ts:51`; generation side effects are injected via `buildContext`, `generate`, `save`, and `recordFailure` in `apps/web/modules/ai-guidance/runtime.ts:42`.
- Useful errors: failure records include stage, type, safe message, attempted time, retry time, user, model, prompt version, and input version in `apps/web/modules/ai-guidance/runtime.ts:123`.
- Strong types: no new `any`; runtime uses generic context/output/saved types.
- Tested: `apps/web/modules/ai-guidance/__tests__/runtime.test.ts:16` covers cooldowns, `:43` covers failure metadata, `:69` covers a domain generator, and `:104` covers timeout fetch signals. Quote Tracker tests assert persisted metadata in AI Suggestion and Conversation Snapshot failures.

## Axis 3 - Spec: PASS

- 5-minute timeout: `apps/web/modules/ai-guidance/runtime.ts:1` and `:147` centralize the timeout signal and message.
- Failure metadata: `apps/web/modules/ai-guidance/runtime.ts:123` builds the shared metadata record; schema/migration persist the new columns.
- Reusable cooldowns: `apps/web/modules/ai-guidance/runtime.ts:51` and `:88` provide reusable retry/regeneration behavior.
- Domain-specific generators: `apps/web/modules/ai-guidance/runtime.ts:42` lets a module provide context builder, prompt/input versions, validation, generation, and persistence while sharing operational behavior.
- Existing Quote Tracker behavior: `apps/web/modules/quote-tracker/ai-timeout.ts:1` re-exports the shared timeout path, and Quote Tracker tests continue through the public `generateAiSuggestionForQuote()` and `generateConversationSnapshotForQuote()` seams.

## Notes

- Integration test execution is not part of this code finding. The current repo script/config excludes `tests/integration/**`, so it is recorded in the gate as N/A with evidence rather than treated as an MT-188 regression.
