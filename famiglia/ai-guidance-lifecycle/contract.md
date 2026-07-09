## Problem Statement

Royal Glass staff need AI Guidance that is as useful on Leads as it already is on Quote Tracker, and eventually useful on Work Orders as the same job moves downstream. The current Lead and Work Order AI surfaces are simple text suggestions. They do not read the full ServiceM8 job diary, do not interpret shared files/photos/PDFs, and do not preserve enough structured context to support later lifecycle stages.

The business need is not a generic AI button. Staff need thoughtful, context-aware guidance that reads the actual customer conversation, notes, files, and job history so the suggested next move feels grounded in the full job journey.

## Solution

Build shared ServiceM8 context and file-interpretation infrastructure, then use it first in Quote Tracker and Lead AI Guidance.

The shared layer will collect ServiceM8 notes, email JSON, and attachment metadata for a job. It will temporarily download supported attachments, interpret image and PDF content, discard raw bytes, and store only ServiceM8 metadata plus AI-created summaries in a shared interpreted-file cache keyed by ServiceM8 attachment UUID and edit date.

AI Guidance itself remains domain-specific. Quote Tracker, Leads, and later Work Orders each keep their own prompt and business rules, while reusing shared attachment collection, interpreted-file cache, timeout handling, failure/cooldown helpers, and canonical UI wording.

V1 implementation order:

1. Shared ServiceM8 attachment collector and interpreted-file cache.
2. Quote Tracker file-aware Conversation Snapshots.
3. Lead AI Guidance using the same file-aware context.
4. Work Order lifecycle-aware guidance later, reading Lead, Quote Tracker, ServiceM8, interpreted files, and current Work Order state.

## User Stories

1. As a staff member viewing a tracked quote, I want AI Guidance to include relevant ServiceM8 photos and PDFs, so that the quote follow-up accounts for visual/site/customer context.
2. As a staff member viewing a linked Lead, I want AI Guidance to read ServiceM8 job diary notes, email JSON, files, and photos, so that the suggestion reflects what has actually happened with the customer.
3. As a staff member viewing a Lead without a linked ServiceM8 job, I want the AI Guidance panel to explain that ServiceM8 linking is required, so that I understand why Generate is unavailable.
4. As a staff member, I want the same AI Guidance wording and button style across Quote Tracker, Leads, and Work Orders, so that the interaction is predictable.
5. As a sales staff member, I want a Lead Conversation Snapshot, AI Suggestion, Email Draft, and Phone Talking Points, so that I can quickly decide how to follow up.
6. As a sales staff member, I want the Email Draft and Phone Talking Points to use only known facts from Lead and ServiceM8 context, so that I do not accidentally promise unsupported details.
7. As a senior reviewer, I want Lead AI Guidance to save structured context such as customer need, project signals, open questions, risks/blockers, and handoff notes, so that downstream stages can reuse it.
8. As a staff member, I want CAD and unsupported documents to be detected and listed as unsupported in v1, so that I still know the file existed even if AI cannot interpret it yet.
9. As a system operator, I want raw files downloaded only temporarily and discarded after interpretation, so that rgtools does not become the source of truth for ServiceM8 documents.
10. As a system operator, I want interpreted files cached by ServiceM8 attachment UUID and edit date, so that the same attachment is not reinterpreted across Lead, Quote Tracker, and Work Order flows.
11. As a future Work Order user, I want Work Order AI Guidance to read original Lead context, Quote Tracker context, ServiceM8 history, interpreted files, and current Work Order status, so that operational guidance is sharp and lifecycle-aware.
12. As a developer, I want Quote Tracker file interpretation implemented through shared infrastructure, so that Lead and Work Order guidance can reuse proven plumbing rather than copy quote-specific code.
13. As a staff member, I want AI Guidance failures and retries to behave consistently, so that transient ServiceM8/OpenAI issues do not leave confusing UI states.
14. As an admin, I want AI Guidance records and file interpretation summaries to preserve model/version/status metadata, so that later audit and debugging are possible.
15. As a staff member, I want AI Guidance to regenerate only after the established cooldown, so that accidental repeated generation is controlled.
16. As a staff member, I want partial ServiceM8 context warnings when some history or files could not be fetched, so that I know what the AI did not see.

## Implementation Decisions

Use the existing Quote Tracker AI Guidance wording and panel style as the canonical cross-module experience:

- AI Guidance
- Conversation Snapshot
- AI Suggestion
- Email Draft
- Phone Talking Points
- Generate
- Regenerate
- Retry and regenerate
- Copy content
- No Conversation Snapshot or AI Suggestion saved yet.

Lead-specific wording such as "Get suggestion", "Refresh AI Suggestion", and "Suggested next step" should be replaced when Lead AI Guidance is implemented.

Do not create one giant prompt. Use shared infrastructure with domain-specific generators:

- Lead guidance generator for sales qualification and follow-up.
- Quote guidance generator for quote engagement and quote-chase decisions.
- Work Order guidance generator later for install, operational risk, readiness, and customer expectation handling.

V1 Lead AI Guidance requires a linked ServiceM8 job. If a Lead has no ServiceM8 job UUID, the AI Guidance panel remains visible but Generate is disabled with: "Link this lead to ServiceM8 to generate AI Guidance."

Use lead-specific durable records for v1, mirroring the existing Quote Tracker pattern:

- lead_conversation_snapshots
- lead_ai_suggestions
- lead_ai_generation_failures

The shared interpreted-file cache is not lead-specific. It is keyed by ServiceM8 attachment UUID and edit date so the same attachment can be reused across Lead, Quote Tracker, and later Work Order guidance.

Recommended interpreted-file cache fields:

- servicem8AttachmentUuid
- servicem8JobUuid
- name
- fileType
- attachmentSource
- editDate
- status: interpreted, unsupported, or failed
- summary
- model
- interpretedAt
- errorMessage

V1 file interpretation scope:

- Interpret images.
- Interpret PDFs.
- Detect CAD/other unsupported files and store metadata plus unsupported reason.
- Do not store raw downloaded files in rgtools.
- Download files temporarily, interpret, discard bytes, and persist only metadata plus AI-created summary/status.

Quote Tracker should be made file-aware before Lead AI Guidance so the shared file interpreter is proven against the existing mature AI Guidance workflow.

Lead structured snapshot/suggestion output should include fields useful for future lifecycle handoff:

- customerNeed
- projectSignals
- openQuestions
- risksBlockers
- recommendedMove
- suggestedTiming
- confidence
- emailDraft
- phoneTalkingPoints
- handoffNotes

Work Order guidance is out of the v1 build but must be preserved in architecture. When implemented, Work Order guidance should load the full lifecycle context: current Work Order fields/status, linked Lead, linked Quote Tracker record if present, quote engagement, prior AI snapshots/suggestions, ServiceM8 diary notes/emails, interpreted files/photos/PDFs, client/contact data, and reviewer notes.

## Testing Decisions

Testing should follow the existing Quote Tracker AI Guidance tests as prior art.

Core tests:

- ServiceM8 attachment collector lists job attachments and normalizes metadata.
- Interpreted-file cache reuses summaries when attachment UUID and edit date match.
- Interpreted-file cache reinterprets when edit date changes.
- Image/PDF interpretation success saves metadata, summary, model, interpreted timestamp, and status.
- Unsupported CAD/other files save metadata and unsupported status without failing the whole snapshot.
- Failed file interpretation records failure metadata and allows the rest of ServiceM8 context to continue as partial.
- Quote Tracker Conversation Snapshot includes interpreted file summaries and source metadata.
- Quote Tracker existing snapshot/suggestion tests still pass after file-aware context is added.
- Lead AI Guidance Generate is disabled for unlinked Leads with the agreed message.
- Lead AI Guidance generates for linked ServiceM8 Leads only.
- Lead AI Guidance persists Conversation Snapshot, AI Suggestion, Email Draft, Phone Talking Points, and handoff notes.
- AI Guidance UI uses Quote Tracker wording and action labels across modules.
- Raw file bytes are not persisted by the v1 code path.

Verification gate should include focused Vitest suites for ServiceM8 client/context helpers, quote-tracker AI guidance, Lead AI Guidance actions/panel, plus TypeScript and the app build path already used for web correctness.

## Out of Scope

- Work Order AI Guidance implementation.
- Deep CAD/DWG/DXF interpretation.
- Storing raw ServiceM8 files in rgtools.
- A single generic prompt shared by Leads, Quote Tracker, and Work Orders.
- Replacing existing Quote Tracker AI Guidance tables with a fully generic guidance table.
- Admin analytics for all AI Guidance records across modules.
- Manual upload of non-ServiceM8 files.

## Risks & Rollout Notes

The main product risk is weak guidance if ServiceM8 context is missing, so v1 Lead AI Guidance requires a linked ServiceM8 job.

The main technical risk is file handling. Images and PDFs should ship first; CAD/other documents must be visible as detected-but-unsupported rather than silently ignored.

The privacy/storage risk is controlled by not storing raw downloaded files in v1. ServiceM8 remains the source of truth for files.

The architecture risk is over-unifying prompts too early. Keep domain-specific generators while sharing lower-level file/context infrastructure.

Rollout should start by making Quote Tracker snapshots file-aware because Quote Tracker already has the mature AI Guidance panel and persistence model. After that, implement Lead AI Guidance with the same visible language and shared file cache. Work Order guidance should be planned as the lifecycle-aware downstream consumer once Lead and Quote Tracker records are stable.
