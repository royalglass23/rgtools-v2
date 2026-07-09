# Review - MT-190

Verdict: APPROVED

## Findings

No must-fix, should-fix, or nit findings.

## Architecture: PASS

- Maintainability: keep. `LeadAiGuidancePanel` is a local Lead presentation module with a small interface: `guidance`, `leadId`, `generateGuidanceAction`, and `generationDisabledReason` (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:8`). It reuses the existing Quote Tracker submit and copy components for cross-module language/behavior consistency (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:2`).
- Locality: keep. Lead detail wiring reads durable guidance through the existing Lead AI Guidance seam and passes it to the panel without new database logic in the page (`apps/web/app/(dashboard)/leads/[id]/page.tsx:11`, `apps/web/app/(dashboard)/leads/[id]/page.tsx:34`).
- Performance: keep. The page batches reviewer-note and guidance reads with `Promise.all`, avoiding extra sequential I/O on the detail page (`apps/web/app/(dashboard)/leads/[id]/page.tsx:34`).
- Scalability: keep. No new schema, polling, or broad queries were added; the panel renders the latest durable records already provided by MT-189.

## Standards: PASS

- Early returns and useful boundary handling remain in the server action (`apps/web/app/(dashboard)/leads/[id]/actions.ts:38`, `apps/web/app/(dashboard)/leads/[id]/actions.ts:43`, `apps/web/app/(dashboard)/leads/[id]/actions.ts:53`).
- Business names are clear: `generationDisabledReason`, `conversationSnapshot`, `aiSuggestion`, `EmailDraft`, and `Phone Talking Points` map to the MT-190 vocabulary (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:12`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:88`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:111`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:166`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:129`).
- External systems remain behind existing adapters/actions; the new form action delegates to `generateLeadSuggestionAction`, which delegates to `generateLeadAiGuidance` (`apps/web/app/(dashboard)/leads/[id]/actions.ts:77`).
- Strong types are preserved with `LatestLeadAiGuidance` and structured component props (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:1`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:13`).
- Tests assert observable UI/action behavior at public seams: empty/unlinked, linked generate, saved guidance, retry/cooldown/partial context, copy, and form redirects (`apps/web/modules/leads/__tests__/LeadAiGuidancePanel.test.tsx:10`, `apps/web/modules/leads/__tests__/LeadAiGuidancePanel.test.tsx:33`, `apps/web/modules/leads/__tests__/LeadAiGuidancePanel.test.tsx:49`, `apps/web/modules/leads/__tests__/LeadAiGuidancePanel.test.tsx:79`, `apps/web/app/(dashboard)/leads/[id]/__tests__/actions.test.ts:125`).

## Spec: PASS

- Lead detail now uses "AI Guidance" and the old "Suggested next step" section is removed from the active page (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:39`, `apps/web/app/(dashboard)/leads/[id]/page.tsx:170`).
- Conversation Snapshot and AI Suggestion render as separate sections when durable records exist (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:86`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:109`).
- Email Draft copy support and Phone Talking Points render from saved AI Suggestion data (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:125`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:129`).
- Empty state and button labels match the ticket: "No Conversation Snapshot or AI Suggestion saved yet.", Generate, Regenerate, and Retry and regenerate (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:41`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:21`).
- Unlinked Leads keep the panel visible and disabled with "Link this lead to ServiceM8 to generate AI Guidance." (`apps/web/app/(dashboard)/leads/[id]/page.tsx:41`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:64`).
- Partial context and retryable failure warnings render without hiding saved guidance (`apps/web/modules/leads/LeadAiGuidancePanel.tsx:69`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:80`, `apps/web/modules/leads/LeadAiGuidancePanel.tsx:85`).

## Residual Risk

- Stale Lead AI Suggestion warnings are not implemented because the Lead AI Suggestion schema does not currently have stale fields. This is recorded in `famiglia/MT-190/shakedown.md` and avoids adding out-of-scope schema work.
