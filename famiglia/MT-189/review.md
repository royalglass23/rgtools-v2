# Review - MT-189

- Date: 2026-07-09T13:33:36+12:00
- Reviewed commit: c0a212fb plus current MT-189 working-tree diff
- Verdict: APPROVED

## Findings

No open must-fix, should-fix, or nit findings remain.

### Fixed During Review

- Must-fix: Lead AI Guidance retry cooldown only considered `ai_suggestion` failures, so a failed Conversation Snapshot could be retried immediately from the combined Lead action. Fixed by making `realLeadAiGuidanceDeps.findLatestFailure()` read the latest failure for the Lead regardless of stage, then added regression coverage that a Conversation Snapshot failure blocks before ServiceM8 is fetched again. Evidence: `apps/web/modules/leads/ai-guidance.ts:450`, `apps/web/modules/leads/ai-guidance.ts:457`, `apps/web/modules/leads/__tests__/ai-guidance.test.ts:322`.

## Axis 1 - Architecture

PASS

- Maintainability: keep. `generateLeadAiGuidance()` is a deep module with a small public interface and dependency-injected adapters for DB, ServiceM8, file context, OpenAI, and time; callers do not need to know snapshot/suggestion/failure persistence details. Evidence: `apps/web/modules/leads/ai-guidance.ts:275`, `apps/web/modules/leads/ai-guidance.ts:222`.
- Scalability: keep. Latest-success/latest-failure lookups and persisted record reads are indexed by Lead and creation time, and the migration adds matching indexes for snapshots, suggestions, and failures. Evidence: `drizzle/migrations/0047_lead_ai_guidance.sql:18`, `drizzle/migrations/0047_lead_ai_guidance.sql:45`, `drizzle/migrations/0047_lead_ai_guidance.sql:70`.
- Performance: keep. ServiceM8 history, reviewer notes, and file context are fetched in parallel for snapshot generation, and retry/regeneration cooldowns short-circuit before remote fetches. Evidence: `apps/web/modules/leads/ai-guidance.ts:293`, `apps/web/modules/leads/ai-guidance.ts:304`, `apps/web/modules/leads/ai-guidance.ts:515`.

## Axis 2 - Standards

PASS

- Guard clauses validate IDs, missing Leads, unlinked ServiceM8 jobs, cooldowns, and read-only status early. Evidence: `apps/web/modules/leads/ai-guidance.ts:279`, `apps/web/modules/leads/ai-guidance.ts:283`, `apps/web/modules/leads/ai-guidance.ts:285`, `apps/web/app/(dashboard)/leads/[id]/actions.ts:37`.
- Business naming is Lead-domain specific: Conversation Snapshot, AI Suggestion, ServiceM8 context, reviewer notes, handoff notes, and generation failures are explicit.
- External systems sit behind adapters or injected dependencies; OpenAI calls use the shared timeout-aware runtime helper and strict JSON schemas. Evidence: `apps/web/modules/leads/ai-guidance.ts:222`, `apps/web/modules/leads/ai-guidance.ts:616`, `apps/web/modules/leads/ai-guidance.ts:663`.
- Inputs and AI outputs are validated at boundaries with useful errors, failure stage, error type, retry time, model, prompt version, and input snapshot version. Evidence: `apps/web/modules/leads/ai-guidance.ts:576`, `apps/web/modules/leads/ai-guidance.ts:726`.
- Tests assert behavior through the generator/action interfaces: linked success, unlinked block, partial context, validation failure, cooldown, saved-record retrieval, and action wiring. Evidence: `apps/web/modules/leads/__tests__/ai-guidance.test.ts:121`, `apps/web/modules/leads/__tests__/ai-guidance-query.test.ts:62`.

## Axis 3 - Spec

PASS

- Durable Lead Conversation Snapshot, AI Suggestion, and failure records are defined in schema and migration. Evidence: `packages/db/src/schema-leads.ts:345`, `packages/db/src/schema-leads.ts:365`, `packages/db/src/schema-leads.ts:390`.
- Linked ServiceM8 job UUID is required and unlinked Leads return a safe blocked result. Evidence: `apps/web/modules/leads/ai-guidance.ts:285`, `apps/web/modules/leads/__tests__/ai-guidance.test.ts:195`.
- Conversation Snapshot records customer need, project signals, open questions, risks/blockers, known ServiceM8 context, interpreted file summaries, handoff notes, source cursors, partial context, and metadata. Evidence: `apps/web/modules/leads/ai-guidance.ts:517`, `apps/web/modules/leads/ai-guidance.ts:536`, `apps/web/modules/leads/__tests__/ai-guidance.test.ts:146`.
- AI Suggestion records recommended move, timing, confidence, email draft, phone talking points, handoff notes, partial context, model, prompt version, and input snapshot version. Evidence: `apps/web/modules/leads/ai-guidance.ts:337`, `apps/web/modules/leads/__tests__/ai-guidance.test.ts:168`.
- Prompt instructions restrict the generator to known facts and prohibit unsupported promises. Evidence: `apps/web/modules/leads/ai-guidance.ts:629`, `apps/web/modules/leads/ai-guidance.ts:676`.

## Scope Notes

- MT-189 touched Lead AI Guidance generator/tests, Lead action wiring/tests, DB schema/migration/journal, and MT-189 shakedown/review/gate docs.
- Existing untracked `famiglia/MT-188/gate.md` and `famiglia/MT-188/review.md` were present before this Enforcer pass and are not part of MT-189 approval.
