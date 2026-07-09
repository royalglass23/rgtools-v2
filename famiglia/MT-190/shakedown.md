# MT-190 Shakedown

## Covered

- Replaced the Lead detail "Suggested next step" surface with a durable AI Guidance panel using the Quote Tracker wording pattern.
- Displayed Conversation Snapshot and AI Suggestion as separate Lead sections when durable records exist.
- Displayed Email Draft with "Copy content" support and Phone Talking Points when a Lead AI Suggestion exists.
- Added the empty state "No Conversation Snapshot or AI Suggestion saved yet."
- Added Generate, Regenerate, and Retry and regenerate button states, including the existing five-minute regeneration cooldown.
- Kept the Lead panel visible for unlinked Leads while disabling generation with "Link this lead to ServiceM8 to generate AI Guidance."
- Kept partial-context and retryable failure warnings visible alongside saved guidance.
- Updated the durable unlinked Lead generator message to match the panel wording.

## Deliberately skipped

- Live OpenAI and ServiceM8 calls: MT-189 already covers the durable generator boundaries with mocks, and this slice is the Lead detail presentation/action wiring.
- End-to-end browser coverage: the component, action, query, and page tests cover the requested states without touching shared dev data.
- Stale Lead AI Suggestion warning state: the current Lead AI Suggestion schema does not include stale fields yet, so MT-190 only preserves existing failure and partial-context warnings without adding schema outside the ticket.
