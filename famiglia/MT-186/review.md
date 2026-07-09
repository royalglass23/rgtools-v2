# Review - MT-186

- Date: 2026-07-09T11:33:18+12:00
- Commit: 3f210980
- Verdict: APPROVED

## Findings

### Should-fix

1. Add an explicit file-size guard before sending downloaded attachments to OpenAI.
   - Evidence: `apps/web/modules/ai-guidance/servicem8-file-context.ts:102-105` downloads the entire attachment and passes the raw `ArrayBuffer` to the interpreter; `apps/web/modules/ai-guidance/servicem8-file-context.ts:302-315` base64-encodes that buffer into the OpenAI request. This preserves the raw-byte discard contract, but a large ServiceM8 file can still create a high-memory/high-cost request before failing downstream.
   - Impact: scalability/cost guard for live rollout. Not a blocker for MT-186 because the slice is a foundation and the acceptance criteria did not define a maximum size.

## Axis 1 - Architecture

- Maintainability: PASS
  - `buildServiceM8FileContext()` is a deep module with a small interface at `apps/web/modules/ai-guidance/servicem8-file-context.ts:61-83`.
  - ServiceM8, DB, file download, OpenAI, and time are behind adapters in `ServiceM8FileContextDeps` at `apps/web/modules/ai-guidance/servicem8-file-context.ts:45-55`.
  - Domain-specific callers can reuse the output without inheriting prompt-specific code.

- Scalability: PASS with should-fix
  - Cache reuse is indexed by attachment UUID plus edit date in `packages/db/src/schema.ts:220-239`, matching the acceptance criteria and preventing repeated interpretation for unchanged files.
  - Processing is sequential, which avoids bursty parallel OpenAI calls. The missing file-size guard is the only scalability concern.

- Performance: PASS with should-fix
  - Cached files skip download and interpretation at `apps/web/modules/ai-guidance/servicem8-file-context.ts:68-75`.
  - Unsupported files skip download at `apps/web/modules/ai-guidance/servicem8-file-context.ts:89-100`.
  - Large supported files need a size cap before OpenAI submission.

## Axis 2 - Standards

- Early returns / guard clauses: PASS
- Business naming: PASS
- External systems behind adapters: PASS
- Decisions separated from actions: PASS
  - File support classification is separate from cache/download/save actions at `apps/web/modules/ai-guidance/servicem8-file-context.ts:138-161`.
- Useful errors: PASS
  - Safe failed-file records include attachment name/UUID and classified error metadata at `apps/web/modules/ai-guidance/servicem8-file-context.ts:115-123`.
- Inputs validated at boundaries: PASS
  - ServiceM8 attachment list shape is checked before mapping at `apps/web/modules/ai-guidance/servicem8-file-context.ts:190-205`.
- Strong types: PASS
- Tested: PASS
  - The public interface is the test surface in `apps/web/modules/ai-guidance/__tests__/servicem8-file-context.test.ts:63-185`.
- Maintainable: PASS

## Axis 3 - Spec

- Shared interpreted-file cache persists required metadata: PASS
  - Schema and migration cover attachment UUID, job UUID, name, file type, source, edit date, status, summary, model, interpreted timestamp, and safe error metadata at `packages/db/src/schema.ts:220-239` and `drizzle/migrations/0045_servicem8_interpreted_files.sql:1-26`.
- Cache reuse on UUID/edit date match: PASS
  - Tested at `apps/web/modules/ai-guidance/__tests__/servicem8-file-context.test.ts:68-81`.
- Reinterpretation on edit-date change: PASS
  - Tested at `apps/web/modules/ai-guidance/__tests__/servicem8-file-context.test.ts:83-98`.
- Image/PDF interpreted status: PASS
  - Tested at `apps/web/modules/ai-guidance/__tests__/servicem8-file-context.test.ts:100-121`.
- CAD/other unsupported status: PASS
  - Tested at `apps/web/modules/ai-guidance/__tests__/servicem8-file-context.test.ts:123-144`.
- Failed-file handling continues the context build: PASS
  - Tested at `apps/web/modules/ai-guidance/__tests__/servicem8-file-context.test.ts:146-171`.
- Raw bytes are not persisted: PASS
  - Tested at `apps/web/modules/ai-guidance/__tests__/servicem8-file-context.test.ts:173-184`.
- Scope check: PASS
  - MT-186 touches shared AI guidance module, schema/migration, and famiglia notes. The pre-existing untracked `famiglia/ai-guidance-lifecycle/contract.md` is related planning context but was not part of this enforcer review.

