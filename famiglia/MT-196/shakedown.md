# MT-196 Shakedown

## Slice

Generate one concise OpenAI production label for each unlabelled ServiceM8 Work Order Item after successful reconciliation. Keep AI failure outside the ServiceM8 transaction, preserve manual wording across ordinary refreshes, detect source-description changes, and let Manage users correct or deliberately regenerate only the short-label portion of the composite Item cell.

## Automated coverage

- The Work Order label adapter uses the existing `OPENAI_API_KEY` and `OPENAI_MODEL` configuration and the OpenAI Responses endpoint.
- Valid output produces one label for one ServiceM8 item; multi-line and over-160-character output is rejected.
- Label processing runs only after the successful ServiceM8 reconciliation transaction.
- OpenAI failure marks the item failed while the ServiceM8 refresh remains successful and retryable.
- Pending and failed items show an 80-character source-description fallback plus `Label pending`.
- A later manual refresh retries failed or pending label generation.
- Generated labels survive ordinary refresh when the source fingerprint is unchanged.
- Manual labels take precedence and survive ordinary refresh.
- A changed ServiceM8 description regenerates only when no manual override exists.
- A changed source behind a manual label preserves the label and displays `Source description changed`.
- Manage users receive one short-label text input; quantity and item code remain non-editable.
- Manual label and AI regeneration actions validate input, enforce Manage permission, update source fingerprints, and write item-owned audit entries.
- Regenerate with AI presents a confirmation and replaces the effective label only after successful generation.

## Commands and results

- Changed MT-196 tests plus audit: **PASS**, 6 files / 53 tests.
- Affected query/grouping/server tests: **PASS**, 4 files / 20 tests.
- Earlier complete Work Orders plus audit regression: **PASS**, 19 files / 105 tests before the final three authorization tests were added; the changed authorization file later passed 20/20.
- Workspace lint: **PASS**, no errors; existing unrelated warnings remain. Modified-file ESLint with the workspace-pinned binary: **PASS**, no warnings or errors.
- App-scoped `next build`: **PASS**, compilation, TypeScript, 35-page generation, and `/work-orders` routes.
- Standalone web `tsc --noEmit`: MT-196 files are clean; the command remains blocked only by the pre-existing readonly `NODE_ENV` assignment in `lib/storage/__tests__/r2.test.ts`.
- `git diff --check`: **PASS** after the documentation and shakedown closeout.

## Security coverage

- Negative tests prove users without Work Orders Manage access cannot manually change or regenerate an item label.
- Empty manual input is rejected before the item is read or changed; manual labels are single-line and capped at 160 characters.
- Model output is treated as untrusted and rejected when empty, missing, multi-line, or longer than 160 characters.
- Quantity, item code, original description, and line total remain read-only ServiceM8-owned values.
- OpenAI credentials remain server-side and use the existing environment configuration; no secrets are logged or returned to the browser.
- Manual and regenerated label changes record actor, item identity, parent Work Order identity, previous label, and new label.

## Deliberately skipped or incomplete

- No live OpenAI call: tests use a controlled boundary adapter and do not consume credentials or paid API capacity.
- No live ServiceM8 refresh or shared Neon mutation: reconciliation and failure behavior are exercised through controlled adapters and database-boundary tests.
- No Playwright journey: this checkout has no isolated authenticated Work Orders database with controlled ServiceM8 and OpenAI adapters. Component tests cover visible label states, editability, and confirmation without mutating shared infrastructure.
- The complete web Vitest suite was attempted with one worker and normal concurrency. The one-worker pass exceeded four minutes and was terminated; the concurrent passes exited during unrelated cross-module execution without printing a failing assertion. Completed affected and Work Orders batches pass, but the full web suite is not claimed as green.

## Staging verification

1. Apply the existing Work Order Item migrations if staging is not current, then confirm `OPENAI_API_KEY` and `OPENAI_MODEL` are configured.
2. Refresh a current Work Order containing a new ServiceM8 production line and confirm one item remains one row with a concise generated label.
3. Temporarily use an invalid OpenAI configuration, refresh another new item, and confirm the item still appears with a truncated fallback and `Label pending` while the refresh reports success.
4. Restore OpenAI configuration, refresh again, and confirm the pending label is generated.
5. Correct a label manually, refresh without changing ServiceM8, and confirm the manual wording remains.
6. Change that item's ServiceM8 description, refresh, and confirm the manual wording remains with `Source description changed`.
7. Confirm regeneration, verify the new AI label replaces the manual wording, and inspect the audit log for both label actions.
8. Sign in with View-only access and confirm no label edit or regeneration controls are present.
