# MT-186 Shakedown

## Scope

Implemented the shared ServiceM8 file context foundation for AI Guidance:

- shared interpreted-file cache table for ServiceM8 attachment metadata and AI summaries
- reusable `buildServiceM8FileContext()` public seam with injectable ServiceM8, DB, download, and interpreter adapters
- cache reuse by ServiceM8 attachment UUID plus edit date
- cache invalidation when edit date changes
- image/PDF interpretation path through OpenAI Responses API
- unsupported CAD/other metadata recording without raw file downloads
- failed interpretation recording without stopping the remaining job context
- raw downloaded bytes used only in the interpreter call and not stored in cache records or returned context

## Tests

- `pnpm.cmd --filter @rgtools/web test:run modules/ai-guidance/__tests__/servicem8-file-context.test.ts`
  - Covers cache reuse, cache invalidation, image/PDF success, unsupported CAD/other handling, failed-file handling, and raw-byte discard behavior.
- `pnpm.cmd exec tsc --noEmit -p apps/web/tsconfig.json`
  - Confirms the new shared module, Drizzle schema additions, and app imports typecheck.
- `pnpm.cmd --filter @rgtools/web lint`
  - Passed with three pre-existing warnings outside this slice.
- `pnpm.cmd --filter @rgtools/db build`
  - Confirms the shared schema package typechecks.
- `.\node_modules\.bin\next.CMD build` from `apps/web`
  - Passed. Next emitted worktree/root tracing warnings, but compilation, TypeScript, page data collection, and static page generation completed.
- `git diff --check`
  - Confirms no whitespace errors in the diff.

## Deliberate Gaps

- No live ServiceM8/OpenAI call was made; this slice is the foundation and is covered through injected adapters.
- No Lead, Quote Tracker, or Work Order UI is wired to the new builder in MT-186.
- No production migration was run from this worktree.
